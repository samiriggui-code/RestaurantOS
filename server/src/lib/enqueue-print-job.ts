import { PrismaClient } from '@prisma/client'
import { Server as SocketIOServer } from 'socket.io'
import { fiscalMetaForReceipt } from './fiscal/receipt-meta'
import {
  generatePrintText,
  type PrintTicketType,
  type ReceiptPrintOptions,
} from '../services/printer'

export type EnqueuePrintJobOptions = {
  receipt?: ReceiptPrintOptions
  /** false = ne pas émettre / résoudre le ticket fiscal (tests) */
  ensureFiscal?: boolean
}

/** Enfile un ticket cuisine ou étiquette sac après confirmation de commande. */
export async function enqueuePrintJob(
  prisma: PrismaClient,
  io: SocketIOServer | undefined,
  businessId: string,
  orderId: string,
  type: PrintTicketType = 'KITCHEN',
  options?: EnqueuePrintJobOptions,
) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, businessId },
    include: { items: { include: { menuItem: true } }, table: true },
  })
  if (!order) return null

  const business = await prisma.business.findUnique({ where: { id: businessId } })

  let receiptOpts = options?.receipt
  if (
    type === 'RECEIPT' &&
    order.paymentStatus === 'PAID' &&
    options?.ensureFiscal !== false &&
    !receiptOpts
  ) {
    receiptOpts = await fiscalMetaForReceipt(prisma, businessId, orderId)
  }

  const content = generatePrintText(order, business, type, { receipt: receiptOpts })

  const printJob = await prisma.printJob.create({
    data: {
      businessId,
      orderId: order.id,
      type,
      status: 'PENDING',
      payload: { text: content },
    },
  })

  io?.to(`business:${businessId}`).emit('print:job', printJob)
  return printJob
}
