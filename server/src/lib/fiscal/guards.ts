import type { PrismaClient } from '@prisma/client'

/** Refuse modification des montants si un ticket fiscal existe pour la commande. */
export async function assertOrderFiscallyMutable(
  prisma: PrismaClient,
  orderId: string,
  businessId: string,
): Promise<void> {
  const sealed = await prisma.fiscalTicket.findFirst({
    where: { orderId, businessId, kind: { in: ['SALE', 'TRAINING'] } },
    select: { id: true, serialNumber: true },
  })
  if (sealed) {
    throw new Error(
      `Commande figée fiscalement (ticket n°${sealed.serialNumber}) — utiliser un avoir`,
    )
  }
}

export async function hasFiscalTicket(
  prisma: PrismaClient,
  orderId: string,
  businessId: string,
): Promise<boolean> {
  const t = await prisma.fiscalTicket.findFirst({
    where: { orderId, businessId, kind: { in: ['SALE', 'TRAINING'] } },
    select: { id: true },
  })
  return Boolean(t)
}
