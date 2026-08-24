import type { Prisma } from '@prisma/client';

/**
 * Alloue le prochain numéro de commande pour un business, de façon atomique.
 * Doit être appelé DANS la transaction qui crée la commande (verrou FiscalSequence),
 * même mécanisme que allocateInvoiceNumber / nextTicketNo.
 */
export async function allocateOrderNumber(
  tx: Prisma.TransactionClient,
  businessId: string
): Promise<number> {
  const seq = await tx.fiscalSequence.upsert({
    where: { businessId },
    create: { businessId },
    update: {},
  });
  const orderNumber = seq.nextOrderNo;
  await tx.fiscalSequence.update({
    where: { businessId },
    data: { nextOrderNo: orderNumber + 1 },
  });
  return orderNumber;
}
