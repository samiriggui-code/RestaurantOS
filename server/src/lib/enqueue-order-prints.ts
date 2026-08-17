import { PrismaClient } from '@prisma/client'
import { Server as SocketIOServer } from 'socket.io'
import { enqueuePrintJob } from './enqueue-print-job'
import type { PrintTicketType } from '../services/printer'

/** Tickets à imprimer automatiquement après confirmation (CDC §4.2). */
export async function enqueueConfirmedOrderPrints(
  prisma: PrismaClient,
  io: SocketIOServer | undefined,
  businessId: string,
  orderId: string,
) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, businessId },
    select: { type: true },
  })
  if (!order) return

  const types: PrintTicketType[] = ['KITCHEN', 'RECEIPT']
  if (order.type === 'DELIVERY' || order.type === 'TAKEAWAY') {
    types.push('BAG_LABEL')
  }

  for (const type of types) {
    await enqueuePrintJob(prisma, io, businessId, orderId, type)
  }
}
