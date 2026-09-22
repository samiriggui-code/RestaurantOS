/**
 * Chantier 4 — dashboard unifié ventes vs dépenses. Assemble ce que les chantiers
 * 1/2/3 ont posé : ventes en ligne (Order), ventes comptoir (cache SumupTransaction),
 * dépenses manuelles (Expense) et factures fournisseurs (cache PennylaneSupplierInvoice).
 * Rien de nouveau côté source de données — uniquement de l'agrégation en lecture.
 */
import type { PrismaClient } from '@prisma/client';

export type SalesVsExpensesParams = { from: Date; to: Date };

export type SalesVsExpensesResult = {
  period: { from: string; to: string };
  sales: { onlineCents: number; counterCents: number; totalCents: number };
  expenses: { manualCents: number; supplierInvoicesCents: number; totalCents: number };
  netCents: number;
  losses: { cancelledOrdersCount: number; cancelledOrdersValueCents: number };
  undeliveredOrders: {
    count: number;
    orders: Array<{
      id: string;
      orderNumber: number;
      status: string;
      total: number;
      customerName: string | null;
      deliveryIssueReason: string | null;
    }>;
  };
  refunds: { count: number; totalCents: number };
};

export async function computeSalesVsExpenses(
  prisma: PrismaClient,
  businessId: string,
  { from, to }: SalesVsExpensesParams
): Promise<SalesVsExpensesResult> {
  const createdAtInPeriod = { gte: from, lte: to };

  const [
    onlineSalesAgg,
    counterSalesAgg,
    manualExpensesAgg,
    supplierInvoicesAgg,
    cancelledOrdersAgg,
    refundedOrdersAgg,
    undeliveredOrdersCount,
    undeliveredOrders,
  ] = await Promise.all([
    // channel: 'WEB' — seules les commandes du site créent une ligne Order. Le comptoir
    // (POS/espèces) n'a plus de source d'écriture ici depuis le pivot SumUp : sans ce filtre,
    // une commande comptoir historique (test, ou régression future) serait comptée deux fois
    // — une fois ici en « online », une fois dans le cache SumupTransaction ci-dessous.
    prisma.order.aggregate({
      where: {
        businessId,
        channel: 'WEB',
        paymentStatus: 'PAID',
        createdAt: createdAtInPeriod,
        // Commandes de test en mode formation (ticket fiscal TRAINING, exclu des clôtures Z
        // — cf. fiscal/ticket.ts) : le CGI interdit de supprimer une ligne dès qu'un ticket
        // fiscal existe (immuable), donc on les exclut du CA au lieu de les effacer.
        NOT: { fiscalTickets: { some: { kind: 'TRAINING' } } },
      },
      _sum: { total: true },
    }),
    prisma.sumupTransaction.aggregate({
      where: {
        businessId,
        paymentType: { in: ['POS', 'CASH'] },
        // Exclut les tentatives de paiement refusées (carte déclinée, réessai) — le journal
        // officiel SumUp ne les compte pas non plus, vérifié transaction par transaction.
        status: 'SUCCESSFUL',
        occurredAt: createdAtInPeriod,
      },
      _sum: { amountCents: true },
    }),
    prisma.expense.aggregate({
      where: { businessId, date: createdAtInPeriod },
      _sum: { amount: true },
    }),
    prisma.pennylaneSupplierInvoice.aggregate({
      where: { businessId, date: createdAtInPeriod },
      _sum: { amountCents: true },
    }),
    prisma.order.aggregate({
      where: { businessId, status: 'CANCELLED', createdAt: createdAtInPeriod },
      _sum: { total: true },
      _count: true,
    }),
    prisma.order.aggregate({
      where: { businessId, paymentStatus: 'REFUNDED', createdAt: createdAtInPeriod },
      _sum: { total: true },
      _count: true,
    }),
    prisma.order.count({
      where: { businessId, status: 'DELIVERY_ISSUE', createdAt: createdAtInPeriod },
    }),
    prisma.order.findMany({
      where: { businessId, status: 'DELIVERY_ISSUE', createdAt: createdAtInPeriod },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        total: true,
        customerName: true,
        deliveryIssueReason: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
  ]);

  const onlineCents = onlineSalesAgg._sum.total ?? 0;
  const counterCents = counterSalesAgg._sum.amountCents ?? 0;
  const manualCents = manualExpensesAgg._sum.amount ?? 0;
  const supplierInvoicesCents = supplierInvoicesAgg._sum.amountCents ?? 0;
  const salesTotalCents = onlineCents + counterCents;
  const expensesTotalCents = manualCents + supplierInvoicesCents;

  return {
    period: { from: from.toISOString(), to: to.toISOString() },
    sales: { onlineCents, counterCents, totalCents: salesTotalCents },
    expenses: { manualCents, supplierInvoicesCents, totalCents: expensesTotalCents },
    netCents: salesTotalCents - expensesTotalCents,
    losses: {
      cancelledOrdersCount: cancelledOrdersAgg._count,
      cancelledOrdersValueCents: cancelledOrdersAgg._sum.total ?? 0,
    },
    undeliveredOrders: { count: undeliveredOrdersCount, orders: undeliveredOrders },
    refunds: {
      count: refundedOrdersAgg._count,
      totalCents: refundedOrdersAgg._sum.total ?? 0,
    },
  };
}
