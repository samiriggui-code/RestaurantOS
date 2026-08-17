import type { PrismaClient } from '@prisma/client'
import type { ReceiptPrintOptions } from '../../services/printer'
import { ensureFiscalTicketForPaidOrder, recordFiscalReprint } from './ticket'

const REPRINT_WINDOW_MS = 24 * 60 * 60 * 1000

export class FiscalReprintWindowError extends Error {
  constructor() {
    super('Réimpression ticket client limitée à 24 h après encaissement')
    this.name = 'FiscalReprintWindowError'
  }
}

/** Métadonnées fiscales pour le texte du reçu (1er tirage ou DUPLICATA). */
export async function fiscalMetaForReceipt(
  prisma: PrismaClient,
  businessId: string,
  orderId: string,
  operatorId?: string | null,
  opts?: { isReprint?: boolean },
): Promise<ReceiptPrintOptions | undefined> {
  const order = await prisma.order.findFirst({
    where: { id: orderId, businessId, paymentStatus: 'PAID' },
    select: { paymentCapturedAt: true, updatedAt: true, paymentMethod: true },
  })
  if (!order) return undefined

  await ensureFiscalTicketForPaidOrder(prisma, {
    businessId,
    orderId,
    operatorId,
    paymentMethod: order.paymentMethod,
  })

  const ticket = await prisma.fiscalTicket.findFirst({
    where: { businessId, orderId, kind: { in: ['SALE', 'TRAINING'] } },
    orderBy: { serialNumber: 'desc' },
  })
  if (!ticket) return undefined

  const meta: ReceiptPrintOptions = {
    fiscalSerial: ticket.serialNumber,
    fiscalHashPreview: ticket.recordHash.slice(0, 8).toUpperCase(),
    fiscalKind: ticket.kind,
  }

  if (opts?.isReprint) {
    const paidAt = order.paymentCapturedAt ?? order.updatedAt
    if (Date.now() - paidAt.getTime() > REPRINT_WINDOW_MS) {
      throw new FiscalReprintWindowError()
    }
    const n = await recordFiscalReprint(prisma, businessId, orderId, operatorId)
    if (n > 0) meta.reprintBanner = `*** DUPLICATA n°${n} ***`
  }

  return meta
}
