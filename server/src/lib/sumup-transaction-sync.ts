/**
 * Cache local des transactions SumUp (comptoir POS/CASH + en ligne ECOM) — fondation
 * partagée par la facturation B2C à la demande et le futur dashboard ventes/dépenses.
 * Pas d'appel à la demande : on tire l'historique SumUp en tâche de fond et on le
 * stocke, avec un statut "facturée ou non" par transaction (Invoice liée ou non).
 */

import type { PrismaClient, Prisma, SumupTransaction } from '@prisma/client';
import {
  getSumupTransactionHistory,
  type SumupTransaction as SumupApiTransaction,
} from './sumup-transactions';

export const PAGE_LIMIT = 1000;
/** Chevauchement à la reprise pour ne rater aucune transaction proche de la dernière synchro. */
const OVERLAP_MS = 30 * 60 * 1000;
/** Profondeur de la toute première synchro pour un business. */
const INITIAL_LOOKBACK_MS = 30 * 24 * 60 * 60 * 1000;

function toCents(amount: number | undefined): number | null {
  if (amount === undefined || amount === null) return null;
  return Math.round(amount * 100);
}

function toCentsRequired(amount: number): number {
  return Math.round(amount * 100);
}

async function latestCachedOccurredAt(
  prisma: PrismaClient,
  businessId: string
): Promise<Date | null> {
  const latest = await prisma.sumupTransaction.findFirst({
    where: { businessId },
    orderBy: { occurredAt: 'desc' },
    select: { occurredAt: true },
  });
  return latest?.occurredAt ?? null;
}

function upsertData(
  businessId: string,
  t: SumupApiTransaction
): Prisma.SumupTransactionUncheckedCreateInput {
  return {
    businessId,
    sumupTransactionId: t.id,
    transactionCode: t.transaction_code ?? null,
    amountCents: toCentsRequired(t.amount),
    vatAmountCents: toCents(t.vat_amount),
    feeAmountCents: toCents(t.fee_amount),
    currency: t.currency,
    paymentType: t.payment_type,
    status: t.status,
    productSummary: t.product_summary ?? null,
    occurredAt: new Date(t.timestamp),
    raw: t as unknown as Prisma.InputJsonValue,
  };
}

/**
 * L'API SumUp ne renvoie jamais `product_summary` (confirmé par inspection directe du
 * payload) — seul l'import manuel du journal de ventes (`sumup-sales-journal-import.ts`)
 * le renseigne. Si la synchro écrasait ce champ à chaque passage, elle effacerait le détail
 * produit importé à chaque resynchro (bug rapporté : "conflit entre synchro API et import CSV").
 * On ne touche donc à `productSummary` que si l'API en fournit vraiment un un jour.
 */
function updateData(
  businessId: string,
  t: SumupApiTransaction
): Prisma.SumupTransactionUncheckedUpdateInput {
  const { productSummary, ...rest } = upsertData(businessId, t);
  return t.product_summary ? { ...rest, productSummary } : rest;
}

export type SumupTransactionSyncResult = {
  synced: number;
  pages: number;
  oldestTime: string;
  newestTime: string;
};

/**
 * Tire l'historique SumUp depuis la dernière transaction connue (ou 30 jours en arrière
 * si première synchro) jusqu'à maintenant, et upsert chaque transaction dans le cache.
 * Idempotent — rejouable sans créer de doublons (unique businessId+sumupTransactionId).
 */
export async function syncSumupTransactions(
  prisma: PrismaClient,
  businessId: string
): Promise<SumupTransactionSyncResult> {
  const now = new Date();
  const latest = await latestCachedOccurredAt(prisma, businessId);
  let oldestTime = latest
    ? new Date(latest.getTime() - OVERLAP_MS)
    : new Date(now.getTime() - INITIAL_LOOKBACK_MS);
  const newestTime = now;
  const oldestTimeStart = oldestTime.toISOString();

  let synced = 0;
  let pages = 0;

  for (;;) {
    const { items } = await getSumupTransactionHistory({
      oldestTime: oldestTime.toISOString(),
      newestTime: newestTime.toISOString(),
      limit: PAGE_LIMIT,
      order: 'ascending',
    });
    pages += 1;

    if (items.length === 0) break;

    for (const t of items) {
      await prisma.sumupTransaction.upsert({
        where: { businessId_sumupTransactionId: { businessId, sumupTransactionId: t.id } },
        create: upsertData(businessId, t),
        update: updateData(businessId, t),
      });
      synced += 1;
    }

    if (items.length < PAGE_LIMIT) break;

    const lastTimestamp = new Date(items[items.length - 1].timestamp);
    if (lastTimestamp.getTime() <= oldestTime.getTime()) break; // évite une boucle infinie
    oldestTime = lastTimestamp;
  }

  return { synced, pages, oldestTime: oldestTimeStart, newestTime: newestTime.toISOString() };
}

export type SumupTransactionListFilter = {
  billed?: 'billed' | 'unbilled' | 'all';
  paymentType?: string;
  limit?: number;
  from?: Date;
  to?: Date;
};

export async function listCachedSumupTransactions(
  prisma: PrismaClient,
  businessId: string,
  filter: SumupTransactionListFilter = {}
): Promise<SumupTransaction[]> {
  const where: Prisma.SumupTransactionWhereInput = {
    businessId,
    // Exclut les paiements refusés/échoués (carte déclinée, réessai du client) — vérifié
    // contre le journal de ventes officiel SumUp : ces tentatives n'y figurent jamais.
    status: 'SUCCESSFUL',
  };
  if (filter.billed === 'billed') where.invoiceId = { not: null };
  if (filter.billed === 'unbilled' || filter.billed === undefined) where.invoiceId = null;
  if (filter.paymentType) {
    where.paymentType = filter.paymentType;
  } else {
    // ECOM = paiement carte du site web — déjà rattaché à une Order + Invoice via le flux
    // normal (online-payment-finalize.ts). Sans cette exclusion, une vente web réapparaît
    // ici comme "comptoir non facturée" et un second Invoice serait créé pour la même vente.
    where.paymentType = { not: 'ECOM' };
  }
  if (filter.from || filter.to) {
    where.occurredAt = {
      ...(filter.from ? { gte: filter.from } : {}),
      ...(filter.to ? { lte: filter.to } : {}),
    };
  }

  return prisma.sumupTransaction.findMany({
    where,
    orderBy: { occurredAt: 'desc' },
    take: Math.min(filter.limit ?? 100, 500),
  });
}
