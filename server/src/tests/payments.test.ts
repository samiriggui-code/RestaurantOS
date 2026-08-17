import request from 'supertest'
import express from 'express'
import { PrismaClient } from '@prisma/client'
import { mockDeep, mockReset } from 'jest-mock-extended'
import paymentRoutes from '../routes/payments'

jest.mock('../middleware/auth', () => ({
  authenticate: jest.fn((req: any, _res: any, next: any) => {
    req.user = { userId: 'user-1', businessId: 'biz-1', role: 'ADMIN', name: 'Admin' }
    next()
  }),
  requireRole: jest.fn(() => (req: any, res: any, next: any) => next()),
}))

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(),
}))

const prisma = mockDeep<PrismaClient>()
const mockIo = {
  to: jest.fn().mockReturnThis(),
  emit: jest.fn(),
}

let mockCreatePaymentIntent: jest.Mock
let mockConstructEvent: jest.Mock
let mockRetrievePaymentIntent: jest.Mock

jest.mock('stripe', () => {
  const create = jest.fn()
  const construct = jest.fn()
  const retrieve = jest.fn()
  return jest.fn(() => ({
    paymentIntents: { create, retrieve },
    webhooks: { constructEvent: construct },
  }))
})

const app = express()
app.use(express.json())
app.set('prisma', prisma)
app.set('io', mockIo)
app.use('/api/payments', paymentRoutes)

beforeEach(() => {
  mockReset(prisma)
  ;(PrismaClient as unknown as jest.Mock).mockImplementation(() => prisma)
  mockIo.to.mockClear()
  mockIo.emit.mockClear()

  const Stripe = require('stripe')
  const instance = Stripe()
  mockCreatePaymentIntent = instance.paymentIntents.create
  mockConstructEvent = instance.webhooks.constructEvent
  mockRetrievePaymentIntent = instance.paymentIntents.retrieve

  process.env.STRIPE_SECRET_KEY = 'sk_test_mock'
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_mock'
  process.env.STRIPE_PUBLISHABLE_KEY = 'pk_test_mock'
})

afterAll(() => {
  delete process.env.STRIPE_SECRET_KEY
  delete process.env.STRIPE_WEBHOOK_SECRET
  delete process.env.STRIPE_PUBLISHABLE_KEY
})

