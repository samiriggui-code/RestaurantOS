import type { PrismaClient } from '@prisma/client'
import type { Server as SocketIOServer } from 'socket.io'
import { getBusinessId } from './business'
import {
  createOnlineOrder,
  validateOnlineOrderBody,
  type OnlineOrderBody,
} from './online-order'
import { eurosToCents } from './money'
import { runOnlineCardPaymentHooks } from './stripe-online-finalize'
import { getStripeMode, stripeSecretKey } from './stripe-config'

const DRAFT_TTL_MS = 2 * 60 * 60 * 1000

function getStripeClient() {
  const Stripe = require('stripe')
  const key = stripeSecretKey()
  if (!key) return null
  return new Stripe(key)
}

export async function createGuestCheckoutDraft(prisma: PrismaClient, body: OnlineOrderBody) {
  const businessId = getBusinessId()
  const validationError = validateOnlineOrderBody(body)
  if (validationError) {
    return { error: validationError, status: 400 as const }
  }

  const stripe = getStripeClient()
  if (!stripe) {
    return { error: 'Stripe non configuré', status: 400 as const }
  }

  const totalCents = eurosToCents(body.total)
  if (totalCents < 50) {
    return { error: 'Montant minimum 0,50 €', status: 400 as const }
  }

  const expiresAt = new Date(Date.now() + DRAFT_TTL_MS)
  const draft = await prisma.guestCheckoutDraft.create({
    data: {
      businessId,
      payload: body as object,
      totalCents,
      expiresAt,
    },
  })

  const intent = await stripe.paymentIntents.create({
    amount: totalCents,
    currency: 'eur',
    ...(getStripeMode() === 'test'
      ? { payment_method_types: ['card'] as const }
      : { automatic_payment_methods: { enabled: true } }),
    metadata: {
      checkoutDraftId: draft.id,
      businessId,
      app: 'pizzeria',
      productId: process.env.STRIPE_PIZZERIA_PRODUCT_ID ?? '',
    },
  })

  await prisma.guestCheckoutDraft.update({
    where: { id: draft.id },
    data: { stripePaymentIntentId: intent.id },
  })

  return {
    draftId: draft.id,
    clientSecret: intent.client_secret as string,
    paymentIntentId: intent.id,
  }
}

export async function completeGuestCheckout(
  prisma: PrismaClient,
  io: SocketIOServer | null,
  draftId: string,
  paymentIntentId?: string
) {
  const businessId = getBusinessId()
  const stripe = getStripeClient()
  if (!stripe) {
    return { error: 'Stripe non configuré', status: 400 as const }
  }

  const draft = await prisma.guestCheckoutDraft.findFirst({
    where: { id: draftId, businessId },
  })
  if (!draft) {
    return { error: 'Session de paiement introuvable', status: 404 as const }
  }
  if (draft.consumedAt) {
    const existing = draft.stripePaymentIntentId
      ? await prisma.order.findFirst({
          where: { stripePaymentIntentId: draft.stripePaymentIntentId, businessId },
        })
      : null
    if (existing?.trackingToken) {
      return {
        token: existing.trackingToken,
        orderNumber: existing.orderNumber,
        orderId: existing.id,
      }
    }
    return { error: 'Session déjà utilisée', status: 409 as const }
  }
  if (draft.expiresAt < new Date()) {
    return { error: 'Session expirée — recommencez votre commande', status: 410 as const }
  }

  const piId = paymentIntentId ?? draft.stripePaymentIntentId
  if (!piId) {
    return { error: 'Paiement introuvable', status: 400 as const }
  }

  const paymentIntent = await stripe.paymentIntents.retrieve(piId)
  if (paymentIntent.status !== 'succeeded') {
    return { error: 'Paiement non confirmé', status: 402 as const, pending: true as const }
  }
  if (paymentIntent.amount !== draft.totalCents) {
    return { error: 'Montant incohérent', status: 400 as const }
  }

  const existingOrder = await prisma.order.findFirst({
    where: { stripePaymentIntentId: piId, businessId },
  })
  if (existingOrder?.trackingToken) {
    await prisma.guestCheckoutDraft.update({
      where: { id: draft.id },
      data: { consumedAt: new Date(), stripePaymentIntentId: piId },
    })
    return {
      token: existingOrder.trackingToken,
      orderNumber: existingOrder.orderNumber,
      orderId: existingOrder.id,
    }
  }

  const body = draft.payload as OnlineOrderBody
  const created = await createOnlineOrder(prisma, body, {
    cardPaid: { stripePaymentIntentId: piId },
  })
  if ('error' in created && created.error) {
    return { error: created.error, status: created.status ?? 400 }
  }
  const { order, trackingToken, orderNumber } = created
  if (!order || !trackingToken) {
    return { error: 'Commande non créée', status: 500 as const }
  }

  await prisma.guestCheckoutDraft.update({
    where: { id: draft.id },
    data: { consumedAt: new Date(), stripePaymentIntentId: piId },
  })

  if (io) {
    await runOnlineCardPaymentHooks(prisma, io, businessId, order.id)
  }

  return { token: trackingToken, orderNumber, orderId: order.id }
}

/** Webhook Stripe — finalise un brouillon payé (idempotent). */
export async function finalizeGuestCheckoutFromWebhook(
  prisma: PrismaClient,
  io: SocketIOServer,
  businessId: string,
  checkoutDraftId: string,
  paymentIntentId: string
) {
  const draft = await prisma.guestCheckoutDraft.findFirst({
    where: { id: checkoutDraftId, businessId },
  })
  if (!draft) return null

  const existing = await prisma.order.findFirst({
    where: { stripePaymentIntentId: paymentIntentId, businessId },
  })
  if (existing) {
    if (!draft.consumedAt) {
      await prisma.guestCheckoutDraft.update({
        where: { id: draft.id },
        data: { consumedAt: new Date(), stripePaymentIntentId: paymentIntentId },
      })
    }
    return existing
  }

  const result = await completeGuestCheckout(prisma, io, checkoutDraftId, paymentIntentId)
  if ('error' in result && result.error) {
    console.error('[webhook] guest checkout finalize failed:', checkoutDraftId, result.error)
    return null
  }
  if ('orderId' in result) {
    return prisma.order.findFirst({ where: { id: result.orderId, businessId } })
  }
  return null
}
