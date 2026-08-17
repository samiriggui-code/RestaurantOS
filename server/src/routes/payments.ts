import { Router, Response, Request } from 'express'
import express from 'express'
import { PrismaClient } from '@prisma/client'
import { authenticate } from '../middleware/auth'
import { AuthRequest } from '../types'
import { runOnlineCardPaymentHooks } from '../lib/stripe-online-finalize'
import { finalizeGuestCheckoutFromWebhook } from '../lib/guest-checkout-draft'
import { stripePublishableKey, stripeSecretKey, stripeWebhookSecret } from '../lib/stripe-config'
import { Server as SocketIOServer } from 'socket.io'

const router = Router()

/** Middleware raw body — à monter sur /api/payments/webhook AVANT express.json() */
export const stripeWebhookRaw = express.raw({ type: 'application/json' })

function getStripe() {
  const Stripe = require('stripe')
  const key = stripeSecretKey()
  if (!key) return null
  return new Stripe(key)
}

/**
 * POST /api/payments/create-intent
 * Create a Stripe payment intent for an order.
 * @body {orderId: string}
 * @returns {clientSecret: string}
 * @throws 400 if Stripe not configured or order already paid
 * @throws 404 if order not found
 */
router.post('/create-intent', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma')
    const { orderId } = req.body

    const order = await prisma.order.findFirst({
      where: { id: orderId, businessId: req.user!.businessId },
    })

    if (!order) return res.status(404).json({ error: 'Order not found' })
    if (order.paymentStatus === 'PAID') return res.status(400).json({ error: 'Order already paid' })

    const stripe = getStripe()
    if (!stripe) return res.status(400).json({ error: 'Stripe not configured. Set STRIPE_SECRET_KEY in .env' })

    const paymentIntent = await stripe.paymentIntents.create({
      amount: order.total,
      currency: 'eur',
      metadata: {
        orderId: order.id,
        orderNumber: String(order.orderNumber),
        businessId: req.user!.businessId,
        app: 'pizzeria',
        productId: process.env.STRIPE_PIZZERIA_PRODUCT_ID ?? '',
      },
    })

    res.json({ clientSecret: paymentIntent.client_secret })
  } catch (error) {
    console.error('Create payment intent error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * POST /api/payments/webhook — monté dans index.ts avec stripeWebhookRaw
 */
export async function handleStripeWebhook(req: Request, res: Response) {
  try {
    const prisma: PrismaClient = req.app.get('prisma')
    const io = req.app.get('io') as SocketIOServer
    const stripe = getStripe()
    if (!stripe) return res.status(400).json({ error: 'Stripe not configured' })

    const sig = req.headers['stripe-signature'] as string
    const endpointSecret = stripeWebhookSecret()

    let event
    try {
      const payload = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body)
      event = stripe.webhooks.constructEvent(payload, sig, endpointSecret)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Webhook Error'
      console.error('Webhook signature verification failed:', message)
      return res.status(400).send(`Webhook Error: ${message}`)
    }

    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object
      const { orderId, businessId, checkoutDraftId } = paymentIntent.metadata

      if (checkoutDraftId && businessId) {
        await finalizeGuestCheckoutFromWebhook(
          prisma,
          io,
          businessId,
          checkoutDraftId,
          paymentIntent.id
        )
      } else if (orderId && businessId) {
        const prior = await prisma.order.findFirst({
          where: { id: orderId, businessId },
          select: { paymentStatus: true },
        })
        if (prior?.paymentStatus === 'PAID') {
          return res.json({ received: true })
        }

        const order = await prisma.order.update({
          where: { id: orderId },
          data: {
            paymentStatus: 'PAID',
            paymentMethod: 'CARD',
            status: 'CONFIRMED',
            stripePaymentIntentId: paymentIntent.id,
          },
          include: { items: { include: { menuItem: true } }, table: true },
        })

        await runOnlineCardPaymentHooks(prisma, io, businessId, orderId)
      }
    }

    res.json({ received: true })
  } catch (error) {
    console.error('Webhook error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}

/**
 * GET /api/payments/config
 * Get the Stripe publishable key for client-side initialization.
 * @returns {publishableKey: string}
 */
router.get('/config', async (_req: AuthRequest, res: Response) => {
  res.json({
    publishableKey: stripePublishableKey(),
  })
})

export default router
