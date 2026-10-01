import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth';
import { AuthRequest } from '../types';
import { effectiveOrderChannel } from '../lib/order-channel';
import { UNPAID_PENDING_ORDER_FILTER } from '../lib/order-list-filters';
import { renderSalesReportHtml } from '../lib/report-document-service';
import { computeSalesVsExpenses } from '../lib/sales-vs-expenses';
import { getCounterSales, getCounterSaleItems } from '../lib/sumup-counter-sales';
import { PERMISSION, requirePermission } from '../lib/permissions';
import { normalizePhoneE164 } from '../lib/notifications-phone';

const router = Router();

const reportsRead = [authenticate, requirePermission(PERMISSION.REPORTS_READ)] as const;

/** "Dernières commandes" (dashboard) — assez pour que la pagination front (5/10/50) ait
 * vraiment de quoi paginer, sans charger un historique complet à chaque rafraîchissement. */
const RECENT_ACTIVITY_LIMIT = 50;

/** ?from=&to= (ISO, prioritaires) sinon ?period=<jours, défaut 7, max 90> avant aujourd'hui. */
function resolvePeriodRange(query: { from?: string; to?: string; period?: string }): {
  from: Date;
  to: Date;
} {
  if (query.from || query.to) {
    return {
      from: query.from ? new Date(query.from) : new Date(0),
      to: query.to ? new Date(query.to) : new Date(),
    };
  }
  const period = Math.min(parseInt(String(query.period ?? '7'), 10) || 7, 90);
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - period);
  return { from, to };
}

/**
 * GET /api/reports/print — rapport ventes HTML (React Email, prêt PDF)
 */
router.get('/print', ...reportsRead, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma');
    const { from, to } = resolvePeriodRange(
      req.query as { from?: string; to?: string; period?: string }
    );
    const html = await renderSalesReportHtml(prisma, req.user!.businessId, from, to);
    res.type('text/html; charset=utf-8').send(html);
  } catch (error) {
    console.error('[reports/print]', error);
    res.status(500).json({ error: 'Génération rapport impossible' });
  }
});

/**
 * GET /api/reports/sales-vs-expenses — chantier 4 : assemble ventes (Order + cache
 * SumUp comptoir) et dépenses (Expense + cache factures fournisseurs Pennylane),
 * plus pertes (commandes annulées), commandes non livrées et remboursements.
 * ?from=&to= (ISO) sinon ?period=<jours, défaut 7, max 90>
 */
router.get('/sales-vs-expenses', ...reportsRead, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma');
    const { from, to } = resolvePeriodRange(
      req.query as { from?: string; to?: string; period?: string }
    );
    const result = await computeSalesVsExpenses(prisma, req.user!.businessId, { from, to });
    res.json(result);
  } catch (error) {
    console.error('[reports/sales-vs-expenses]', error);
    res.status(500).json({ error: 'Calcul ventes vs dépenses impossible' });
  }
});

/**
 * GET /api/reports/dashboard
 * Get dashboard summary with today's stats (orders, revenue, pending, tables, items).
 * @returns {todayOrders, todayRevenue, pendingOrders, activeTables, totalItems, totalCategories, recentOrders, topSellingItems}
 */
