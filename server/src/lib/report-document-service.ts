import type { PrismaClient } from '@prisma/client';
import { ReportDocument, type ReportTableSection } from '../emails/report-document';
import { businessDocumentContext } from './business-document-context';
import { renderPrintDocument } from './document-render';
import { formatEUR } from './money';
import { getCounterSales, getCounterSaleItems } from './sumup-counter-sales';
import { isModuleEnabled } from './modules';

export async function renderSalesReportHtml(
  prisma: PrismaClient,
  businessId: string,
  from: Date,
  to: Date
): Promise<string> {
  const biz = await businessDocumentContext(prisma, businessId);
  const days = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)));

  const [orders, counterSales] = await Promise.all([
    prisma.order.findMany({
      where: { businessId, paymentStatus: 'PAID', createdAt: { gte: from, lte: to } },
      select: { createdAt: true, total: true },
      orderBy: { createdAt: 'asc' },
    }),
    getCounterSales(prisma, businessId, from, to),
  ]);

  const grouped = new Map<string, { count: number; total: number }>();
  for (const o of orders) {
    const key = new Date(o.createdAt).toISOString().slice(0, 10);
    const row = grouped.get(key) ?? { count: 0, total: 0 };
    row.count++;
    row.total += o.total;
    grouped.set(key, row);
  }
  // Ventes comptoir SumUp — aucune Order créée pour ces ventes, à ajouter séparément.
  for (const sale of counterSales) {
    const key = new Date(sale.occurredAt).toISOString().slice(0, 10);
    const row = grouped.get(key) ?? { count: 0, total: 0 };
    row.count++;
    row.total += sale.amountCents;
    grouped.set(key, row);
  }

  const totalSales =
    orders.reduce((s, o) => s + o.total, 0) + counterSales.reduce((s, t) => s + t.amountCents, 0);
  const totalOrders = orders.length + counterSales.length;

  const posEnabled = isModuleEnabled('pos');

  const [employees, drivers, itemPerf, counterItems] = await Promise.all([
    // "Performance équipe" lit Order.cashierId, renseigné uniquement par les routes du
    // module POS (désactivé) — inutile d'interroger si la section ne sera pas affichée.
    posEnabled
      ? prisma.user.findMany({
          where: { businessId, isActive: true, role: { not: 'ADMIN' } },
          select: {
            name: true,
            role: true,
            orders: {
              where: { paymentStatus: 'PAID', createdAt: { gte: from, lte: to } },
              select: { total: true },
            },
          },
        })
      : Promise.resolve([]),
    prisma.user.findMany({
      where: { businessId, isActive: true, role: 'DRIVER' },
      select: {
        name: true,
        driverOrders: {
          where: {
            paymentStatus: 'PAID',
            type: 'DELIVERY',
            createdAt: { gte: from, lte: to },
          },
          select: { total: true, status: true },
        },
      },
    }),
    prisma.orderItem.findMany({
      where: { order: { businessId, paymentStatus: 'PAID', createdAt: { gte: from, lte: to } } },
      select: { quantity: true, menuItem: { select: { name: true } } },
    }),
    // Comptoir SumUp — sans ça, "Top articles vendus" ignore tout ce qui se vend au
    // comptoir alors que "Ventes par article" (page Rapports) les inclut déjà.
    getCounterSaleItems(prisma, businessId, from, to),
  ]);

  const itemQty = new Map<string, number>();
  for (const row of itemPerf) {
    const name = row.menuItem.name;
    itemQty.set(name, (itemQty.get(name) ?? 0) + row.quantity);
  }
  for (const row of counterItems) {
    itemQty.set(row.description, (itemQty.get(row.description) ?? 0) + row.quantity);
  }
  const topItems = [...itemQty.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);

  const sections: ReportTableSection[] = [
    {
      title: 'Détail journalier',
      columns: ['Date', 'Commandes', 'CA', 'Panier moy.'],
      alignRightFrom: 1,
      rows: [...grouped.entries()]
        .sort((a, b) => b[0].localeCompare(a[0]))
        .map(([date, data]) => [
          new Date(date).toLocaleDateString('fr-FR', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
          }),
          String(data.count),
          formatEUR(data.total),
          data.count > 0 ? formatEUR(Math.round(data.total / data.count)) : '—',
        ]),
    },
    ...(posEnabled
      ? [
          {
            title: 'Performance équipe (caisse)',
            columns: ['Employé', 'Rôle', 'Commandes', 'CA'],
            alignRightFrom: 2,
            rows: employees
              .filter(e => e.orders.length > 0)
              .sort(
                (a, b) =>
                  b.orders.reduce((s, o) => s + o.total, 0) -
                  a.orders.reduce((s, o) => s + o.total, 0)
              )
              .map(e => [
                e.name,
                e.role,
                String(e.orders.length),
                formatEUR(e.orders.reduce((s, o) => s + o.total, 0)),
              ]),
          } satisfies ReportTableSection,
        ]
      : []),
    {
      title: 'Performance livreurs',
      columns: ['Livreur', 'Courses', 'Livrées', 'CA'],
      alignRightFrom: 1,
      rows: drivers
        .filter(d => d.driverOrders.length > 0)
        .map(d => [
          d.name,
          String(d.driverOrders.length),
          String(
            d.driverOrders.filter(o => o.status === 'DELIVERED' || o.status === 'COMPLETED').length
          ),
          formatEUR(d.driverOrders.reduce((s, o) => s + o.total, 0)),
        ]),
    },
    {
      title: 'Top articles vendus',
      columns: ['Article', 'Quantité'],
      alignRightFrom: 1,
      rows: topItems.map(([name, qty]) => [name, String(qty)]),
    },
  ];

  return renderPrintDocument(
    ReportDocument({
      ...biz,
      reportTitle: 'Rapport des ventes',
      periodLabel: `${days} derniers jours`,
      stats: [
        { label: "Chiffre d'affaires", value: formatEUR(totalSales) },
        { label: 'Commandes payées', value: String(totalOrders) },
        {
          label: 'Panier moyen',
          value: totalOrders > 0 ? formatEUR(Math.round(totalSales / totalOrders)) : formatEUR(0),
        },
      ],
      sections,
    })
  );
}
