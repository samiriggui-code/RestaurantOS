import type { PrismaClient } from '@prisma/client'
import type { Server as SocketIOServer } from 'socket.io'
import { getBusinessId } from './business'
import { stripeSecretKey } from './stripe-config'
import { runOnlineCardPaymentHooks } from './stripe-online-finalize'

function getStripe() {
  const Stripe = require('stripe')
  const key = stripeSecretKey()
  if (!key) return null
  return new Stripe(key)
}

/** Rattrape une commande PENDING_PAYMENT si Stripe a déjà encaissé (ancien flux ou webhook lent). */
export async function syncPendingOrderIfStripePaid(
  prisma: PrismaClient,
  io: SocketIOServer | null,
  trackingToken: string
) {
  const businessId = getBusinessId()
  const stripe = getStripe()
  if (!stripe) return { error: 'Stripe non configuré', status: 400 as const }

  const order = await prisma.order.findFirst({
    where: { trackingToken, businessId },
  })
  if (!order) return { error: 'Commande introuvable', status: 404 as const }
  if (order.paymentStatus === 'PAID' || order.status === 'CONFIRMED') {
    return {
      token: order.trackingToken!,
      orderNumber: order.orderNumber,
      orderId: order.id,
      synced: false as const,
    }
  }
  if (order.status !== 'PENDING_PAYMENT' || !order.stripePaymentIntentId) {
    return { error: 'Commande non payable en ligne', status: 400 as const }
  }

  const pi = await stripe.paymentIntents.retrieve(order.stripePaymentIntentId)
  if (pi.status !== 'succeeded') {
    return { error: 'Paiement non confirmé chez Stripe', status: 402 as const, pending: true as const }
  }
  if (pi.amount !== order.total) {
    return { error: 'Montant Stripe incohérent', status: 400 as const }
  }

  await prisma.order.update({
    where: { id: order.id },
    data: {
      paymentStatus: 'PAID',
      paymentMethod: 'CARD',
      status: 'CONFIRMED',
    },
  })

  if (io) {
    await runOnlineCardPaymentHooks(prisma, io, businessId, order.id)
  }

  return {
    token: order.trackingToken!,
    orderNumber: order.orderNumber,
    orderId: order.id,
    synced: true as const,
  }
}
