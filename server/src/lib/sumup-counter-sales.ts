/**
 * Ventes comptoir SumUp (cache SumupTransaction) pour une période — brique partagée par
 * les endpoints de rapports (/dashboard, /sales, /payment-methods, /peak-hours) qui, avant,
 * ne lisaient que la table Order et ratissaient donc large sur le CA en oubliant le comptoir
 * (ces ventes ne créent aucune Order — elles vivent uniquement dans ce cache).
 * Même filtre que sales-vs-expenses.ts : SUCCESSFUL uniquement (exclut les paiements refusés,
 * absents du journal officiel SumUp), POS/CASH uniquement (ECOM = déjà compté via Order).
 */
import type { PrismaClient } from '@prisma/client';

export type CounterSaleRow = {
  occurredAt: Date;
  amountCents: number;
  paymentType: string;
};

export async function getCounterSales(
  prisma: PrismaClient,
  businessId: string,
  from: Date,
  to: Date
): Promise<CounterSaleRow[]> {
  return prisma.sumupTransaction.findMany({
    where: {
      businessId,
      status: 'SUCCESSFUL',
      paymentType: { in: ['POS', 'CASH'] },
      occurredAt: { gte: from, lte: to },
    },
    select: { occurredAt: true, amountCents: true, paymentType: true },
  });
}

export type CounterSaleItemRow = {
  description: string;
  category: string | null;
  quantity: number;
  amountCents: number;
  occurredAt: Date;
};

/**
 * Détail article des ventes comptoir SumUp — vient uniquement de l'import manuel du
 * "Rapport de ventes" (`sumup-sales-journal-import.ts`). Une transaction non importée
 * n'a simplement aucune ligne ici — pas d'erreur, juste absente des rapports par article.
 */
export async function getCounterSaleItems(
  prisma: PrismaClient,
  businessId: string,
  from: Date,
  to: Date
): Promise<CounterSaleItemRow[]> {
  const rows = await prisma.sumupTransactionItem.findMany({
    where: {
      transaction: {
        businessId,
        status: 'SUCCESSFUL',
        paymentType: { in: ['POS', 'CASH'] },
        occurredAt: { gte: from, lte: to },
      },
    },
    select: {
      description: true,
      category: true,
      quantity: true,
      amountCents: true,
      transaction: { select: { occurredAt: true } },
    },
  });
  return rows.map(r => ({
    description: r.description,
    category: r.category,
    quantity: r.quantity,
    amountCents: r.amountCents,
    occurredAt: r.transaction.occurredAt,
  }));
}
