/**
 * Chantier 2 (se branche sur le chantier 1 — cache SumupTransaction) : facturation
 * à la demande depuis une vente comptoir. Le staff choisit une transaction SumUp pas
 * encore facturée (brique 1), renseigne le client, RestaurantOS émet la facture avec
 * le montant/TVA exacts remontés par SumUp (pas une TVA business par défaut approximative).
 */
import type { PrismaClient } from '@prisma/client';
import { allocateInvoiceNumber } from './invoice-from-order';

/** Taux de TVA français valides (ceux acceptés en aval par le pont Pennylane — frVatRateCode). */
const FRENCH_VAT_RATES = [0, 2.1, 5.5, 10, 20];

/** Calage sur le taux français le plus proche du taux implicite (montant TTC / TVA SumUp). */
function snapToFrenchVatRate(amountCents: number, vatCents: number | null): number {
  if (!vatCents || amountCents <= vatCents) return 0;
  const implicitRate = (vatCents / (amountCents - vatCents)) * 100;
  return FRENCH_VAT_RATES.reduce((closest, rate) =>
    Math.abs(rate - implicitRate) < Math.abs(closest - implicitRate) ? rate : closest
  );
}

export class SumupTransactionNotFoundError extends Error {
  constructor() {
    super('Transaction SumUp introuvable dans le cache — lance une synchro');
    this.name = 'SumupTransactionNotFoundError';
  }
}

export type CreateInvoiceFromSumupTransactionInput = {
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  clientSiret?: string;
  clientVatNumber?: string;
  clientAddress?: string;
  createdById?: string;
  status?: 'DRAFT' | 'ISSUED';
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- retour = payload Prisma (invoice + lignes), dérivé de la requête ci-dessous plutôt que dupliqué à la main.
export async function createInvoiceFromSumupTransaction(
  prisma: PrismaClient,
  businessId: string,
  sumupTransactionCacheId: string,
  input: CreateInvoiceFromSumupTransactionInput
) {
  const cached = await prisma.sumupTransaction.findFirst({
    where: { id: sumupTransactionCacheId, businessId },
  });
  if (!cached) throw new SumupTransactionNotFoundError();

  if (cached.invoiceId) {
    const existing = await prisma.invoice.findUnique({
      where: { id: cached.invoiceId },
      include: { lines: { orderBy: { sortOrder: 'asc' } } },
    });
    if (existing) return { invoice: existing, created: false as const };
  }

  if (!input.clientName?.trim()) throw new Error('Nom client obligatoire');

  const taxRate = snapToFrenchVatRate(cached.amountCents, cached.vatAmountCents);
  // TVA exacte remontée par SumUp quand disponible (pas de round-trip par le taux
  // arrondi, qui introduirait un écart d'arrondi vs le TTC réellement encaissé).
  const vatCents =
    cached.vatAmountCents ?? Math.round((cached.amountCents * taxRate) / (100 + taxRate));
  const unitPriceCents = cached.amountCents - vatCents;
  const description =
    cached.productSummary?.trim() ||
    `Vente comptoir SumUp du ${cached.occurredAt.toLocaleDateString('fr-FR')}`;

  const invoice = await prisma.$transaction(async tx => {
    const invoiceNumber = await allocateInvoiceNumber(tx, businessId);
    const created = await tx.invoice.create({
      data: {
        businessId,
        invoiceNumber,
        status: input.status ?? 'ISSUED',
        type: 'ON_DEMAND',
        clientName: input.clientName.trim(),
        clientEmail: input.clientEmail?.trim() || null,
        clientPhone: input.clientPhone?.trim() || null,
        clientSiret: input.clientSiret?.trim() || null,
        clientVatNumber: input.clientVatNumber?.trim() || null,
        clientAddress: input.clientAddress?.trim() || null,
        subtotalCents: unitPriceCents,
        taxCents: cached.amountCents - unitPriceCents,
        totalCents: cached.amountCents,
        createdById: input.createdById ?? null,
        lines: {
          create: [{ description, quantity: 1, unitPriceCents, taxRate, sortOrder: 0 }],
        },
      },
      include: { lines: { orderBy: { sortOrder: 'asc' } } },
    });
    await tx.sumupTransaction.update({
      where: { id: cached.id },
      data: { invoiceId: created.id },
    });
    return created;
  });

  return { invoice, created: true as const };
}
