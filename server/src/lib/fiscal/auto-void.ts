import type { PrismaClient } from '@prisma/client'
import { issueFiscalVoid } from './ticket'

/** Avoir automatique lors de l'annulation d'une vente déjà fiscalisée. */
export async function voidFiscalTicketForCancelledOrder(
  prisma: PrismaClient,
  businessId: string,
  orderId: string,
  operatorId: string,
  reason: string,
) {
  const sale = await prisma.fiscalTicket.findFirst({
    where: { businessId, orderId, kind: 'SALE' },
    select: { id: true, serialNumber: true },
  })
  if (!sale) return null

  return issueFiscalVoid(prisma, {
    businessId,
    voidOfTicketId: sale.id,
    operatorId,
    reason,
  })
}