router.get('/dashboard', ...reportsRead, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma');
    const businessId = req.user!.businessId;
    const { from: qFrom, to: qTo } = req.query as { from?: string; to?: string };

    // Période sélectionnée (sélecteur jour/semaine/mois/personnalisé côté front) — par
    // défaut "aujourd'hui" si aucune borne n'est fournie (compat anciens appelants).
    const now = new Date();
    const periodFrom = qFrom
      ? new Date(qFrom)
      : ((): Date => {
          const d = new Date(now);
          d.setHours(0, 0, 0, 0);
          return d;
        })();
    const periodTo = qTo ? new Date(qTo) : now;
    // Nombre de jours calendaires distincts couverts (pas la différence brute en ms, qui
    // décale d'un jour dès que periodFrom/periodTo ne sont pas alignés sur minuit — ex.
    // "aujourd'hui" durait moins de 24h mais comptait 2 jours, "semaine" en comptait 8).
    // Capé à 92 jours (comme /reports/print) pour éviter un salesByDay à des milliers d'entrées.
    const startOfDay = (d: Date): Date => {
      const copy = new Date(d);
      copy.setHours(0, 0, 0, 0);
      return copy;
    };
    const spanDays = Math.min(
      92,
      Math.max(
        1,
        Math.round(
          (startOfDay(periodTo).getTime() - startOfDay(periodFrom).getTime()) /
            (24 * 60 * 60 * 1000)
        ) + 1
      )
    );

    const [
      periodOrdersCount,
      periodRevenueAgg,
      pendingOrders,
      activeTables,
      totalItems,
      totalCategories,
      recentOrders,
      recentCounterSales,
      periodOrdersDetail,
      periodCounterSales,
    ] = await Promise.all([
      prisma.order.count({
        where: { businessId, createdAt: { gte: periodFrom, lte: periodTo } },
      }),
      prisma.order.aggregate({
        where: { businessId, createdAt: { gte: periodFrom, lte: periodTo }, paymentStatus: 'PAID' },
        _sum: { total: true },
        _count: true,
      }),
      prisma.order.count({
        where: {
          businessId,
          status: { in: ['PENDING_PAYMENT', 'CONFIRMED', 'PREPARING', 'READY'] },
        },
      }),
      prisma.table.count({
        where: { businessId, status: 'OCCUPIED' },
      }),
      prisma.menuItem.count({
        where: { category: { businessId }, isActive: true, slug: { not: '__snapshot__' } },
      }),
      prisma.menuCategory.count({
        where: { businessId, isActive: true },
      }),
      prisma.order.findMany({
        where: { businessId, NOT: UNPAID_PENDING_ORDER_FILTER },
        orderBy: { createdAt: 'desc' },
        take: RECENT_ACTIVITY_LIMIT,
        include: {
          items: { include: { menuItem: true } },
          table: true,
        },
      }),
      // Ventes comptoir SumUp les plus récentes — sans ça, "Dernières commandes" ne montre
      // jamais le comptoir (ce n'est pas une Order) alors que c'est un canal de vente réel.
      // Portée globale comme recentOrders (pas bornée à la période sélectionnée).
      prisma.sumupTransaction.findMany({
        where: { businessId, status: 'SUCCESSFUL', paymentType: { in: ['POS', 'CASH'] } },
        orderBy: { occurredAt: 'desc' },
        take: RECENT_ACTIVITY_LIMIT,
        select: {
          id: true,
          transactionCode: true,
          amountCents: true,
          paymentType: true,
          occurredAt: true,
          productSummary: true,
        },
      }),
      prisma.order.findMany({
        where: { businessId, createdAt: { gte: periodFrom, lte: periodTo } },
        select: {
          id: true,
          type: true,
          paymentMethod: true,
          paymentStatus: true,
          total: true,
          createdAt: true,
          isOnlineOrder: true,
          status: true,
          channel: true,
        },
      }),
      getCounterSales(prisma, businessId, periodFrom, periodTo),
    ]);

    const periodCounterRevenue = periodCounterSales.reduce((s, t) => s + t.amountCents, 0);
    const todayRevenue = (periodRevenueAgg._sum.total || 0) + periodCounterRevenue;
    const todayPaidCount = (periodRevenueAgg._count || 0) + periodCounterSales.length;
    const avgBasketToday = todayPaidCount > 0 ? Math.round(todayRevenue / todayPaidCount) : 0;

    // Répartition horaire sur toute la journée (0h-23h) — avant, seules les heures 18h-23h
    // étaient suivies : toute vente en dehors (service du midi, brunch…) disparaissait sans
    // même remonter en erreur, silencieusement.
    const hourlyToday: { hour: number; count: number; revenue: number }[] = [];
    for (let h = 0; h < 24; h++) {
      hourlyToday.push({ hour: h, count: 0, revenue: 0 });
    }

    const orderTypes: Record<string, { count: number; revenue: number }> = {};
    const paymentMethods: Record<string, { count: number; revenue: number }> = {};
    const channelsToday: Record<string, { count: number; revenue: number }> = {};
    const statusToday: Record<string, number> = {};
    let onlineToday = 0;
    // Comptoir SumUp compté dès le départ — sans Order, ces ventes ne passent jamais par la
    // boucle ci-dessous ; "Canaux" affichait donc 0 comptoir même avec des ventes SumUp réelles.
    let counterToday = periodCounterSales.length;

    const paidOrdersById = new Map<string, { createdAt: Date; total: number }>();

    for (const order of periodOrdersDetail) {
      statusToday[order.status] = (statusToday[order.status] ?? 0) + 1;
      if (order.isOnlineOrder) onlineToday++;
      else counterToday++;

      if (order.paymentStatus === 'PAID') {
        paidOrdersById.set(order.id, { createdAt: order.createdAt, total: order.total });

        const type = order.type || 'DINE_IN';
        if (!orderTypes[type]) orderTypes[type] = { count: 0, revenue: 0 };
        orderTypes[type].count++;
        orderTypes[type].revenue += order.total;

        const method = order.paymentMethod || (order.isOnlineOrder ? 'CARD' : 'CASH');
        if (!paymentMethods[method]) paymentMethods[method] = { count: 0, revenue: 0 };
        paymentMethods[method].count++;
        paymentMethods[method].revenue += order.total;

        const ch = effectiveOrderChannel(order);
        if (!channelsToday[ch]) channelsToday[ch] = { count: 0, revenue: 0 };
        channelsToday[ch].count++;
        channelsToday[ch].revenue += order.total;

        const hour = new Date(order.createdAt).getHours();
        hourlyToday[hour].count++;
        hourlyToday[hour].revenue += order.total;
      }
    }

    if (periodCounterSales.length > 0) {
      channelsToday.SUMUP_COUNTER = {
        count: periodCounterSales.length,
        revenue: periodCounterRevenue,
      };
      // Pas de "type" de commande sur une vente comptoir (pas de Order) — bucket dédié
      // plutôt que de deviner DINE_IN/TAKEAWAY, sinon "Modes de commande" reste vide dès
      // que le comptoir SumUp est le seul canal actif.
      orderTypes.COMPTOIR = { count: periodCounterSales.length, revenue: periodCounterRevenue };
      for (const sale of periodCounterSales) {
        const method = sale.paymentType === 'CASH' ? 'CASH' : 'SUMUP';
        if (!paymentMethods[method]) paymentMethods[method] = { count: 0, revenue: 0 };
        paymentMethods[method].count++;
        paymentMethods[method].revenue += sale.amountCents;

        const hour = new Date(sale.occurredAt).getHours();
        hourlyToday[hour].count++;
        hourlyToday[hour].revenue += sale.amountCents;
      }
    }

    const itemQtyToday: Record<string, { name: string; quantity: number; revenue: number }> = {};
    if (paidOrdersById.size > 0) {
      const periodItems = await prisma.orderItem.findMany({
        where: { orderId: { in: [...paidOrdersById.keys()] } },
        include: { menuItem: { select: { id: true, name: true } } },
      });
      for (const oi of periodItems) {
        const id = oi.menuItemId;
        if (!itemQtyToday[id]) {
          itemQtyToday[id] = { name: oi.menuItem.name, quantity: 0, revenue: 0 };
        }
        itemQtyToday[id].quantity += oi.quantity;
        itemQtyToday[id].revenue += oi.price * oi.quantity;
      }
    }
    // Comptoir SumUp — clé par nom d'article (pas de menuItemId, import CSV texte libre).
    const periodCounterItems = await getCounterSaleItems(prisma, businessId, periodFrom, periodTo);
    for (const ci of periodCounterItems) {
      const id = `sumup:${ci.description}`;
      if (!itemQtyToday[id]) {
        itemQtyToday[id] = { name: ci.description, quantity: 0, revenue: 0 };
      }
      itemQtyToday[id].quantity += ci.quantity;
      itemQtyToday[id].revenue += ci.amountCents;
    }

    const topItemsToday = Object.entries(itemQtyToday)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);

    const salesByDay: { date: string; count: number; total: number }[] = [];
    for (let i = spanDays - 1; i >= 0; i--) {
      const d = new Date(periodTo);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const dayOrders = [...paidOrdersById.values()].filter(
        o => new Date(o.createdAt).toISOString().slice(0, 10) === key
      );
      const daySales = periodCounterSales.filter(
        t => new Date(t.occurredAt).toISOString().slice(0, 10) === key
      );
      salesByDay.push({
        date: key,
        count: dayOrders.length + daySales.length,
        total:
          dayOrders.reduce((s, o) => s + o.total, 0) +
          daySales.reduce((s, t) => s + t.amountCents, 0),
      });
    }

    res.json({
      // Sans le comptoir, la carte "Commandes" affichait 0 alors que son propre sous-titre
      // "X payées" (todayPaidCount, qui lui inclut déjà le comptoir) disait le contraire —
      // contradiction visible dès qu'il n'y a aucune commande app, seulement du comptoir.
      todayOrders: periodOrdersCount + periodCounterSales.length,
      todayPaidCount,
      todayRevenue,
      avgBasketToday,
      pendingOrders,
      activeTables,
      totalItems,
      totalCategories,
      onlineToday,
      counterToday,
      recentOrders,
      recentCounterSales,
      topItemsToday,
      hourlyToday,
      orderTypes,
      paymentMethods,
      channelsToday,
      statusToday,
      salesByDay,
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/reports/customers-summary — clients agrégés par téléphone (365 j)
 */
router.get('/customers-summary', ...reportsRead, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma');
    const businessId = req.user!.businessId;
    const since = new Date();
    since.setDate(since.getDate() - 365);

    const orders = await prisma.order.findMany({
      where: {
        businessId,
        createdAt: { gte: since },
        customerPhone: { not: null },
        status: { not: 'CANCELLED' },
      },
      select: {
        customerPhone: true,
        customerName: true,
        customerEmail: true,
        total: true,
        paymentStatus: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const byPhone = new Map<
      string,
      {
        phone: string;
        name: string;
        email: string | null;
        orderCount: number;
        paidTotalCents: number;
        lastOrderAt: string;
      }
    >();

    for (const o of orders) {
      const phone = o.customerPhone?.trim();
      if (!phone) continue;
      // Même client, formats différents ("0612345678" vs "+33612345678" vs "06 12 34 56 78") :
      // on déduplique sur l'identité E.164 (déjà utilisée pour SMS/WhatsApp), pas juste les espaces,
      // sinon un même client apparaît deux fois et son historique/CA est sous-évalué.
      const key = normalizePhoneE164(phone);
      const existing = byPhone.get(key);
      const paid = o.paymentStatus === 'PAID' ? o.total : 0;
      const name = o.customerName?.trim() || null;
      if (!existing) {
        byPhone.set(key, {
          phone,
          name: name || 'Client',
          email: o.customerEmail,
          orderCount: 1,
          paidTotalCents: paid,
          lastOrderAt: o.createdAt.toISOString(),
        });
      } else {
        existing.orderCount++;
        existing.paidTotalCents += paid;
        if (existing.name === 'Client' && name) existing.name = name;
        if (!existing.email && o.customerEmail) existing.email = o.customerEmail;
      }
    }

    const customers = [...byPhone.values()].sort((a, b) => b.paidTotalCents - a.paidTotalCents);
    res.json({ customers });
  } catch (error) {
    console.error('[reports/customers-summary]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/reports/sales
 * Get sales data grouped by day, week, or month for a date range.
 * @query {from?: string, to?: string, groupBy?: 'day'|'week'|'month'}
 * @returns {Array<{date, count, total}>}
 */
router.get('/sales', ...reportsRead, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma');
    const businessId = req.user!.businessId;
    const { from, to, groupBy } = req.query;

    const dateFrom = from
      ? new Date(from as string)
      : new Date(new Date().setDate(new Date().getDate() - 30));
    const dateTo = to ? new Date(to as string) : new Date();

    const [orders, counterSales] = await Promise.all([
      prisma.order.findMany({
        where: {
          businessId,
          createdAt: { gte: dateFrom, lte: dateTo },
          paymentStatus: 'PAID',
        },
        orderBy: { createdAt: 'asc' },
      }),
      getCounterSales(prisma, businessId, dateFrom, dateTo),
    ]);

    const bucketKey = (d: Date): string => {
      if (groupBy === 'month') {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      }
      if (groupBy === 'week') {
        const startOfWeek = new Date(d);
        startOfWeek.setDate(d.getDate() - d.getDay());
        return startOfWeek.toISOString().slice(0, 10);
      }
      return d.toISOString().slice(0, 10);
    };

    // Group by day, week, or month — commandes app + ventes comptoir SumUp (pas de Order)
    const grouped: Record<string, { count: number; total: number; orders: number[] }> = {};
    for (const order of orders) {
      const key = bucketKey(new Date(order.createdAt));
      if (!grouped[key]) grouped[key] = { count: 0, total: 0, orders: [] };
      grouped[key].count++;
      grouped[key].total += order.total;
      grouped[key].orders.push(order.orderNumber);
    }
    for (const sale of counterSales) {
      const key = bucketKey(new Date(sale.occurredAt));
      if (!grouped[key]) grouped[key] = { count: 0, total: 0, orders: [] };
      grouped[key].count++;
      grouped[key].total += sale.amountCents;
    }

    const salesData = Object.entries(grouped)
      .map(([date, data]) => ({
        date,
        count: data.count,
        total: data.total,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    res.json(salesData);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/reports/categories
 * Get category-level sales report with total sold and revenue.
 * @query {from?: string, to?: string}
 * @returns {Array<{id, name, nameAr, totalSold, revenue}>}
 */
router.get('/categories', ...reportsRead, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma');
    const businessId = req.user!.businessId;
    const { from, to } = req.query;

    const dateFrom = from ? new Date(from as string) : new Date(0);
    const dateTo = to ? new Date(to as string) : new Date();

    const [categories, counterItems] = await Promise.all([
      prisma.menuCategory.findMany({
        where: { businessId, isActive: true },
        include: {
          items: {
            include: {
              orderItems: {
                where: {
                  order: {
                    createdAt: { gte: dateFrom, lte: dateTo },
                    paymentStatus: 'PAID',
                  },
                },
              },
            },
          },
        },
      }),
      getCounterSaleItems(prisma, businessId, dateFrom, dateTo),
    ]);

    const categoryData = categories.map(cat => {
      const totalSold = cat.items.reduce((sum, item) => {
        return sum + item.orderItems.reduce((s, oi) => s + oi.quantity, 0);
      }, 0);
      const revenue = cat.items.reduce((sum, item) => {
        return sum + item.orderItems.reduce((s, oi) => s + oi.price * oi.quantity, 0);
      }, 0);
      return {
        id: cat.id,
        name: cat.name,
        nameAr: cat.nameAr,
        totalSold,
        revenue,
      };
    });

    // Comptoir SumUp — catégorie en texte libre (import CSV), pas un vrai MenuCategory :
    // ajoutées à part plutôt que rapprochées par nom (fragile, taxonomies différentes).
    const counterByCategory = new Map<string, { totalSold: number; revenue: number }>();
    for (const item of counterItems) {
      const key = item.category?.trim() || 'Comptoir (sans catégorie)';
      const row = counterByCategory.get(key) ?? { totalSold: 0, revenue: 0 };
      row.totalSold += item.quantity;
      row.revenue += item.amountCents;
      counterByCategory.set(key, row);
    }
    for (const [name, row] of counterByCategory) {
      categoryData.push({ id: `sumup:${name}`, name, nameAr: null, ...row });
    }

    res.json(categoryData);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/reports/employees
 * Get employee performance report with order count and total sales.
 * @query {from?: string, to?: string}
 * @returns {Array<{id, name, role, orderCount, totalSales}>}
 */
router.get('/employees', ...reportsRead, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma');
    const businessId = req.user!.businessId;
    const { from, to } = req.query;

    const dateFrom = from ? new Date(from as string) : new Date(0);
    const dateTo = to ? new Date(to as string) : new Date();

    const employees = await prisma.user.findMany({
      where: { businessId, isActive: true, role: { not: 'ADMIN' } },
      select: {
        id: true,
        name: true,
        role: true,
        orders: {
          where: {
            createdAt: { gte: dateFrom, lte: dateTo },
            paymentStatus: 'PAID',
          },
          select: { id: true, total: true },
        },
      },
    });

    const employeeData = employees.map(emp => ({
      id: emp.id,
      name: emp.name,
      role: emp.role,
      orderCount: emp.orders.length,
      totalSales: emp.orders.reduce((sum, o) => sum + o.total, 0),
    }));

    res.json(employeeData);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/reports/drivers
 * Performance livreurs (commandes livraison payées assignées).
 */
router.get('/drivers', ...reportsRead, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma');
    const businessId = req.user!.businessId;
    const { from, to } = req.query;

    const dateFrom = from ? new Date(from as string) : new Date(0);
    const dateTo = to ? new Date(to as string) : new Date();

    const drivers = await prisma.user.findMany({
      where: { businessId, isActive: true, role: 'DRIVER' },
      select: {
        id: true,
        name: true,
        driverOrders: {
          where: {
            createdAt: { gte: dateFrom, lte: dateTo },
            paymentStatus: 'PAID',
            type: 'DELIVERY',
          },
          select: { id: true, total: true, status: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    const driverData = drivers.map(d => ({
      id: d.id,
      name: d.name,
      deliveryCount: d.driverOrders.length,
      deliveredCount: d.driverOrders.filter(
        o => o.status === 'DELIVERED' || o.status === 'COMPLETED'
      ).length,
      totalSales: d.driverOrders.reduce((sum, o) => sum + o.total, 0),
    }));

    res.json(driverData);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/reports/items-performance
 * Get item-level performance with quantity, revenue, and hourly distribution.
 * @query {from?: string, to?: string}
 * @returns {Array<{id, name, nameAr, quantity, revenue, orders, hourly, avgPerOrder}>}
 */
router.get('/items-performance', ...reportsRead, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma');
    const businessId = req.user!.businessId;
    const { from, to } = req.query;

    const dateFrom = from
      ? new Date(from as string)
      : new Date(new Date().setDate(new Date().getDate() - 30));
    const dateTo = to ? new Date(to as string) : new Date();

    const [orderItems, counterItems] = await Promise.all([
      prisma.orderItem.findMany({
        where: {
          order: {
            businessId,
            createdAt: { gte: dateFrom, lte: dateTo },
            paymentStatus: 'PAID',
          },
        },
        include: {
          menuItem: { select: { id: true, name: true, nameAr: true, price: true } },
          order: { select: { createdAt: true } },
        },
      }),
      getCounterSaleItems(prisma, businessId, dateFrom, dateTo),
    ]);

    // Aggregate by item
    const itemMap: Record<
      string,
      {
        name: string;
        nameAr: string;
        quantity: number;
        revenue: number;
        orders: number;
        hourly: number[];
      }
    > = {};
    for (const oi of orderItems) {
      const id = oi.menuItemId;
      if (!itemMap[id]) {
        itemMap[id] = {
          name: oi.menuItem.name,
          nameAr: oi.menuItem.nameAr || '',
          quantity: 0,
          revenue: 0,
          orders: 0,
          hourly: new Array(24).fill(0),
        };
      }
      itemMap[id].quantity += oi.quantity;
      itemMap[id].revenue += oi.price * oi.quantity;
      itemMap[id].orders++;
      const hour = new Date(oi.order.createdAt).getHours();
      itemMap[id].hourly[hour]++;
    }
    // Comptoir SumUp — pas de menuItemId (import CSV en texte libre), clé par nom d'article ;
    // fusionne naturellement avec un article du menu qui porterait le même nom.
    for (const ci of counterItems) {
      const id = `sumup:${ci.description}`;
      if (!itemMap[id]) {
        itemMap[id] = {
          name: ci.description,
          nameAr: '',
          quantity: 0,
          revenue: 0,
          orders: 0,
          hourly: new Array(24).fill(0),
        };
      }
      itemMap[id].quantity += ci.quantity;
      itemMap[id].revenue += ci.amountCents;
      itemMap[id].orders++;
      itemMap[id].hourly[ci.occurredAt.getHours()]++;
    }

    const items = Object.entries(itemMap)
      .map(([id, data]) => ({
        id,
        ...data,
        avgPerOrder: data.orders > 0 ? data.quantity / data.orders : 0,
      }))
      .sort((a, b) => b.quantity - a.quantity);

    res.json(items);
  } catch (error) {
    console.error('Items performance error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/reports/peak-hours
 * Get hourly and day-of-week order distribution for peak time analysis.
 * @query {from?: string, to?: string}
 * @returns {hourly: Array<{hour, count, revenue}>, dow: Array<{day, count, revenue}>}
 */
router.get('/peak-hours', ...reportsRead, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma');
    const businessId = req.user!.businessId;
    const { from, to } = req.query;

    const dateFrom = from
      ? new Date(from as string)
      : new Date(new Date().setDate(new Date().getDate() - 30));
    const dateTo = to ? new Date(to as string) : new Date();

    const [orders, counterSales] = await Promise.all([
      prisma.order.findMany({
        where: {
          businessId,
          paymentStatus: 'PAID',
          createdAt: { gte: dateFrom, lte: dateTo },
        },
        select: { createdAt: true, total: true },
      }),
      getCounterSales(prisma, businessId, dateFrom, dateTo),
    ]);

    const hourly: { hour: number; count: number; revenue: number }[] = [];
    for (let h = 0; h < 24; h++) {
      hourly.push({ hour: h, count: 0, revenue: 0 });
    }

    for (const order of orders) {
      const hour = new Date(order.createdAt).getHours();
      hourly[hour].count++;
      hourly[hour].revenue += order.total;
    }
    for (const sale of counterSales) {
      const hour = new Date(sale.occurredAt).getHours();
      hourly[hour].count++;
      hourly[hour].revenue += sale.amountCents;
    }

    const dow: { day: number; count: number; revenue: number }[] = [];
    for (let d = 0; d < 7; d++) {
      dow.push({ day: d, count: 0, revenue: 0 });
    }

    for (const order of orders) {
      const day = new Date(order.createdAt).getDay();
      dow[day].count++;
      dow[day].revenue += order.total;
    }
    for (const sale of counterSales) {
      const day = new Date(sale.occurredAt).getDay();
      dow[day].count++;
      dow[day].revenue += sale.amountCents;
    }

    res.json({ hourly, dow });
  } catch (error) {
    console.error('Peak hours error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/reports/payment-methods
 * Get payment method breakdown with count and revenue.
 * @query {from?: string, to?: string}
 * @returns {Record<string, {count, revenue}>}
 */
router.get('/payment-methods', ...reportsRead, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma');
    const businessId = req.user!.businessId;
    const { from, to } = req.query;

    const dateFrom = from ? new Date(from as string) : new Date(0);
    const dateTo = to ? new Date(to as string) : new Date();

    const [orders, counterSales] = await Promise.all([
      prisma.order.findMany({
        where: {
          businessId,
          paymentStatus: 'PAID',
          createdAt: { gte: dateFrom, lte: dateTo },
        },
        select: { paymentMethod: true, total: true },
      }),
      getCounterSales(prisma, businessId, dateFrom, dateTo),
    ]);

    const methods: Record<string, { count: number; revenue: number }> = {};
    for (const order of orders) {
      const method = order.paymentMethod || 'UNKNOWN';
      if (!methods[method]) methods[method] = { count: 0, revenue: 0 };
      methods[method].count++;
      methods[method].revenue += order.total;
    }
    // Ventes comptoir SumUp — pas de paymentMethod sur Order (aucune Order créée) : CASH
    // rejoint le même libellé que les espèces app, POS (carte SumUp) a son propre libellé.
    for (const sale of counterSales) {
      const method = sale.paymentType === 'CASH' ? 'CASH' : 'SUMUP';
      if (!methods[method]) methods[method] = { count: 0, revenue: 0 };
      methods[method].count++;
      methods[method].revenue += sale.amountCents;
    }

    res.json(methods);
  } catch (error) {
    console.error('Payment methods error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/reports/order-types
 * Répartition livraison / emporter / sur place.
 */
router.get('/order-types', ...reportsRead, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma');
    const businessId = req.user!.businessId;
    const { from, to } = req.query;

    const dateFrom = from
      ? new Date(from as string)
      : new Date(new Date().setDate(new Date().getDate() - 30));
    const dateTo = to ? new Date(to as string) : new Date();

    const [orders, counterSales] = await Promise.all([
      prisma.order.findMany({
        where: {
          businessId,
          paymentStatus: 'PAID',
          createdAt: { gte: dateFrom, lte: dateTo },
        },
        select: { type: true, total: true, isOnlineOrder: true },
      }),
      getCounterSales(prisma, businessId, dateFrom, dateTo),
    ]);

    const types: Record<string, { count: number; revenue: number }> = {};
    for (const order of orders) {
      const type = order.type || 'DINE_IN';
      if (!types[type]) types[type] = { count: 0, revenue: 0 };
      types[type].count++;
      types[type].revenue += order.total;
    }
    // Comptoir SumUp — pas de "type" de commande (pas de Order) : bucket dédié.
    if (counterSales.length > 0) {
      types.COMPTOIR = {
        count: counterSales.length,
        revenue: counterSales.reduce((s, t) => s + t.amountCents, 0),
      };
    }

    res.json(types);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
