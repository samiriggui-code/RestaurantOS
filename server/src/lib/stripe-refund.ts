import type { PrismaClient } from '@prisma/client'
import { stripeSecretKey } from './stripe-config'
import { mergePaymentMeta, type OrderPaymentMeta } from './payment-meta'

function getStripe() {
  const Stripe = require('stripe')
  const key = stripeSecretKey()
  if (!key) return null
  return new Stripe(key)
}

type RefundResult =
  | { ok: true; refundId: string; alreadyRefunded?: boolean; skipped?: boolean }
  | { ok: false; error: string }

/** Rembourse Stripe si la commande a un PaymentIntent — idempotent. */
export async function refundStripePaymentForOrder(
  prisma: PrismaClient,
  order: {
    id: string
    businessId: string
    stripePaymentIntentId: string | null
    paymentStatus: string
    paymentMeta: unknown
    total: number
  },
  options: { refund?: boolean } = {}
): Promise<RefundResult> {
  if (options.refund === false) {
    return { ok: true, refundId: '', skipped: true }
  }

  if (!order.stripePaymentIntentId) {
    return { ok: true, refundId: '', skipped: true }
  }

  if (order.paymentStatus !== 'PAID') {
    return { ok: true, refundId: '', skipped: true }
  }

  const meta = (order.paymentMeta ?? {}) as OrderPaymentMeta
  if (meta.stripeRefundId) {
    return { ok: true, refundId: meta.stripeRefundId, alreadyRefunded: true }
  }

  const stripe = getStripe()
  if (!stripe) {
    return { ok: false, error: 'Stripe non configuré — remboursement CB impossible' }
  }

  try {
    const refund = await stripe.refunds.create({
      payment_intent: order.stripePaymentIntentId,
      metadata: {
        orderId: order.id,
        businessId: order.businessId,
        app: 'pizzeria',
      },
    })

    await prisma.order.update({
      where: { id: order.id },
      data: {
        paymentMeta: mergePaymentMeta(order.paymentMeta, {
          stripeRefundId: refund.id,
          stripeRefundedAt: new Date().toISOString(),
          stripeRefundAmountCents: refund.amount ?? order.total,
        }) as object,
      },
    })

    return { ok: true, refundId: refund.id }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Remboursement Stripe échoué'
    console.error('[stripe-refund]', order.id, message)
    return { ok: false, error: message }
  }
}