describe('Payment Routes', () => {
  beforeEach(() => {
    mockCreatePaymentIntent.mockReset()
    mockConstructEvent.mockReset()
    mockRetrievePaymentIntent.mockReset()
  })

  describe('POST /api/payments/create-intent', () => {
    it('should create a PaymentIntent for a pending order', async () => {
      const orderId = 'order-1'
      const mockStripe = { client_secret: 'pi_mock_123_secret_abc' }

      ;(prisma.order.findFirst as jest.Mock).mockResolvedValue({
        id: orderId,
        total: 24.0,
        status: 'pending',
        paymentStatus: 'UNPAID',
        orderNumber: 1001,
      })
      mockCreatePaymentIntent.mockResolvedValue(mockStripe)

      const res = await request(app)
        .post('/api/payments/create-intent')
        .send({ orderId })

      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('clientSecret')
      expect(res.body.clientSecret).toBe('pi_mock_123_secret_abc')
      expect(mockCreatePaymentIntent).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 2400,
          currency: 'dzd',
          metadata: expect.objectContaining({ orderId }),
        })
      )
    })

    it('should return 404 when order not found', async () => {
      ;(prisma.order.findFirst as jest.Mock).mockResolvedValue(null)

      const res = await request(app)
        .post('/api/payments/create-intent')
        .send({ orderId: 'nonexistent' })

      expect(res.status).toBe(404)
      expect(res.body.error).toBe('Order not found')
    })

    it('should return 400 when order already paid', async () => {
      ;(prisma.order.findFirst as jest.Mock).mockResolvedValue({
        id: 'order-1',
        total: 24.0,
        paymentStatus: 'PAID',
      })

      const res = await request(app)
        .post('/api/payments/create-intent')
        .send({ orderId: 'order-1' })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('Order already paid')
    })

    it('should return 400 when Stripe not configured', async () => {
      delete process.env.STRIPE_SECRET_KEY
      ;(prisma.order.findFirst as jest.Mock).mockResolvedValue({
        id: 'order-1',
        total: 24.0,
        paymentStatus: 'UNPAID',
      })

      const res = await request(app)
        .post('/api/payments/create-intent')
        .send({ orderId: 'order-1' })

      expect(res.status).toBe(400)
      expect(res.body.error).toContain('Stripe not configured')
      process.env.STRIPE_SECRET_KEY = 'sk_test_mock'
    })
  })

  describe('POST /api/payments/webhook', () => {
    it('should handle payment_intent.succeeded event', async () => {
      mockConstructEvent.mockReturnValue({
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_mock_123',
            metadata: { orderId: 'order-1', businessId: 'biz-1' },
          },
        },
      })
      ;(prisma.order.update as jest.Mock).mockResolvedValue({
        id: 'order-1',
        paymentStatus: 'PAID',
        paymentMethod: 'CARD',
        items: [],
        table: null,
      })

      const res = await request(app)
        .post('/api/payments/webhook')
        .set('stripe-signature', 'valid_sig')
        .send({ raw: true })

      expect(res.status).toBe(200)
      expect(res.body.received).toBe(true)
      expect(prisma.order.update).toHaveBeenCalledWith({
        where: { id: 'order-1' },
        data: { paymentStatus: 'PAID', paymentMethod: 'CARD' },
        include: { items: { include: { menuItem: true } }, table: true },
      })
      expect(mockIo.to).toHaveBeenCalledWith('business:biz-1')
      expect(mockIo.emit).toHaveBeenCalledWith('order:paymentUpdate', expect.any(Object))
    })

    it('should return 400 on invalid signature', async () => {
      mockConstructEvent.mockImplementation(() => {
        throw new Error('Invalid signature')
      })

      const res = await request(app)
        .post('/api/payments/webhook')
        .set('stripe-signature', 'bad_sig')
        .send({})

      expect(res.status).toBe(400)
    })

    it('should return 400 when Stripe not configured', async () => {
      delete process.env.STRIPE_SECRET_KEY

      const res = await request(app)
        .post('/api/payments/webhook')
        .set('stripe-signature', 'sig')
        .send({})

      expect(res.status).toBe(400)
      expect(res.body.error).toContain('Stripe not configured')
      process.env.STRIPE_SECRET_KEY = 'sk_test_mock'
    })

    it('should not crash on non-payment_intent.succeeded events', async () => {
      mockConstructEvent.mockReturnValue({
        type: 'payment_intent.canceled',
        data: {
          object: {
            id: 'pi_mock_123',
            metadata: {},
          },
        },
      })

      const res = await request(app)
        .post('/api/payments/webhook')
        .set('stripe-signature', 'sig')
        .send({})

      expect(res.status).toBe(200)
      expect(res.body.received).toBe(true)
      expect(prisma.order.update).not.toHaveBeenCalled()
    })
  })

  describe('GET /api/payments/config', () => {
    it('should return stripe publishable key', async () => {
      const res = await request(app).get('/api/payments/config')

      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('publishableKey')
      expect(res.body.publishableKey).toBe('pk_test_mock')
    })

    it('fallback NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY si STRIPE_PUBLISHABLE_KEY absent', async () => {
      delete process.env.STRIPE_PUBLISHABLE_KEY
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = 'pk_test_from_next_public'

      const res = await request(app).get('/api/payments/config')

      expect(res.status).toBe(200)
      expect(res.body.publishableKey).toBe('pk_test_from_next_public')

      process.env.STRIPE_PUBLISHABLE_KEY = 'pk_test_mock'
      delete process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
    })
  })
})
