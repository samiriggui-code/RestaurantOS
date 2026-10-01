/**
 * Chantier 3 (indépendant des chantiers 1/2 SumUp) : lecture des factures
 * fournisseurs Pennylane (sens inverse du pont facturation — on lit chez eux).
 * Cache local, pas d'appel à la demande — alimente le futur dashboard ventes
 * vs dépenses aux côtés du cache SumupTransaction.
 */

import type {
  PrismaClient,
  Prisma,
  PennylaneSupplierInvoice as CachedSupplierInvoice,
} from '@prisma/client';
import {
  isPennylaneConfigured,
  listPennylaneSupplierInvoices,
  type PennylaneSupplierInvoice,
} from './pennylane-client';
import { resolvePennylaneConfig, runWithPennylaneToken } from './pennylane-config';
import { PennylaneNotConfiguredError } from './pennylane-sync';

/** Borne de sécurité — évite une boucle infinie si l'API renvoie has_more en continu. */
const MAX_PAGES = 50;

function toCentsFromString(value: string | undefined | null): number {
  if (!value) return 0;
  return Math.round(parseFloat(value) * 100);
}

function upsertData(
  businessId: string,
  inv: PennylaneSupplierInvoice
): Prisma.PennylaneSupplierInvoiceUncheckedCreateInput {
  return {
    businessId,
    pennylaneSupplierInvoiceId: inv.id,
    supplierId: inv.supplier?.id ?? null,
    invoiceNumber: inv.invoice_number,
    label: inv.label,
    amountCents: toCentsFromString(inv.amount),
    taxCents: toCentsFromString(inv.tax),
    currency: inv.currency,
    date: inv.date ? new Date(inv.date) : null,
    deadline: inv.deadline ? new Date(inv.deadline) : null,
    paymentStatus: inv.payment_status,
    paid: inv.paid,
    accountingStatus: inv.accounting_status,
    raw: inv as unknown as Prisma.InputJsonValue,
  };
}

export type PennylaneExpenseSyncResult = { synced: number; pages: number };

/**
 * Pagine l'intégralité des factures fournisseurs Pennylane (triées -date) et upsert
 * chacune dans le cache local. Pas de filtre "updated_at" côté API Pennylane pour ce
 * endpoint — on repart donc du début à chaque synchro (idempotent via la clé unique
 * businessId+pennylaneSupplierInvoiceId), borné à MAX_PAGES par sécurité.
 */
export async function syncPennylaneSupplierInvoices(
  prisma: PrismaClient,
  businessId: string
): Promise<PennylaneExpenseSyncResult> {
  const config = await resolvePennylaneConfig(prisma, businessId);
  if (!config.token || !isPennylaneConfigured(config.token)) {
    throw new PennylaneNotConfiguredError();
  }

  return runWithPennylaneToken(config.token, async () => {
    let cursor: string | undefined;
    let synced = 0;
    let pages = 0;

    for (; pages < MAX_PAGES; pages++) {
      const { items, has_more, next_cursor } = await listPennylaneSupplierInvoices({ cursor });

      for (const inv of items) {
        const data = upsertData(businessId, inv);
        await prisma.pennylaneSupplierInvoice.upsert({
          where: {
            businessId_pennylaneSupplierInvoiceId: {
              businessId,
              pennylaneSupplierInvoiceId: inv.id,
            },
          },
          create: data,
          update: data,
        });
        synced += 1;
      }

      if (!has_more || !next_cursor) break;
      cursor = next_cursor;
    }

    return { synced, pages: pages + 1 };
  });
}

export type SupplierInvoiceListFilter = {
  paid?: 'paid' | 'unpaid' | 'all';
  limit?: number;
};

export async function listCachedSupplierInvoices(
  prisma: PrismaClient,
  businessId: string,
  filter: SupplierInvoiceListFilter = {}
): Promise<CachedSupplierInvoice[]> {
  const where: Prisma.PennylaneSupplierInvoiceWhereInput = { businessId };
  if (filter.paid === 'paid') where.paid = true;
  if (filter.paid === 'unpaid') where.paid = false;

  return prisma.pennylaneSupplierInvoice.findMany({
    where,
    orderBy: { date: 'desc' },
    take: Math.min(filter.limit ?? 100, 500),
  });
}
