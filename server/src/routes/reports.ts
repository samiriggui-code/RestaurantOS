import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth';
import { AuthRequest } from '../types';
import { effectiveOrderChannel } from '../lib/order-channel';
import { UNPAID_PENDING_ORDER_FILTER } from '../lib/order-list-filters';
import { renderSalesReportHtml } from '../lib/report-document-service';
import { PERMISSION, requirePermission } from '../lib/permissions';

const router = Router();

const reportsRead = [authenticate, requirePermission(PERMISSION.REPORTS_READ)] as const;

/**
 * GET /api/reports/print — rapport ventes HTML (React Email, prêt PDF)
 */
router.get('/print', ...reportsRead, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma');
    const period = Math.min(parseInt(String(req.query.period ?? '7'), 10) || 7, 90);
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - period);
    const html = await renderSalesReportHtml(prisma, req.user!.businessId, from, to);
    res.type('text/html; charset=utf-8').send(html);
  } catch (error) {
    console.error('[reports/print]', error);
    res.status(500).json({ error: 'Génération rapport impossible' });
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
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);

    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - 6);

    const [
      todayOrdersCount,
      todayRevenueAgg,
      pendingOrders,
      activeTables,
      totalItems,
      totalCategories,
      recentOrders,
      todayOrdersDetail,
      weekPaidOrders,
    ] = await Promise.all([
      prisma.order.count({
        where: { businessId, createdAt: { gte: today, lte: todayEnd } },
      }),
      prisma.order.aggregate({
        where: { businessId, createdAt: { gte: today, lte: todayEnd }, paymentStatus: 'PAID' },
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
        take: 10,
        include: {
          items: { include: { menuItem: true } },
          table: true,
        },
      }),
      prisma.order.findMany({
        where: { businessId, createdAt: { gte: today, lte: todayEnd } },
        select: {
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
      prisma.order.findMany({
        where: {
          businessId,
          createdAt: { gte: weekStart, lte: todayEnd },
          paymentStatus: 'PAID',
        },
        select: { createdAt: true, total: true },
      }),
    ]);

    const todayRevenue = todayRevenueAgg._sum.total || 0;
    const todayPaidCount = todayRevenueAgg._count || 0;
    const avgBasketToday = todayPaidCount > 0 ? Math.round(todayRevenue / todayPaidCount) : 0;

    const hourlyToday: { hour: number; count: number; revenue: number }[] = [];
    for (let h = 18; h <= 23; h++) {
      hourlyToday.push({ hour: h, count: 0, revenue: 0 });
    }

    const orderTypes: Record<string, { count: number; revenue: number }> = {};
    const paymentMethods: Record<string, { count: number; revenue: number }> = {};
    const channelsToday: Record<string, { count: number; revenue: number }> = {};
    const statusToday: Record<string, number> = {};
    let onlineToday = 0;
    let counterToday = 0;

    const itemQtyToday: Record<string, { name: string; quantity: number; revenue: number }> = {};

    for (const order of todayOrdersDetail) {
      statusToday[order.status] = (statusToday[order.status] ?? 0) + 1;
      if (order.isOnlineOrder) onlineToday++;
      else counterToday++;

      if (order.paymentStatus === 'PAID') {
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
        const slot = hourlyToday.find(h => h.hour === hour);
        if (slot) {
          slot.count++;
          slot.revenue += order.total;
        }
      }
    }

    const todayOrderIds = await prisma.order.findMany({
      where: { businessId, createdAt: { gte: today, lte: todayEnd }, paymentStatus: 'PAID' },
      select: { id: true },
    });
    if (todayOrderIds.length > 0) {
      const todayItems = await prisma.orderItem.findMany({
        where: { orderId: { in: todayOrderIds.map(o => o.id) } },
        include: { menuItem: { select: { id: true, name: true } } },
      });
      for (const oi of todayItems) {
        const id = oi.menuItemId;
        if (!itemQtyToday[id]) {
          itemQtyToday[id] = { name: oi.menuItem.name, quantity: 0, revenue: 0 };
        }
        itemQtyToday[id].quantity += oi.quantity;
        itemQtyToday[id].revenue += oi.price * oi.quantity;
      }
    }

    const topItemsToday = Object.entries(itemQtyToday)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 8);

    const salesByDay: { date: string; count: number; total: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const dayOrders = weekPaidOrders.filter(
        o => new Date(o.createdAt).toISOString().slice(0, 10) === key
      );
      salesByDay.push({
        date: key,
        count: dayOrders.length,
        total: dayOrders.reduce((s, o) => s + o.total, 0),
      });
    }

    res.json({
      todayOrders: todayOrdersCount,
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
      const key = phone.replace(/\s/g, '');
      const existing = byPhone.get(key);
      const paid = o.paymentStatus === 'PAID' ? o.total : 0;
      if (!existing) {
        byPhone.set(key, {
          phone,
          name: o.customerName?.trim() || 'Client',
          email: o.customerEmail,
          orderCount: 1,
          paidTotalCents: paid,
          lastOrderAt: o.createdAt.toISOString(),
        });
      } else {
        existing.orderCount++;
        existing.paidTotalCents += paid;
        if (!existing.name && o.customerName) existing.name = o.customerName.trim();
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

    const orders = await prisma.order.findMany({
      where: {
        businessId,
        createdAt: { gte: dateFrom, lte: dateTo },
        paymentStatus: 'PAID',
      },
      orderBy: { createdAt: 'asc' },
    });

    // Group by day, week, or month
    const grouped: Record<string, { count: number; total: number; orders: number[] }> = {};
    for (const order of orders) {
      let key: string;
      const d = new Date(order.createdAt);
      if (groupBy === 'month') {
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      } else if (groupBy === 'week') {
        const startOfWeek = new Date(d);
        startOfWeek.setDate(d.getDate() - d.getDay());
        key = startOfWeek.toISOString().slice(0, 10);
      } else {
        key = d.toISOString().slice(0, 10);
      }

      if (!grouped[key]) grouped[key] = { count: 0, total: 0, orders: [] };
      grouped[key].count++;
      grouped[key].total += order.total;
      grouped[key].orders.push(order.orderNumber);
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

    const categories = await prisma.menuCategory.findMany({
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
    });

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

    const orderItems = await prisma.orderItem.findMany({
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
    });

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

    const orders = await prisma.order.findMany({
      where: {
        businessId,
        paymentStatus: 'PAID',
        createdAt: { gte: dateFrom, lte: dateTo },
      },
      select: { createdAt: true, total: true },
    });

    const hourly: { hour: number; count: number; revenue: number }[] = [];
    for (let h = 0; h < 24; h++) {
      hourly.push({ hour: h, count: 0, revenue: 0 });
    }

    for (const order of orders) {
      const hour = new Date(order.createdAt).getHours();
      hourly[hour].count++;
      hourly[hour].revenue += order.total;
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

    const orders = await prisma.order.findMany({
      where: {
        businessId,
        paymentStatus: 'PAID',
        createdAt: { gte: dateFrom, lte: dateTo },
      },
      select: { paymentMethod: true, total: true },
    });

    const methods: Record<string, { count: number; revenue: number }> = {};
    for (const order of orders) {
      const method = order.paymentMethod || 'UNKNOWN';
      if (!methods[method]) methods[method] = { count: 0, revenue: 0 };
      methods[method].count++;
      methods[method].revenue += order.total;
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

    const orders = await prisma.order.findMany({
      where: {
        businessId,
        paymentStatus: 'PAID',
        createdAt: { gte: dateFrom, lte: dateTo },
      },
      select: { type: true, total: true, isOnlineOrder: true },
    });

    const types: Record<string, { count: number; revenue: number }> = {};
    for (const order of orders) {
      const type = order.type || 'DINE_IN';
      if (!types[type]) types[type] = { count: 0, revenue: 0 };
      types[type].count++;
      types[type].revenue += order.total;
    }

    res.json(types);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
