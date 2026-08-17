import { Router, Response } from 'express'
import { randomBytes } from 'crypto'
import { PrismaClient } from '@prisma/client'
import { Server as SocketIOServer } from 'socket.io'
import { authenticate, optionalAuthenticate, requireRole } from '../middleware/auth'
import { logAction } from '../middleware/auditLog'
import { AuthRequest } from '../types'
import { resolveBusinessId } from '../lib/business'
import {
  computeOrderTotalsFromLines,
  defaultVatBpsFromTaxRate,
  type OrderVatLine,
} from '../lib/order-vat'
import { orderPriceMode } from '../lib/invoice-vat'
import { type PrintTicketType } from '../services/printer'
import { enqueuePrintJob } from '../lib/enqueue-print-job'
import { enqueueConfirmedOrderPrints } from '../lib/enqueue-order-prints'
import { emitOrderTrackUpdate } from '../lib/order-track-events'
import { notifyOrderStatusChange } from '../lib/notifications'
import { deductStockWithAlerts } from '../lib/stock-deduct-alerts'
import { restoreStockForOrder } from '../lib/order-stock'
import { ensureInvoiceForPaidOrder } from '../lib/invoice-from-order'
import { resolveOrderChannel } from '../lib/order-channel'
import { ensureLoyaltyCreditForPaidOrder } from '../lib/loyalty-order'
import { requireFiscalTicketForPaidOrder } from '../lib/fiscal/hook-paid-order'
import { assertOrderFiscallyMutable } from '../lib/fiscal/guards'
import { voidFiscalTicketForCancelledOrder } from '../lib/fiscal/auto-void'
import { assertManualCardPaymentMeta } from '../lib/fiscal/payment-validation'
import { fiscalMetaForReceipt, FiscalReprintWindowError } from '../lib/fiscal/receipt-meta'
import { mergePaymentMeta, type OrderPaymentMeta } from '../lib/payment-meta'
import { emitAdminLive } from '../lib/admin-live-events'
import { shouldExcludeUnpaidOrders, UNPAID_PENDING_ORDER_FILTER } from '../lib/order-list-filters'
import { refundStripePaymentForOrder } from '../lib/stripe-refund'

const router = Router()

export const ORDER_CANCEL_REASONS = [
  'CLIENT_REFUSED',
  'OUT_OF_STOCK',
  'MISSING_INGREDIENT',
  'INCIDENT',
  'OTHER',
] as const

export type OrderCancelReason = (typeof ORDER_CANCEL_REASONS)[number]

const CANCEL_REASON_LABEL: Record<OrderCancelReason, string> = {
  CLIENT_REFUSED: 'Client refuse la commande',
  OUT_OF_STOCK: 'Stock épuisé',
  MISSING_INGREDIENT: 'Ingrédient manquant',
  INCIDENT: 'Incident cuisine',
  OTHER: 'Autre motif',
}

function generateOrderNumber(): number {
  return parseInt(Date.now().toString().slice(-6), 10) + Math.floor(Math.random() * 100)
}

function applyPaymentMeta(
  body: { paymentMeta?: OrderPaymentMeta; paymentMethod?: string },
  totalCents: number
): { paymentMeta?: object; paymentCapturedAt?: Date } {
  if (!body.paymentMethod || !['CASH', 'CARD'].includes(body.paymentMethod)) return {}
  const meta = mergePaymentMeta(body.paymentMeta ?? null, {
    amountCents: totalCents,
    capturedAt: body.paymentMeta?.capturedAt ?? new Date().toISOString(),
    provider:
      body.paymentMeta?.provider ??
      (body.paymentMethod === 'CASH' ? 'MANUAL' : 'MANUAL'),
    captureMode: body.paymentMeta?.captureMode ?? 'manual',
  })
  return {
    paymentMeta: meta as object,
    paymentCapturedAt: new Date(meta.capturedAt ?? new Date().toISOString()),
  }
}

function generateTrackingToken(): string {
  return randomBytes(6).toString('hex')
}

/** Commande internet invité vs comptoir staff (isOnlineOrder: false). */
function isOnlineCheckout(isOnlineOrder: unknown, hasStaffUser: boolean): boolean {
  if (isOnlineOrder === false) return false
  if (isOnlineOrder === true) return true
  return !hasStaffUser
}

/**
 * POST /api/orders
 * Create a new order (public for online ordering, authenticated for staff).
 * Emits socket event 'order:new' to business room.
 * @body {items, tableId?, customerName?, customerPhone?, type?, notes?, businessId?}
 * @returns 201 {Order}
 * @throws 400 if item not available or businessId missing
 */
router.post('/', optionalAuthenticate, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma')
    const io: SocketIOServer = req.app.get('io')
    const { items, tableId, customerName, customerPhone, customerEmail, type, notes, isOnlineOrder } =
      req.body

    const businessId = req.user?.businessId || resolveBusinessId(req.body.businessId)
    if (!businessId) return res.status(400).json({ error: 'businessId required' })

    let subtotal = 0
    const orderItemsData = []
    const vatLines: OrderVatLine[] = []

    for (const item of items) {
      const menuItem = await prisma.menuItem.findUnique({ where: { id: item.menuItemId } })
      if (!menuItem || !menuItem.isAvailable || !menuItem.isActive) {
        return res.status(400).json({ error: `Item ${item.menuItemId} not available` })
      }
      let itemPrice = menuItem.discountPrice ?? menuItem.price
      if (
        req.user &&
        typeof item.price === 'number' &&
        Number.isInteger(item.price) &&
        item.price >= 0
      ) {
        itemPrice = item.price
      }
      subtotal += itemPrice * item.quantity
      vatLines.push({
        quantity: item.quantity,
        unitPriceCents: itemPrice,
        vatRateBps: menuItem.vatRateBps,
      })
      orderItemsData.push({
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        price: itemPrice,
        notes: item.notes || null,
        selectedModifiers: item.selectedModifiers || {},
        sortOrder: item.sortOrder || 0,
      })
    }

    const settings = await prisma.business.findUnique({ where: { id: businessId } })
    const defaultVatBps = defaultVatBpsFromTaxRate(settings?.taxRate ?? 10)
    const vatLinesResolved = vatLines.map((l) => ({
      ...l,
      vatRateBps: l.vatRateBps ?? defaultVatBps,
    }))
    const serviceRate = settings?.serviceChargeRate ?? 0
    const orderType = type || 'DINE_IN'
    const online = isOnlineCheckout(isOnlineOrder, Boolean(req.user))
    const channel = resolveOrderChannel({
      channel: req.body.channel,
      isOnlineOrder: online,
      source: req.body.source,
    })
    const { tax, serviceCharge, total } = computeOrderTotalsFromLines(vatLinesResolved, {
      priceMode: online ? 'TTC' : 'HT',
      serviceRatePercent: serviceRate,
      orderType,
    })
    const initialStatus = online ? 'PENDING_PAYMENT' : 'CONFIRMED'

    const orderNumber = generateOrderNumber()
    const order = await prisma.order.create({
      data: {
        businessId,
        orderNumber,
        tableId: tableId || null,
        customerName: customerName || null,
        customerPhone: customerPhone || null,
        customerEmail: customerEmail || null,
        type: orderType,
        status: initialStatus,
        paymentStatus: online ? 'UNPAID' : req.body.paymentStatus || 'UNPAID',
        paymentMethod: req.body.paymentMethod || null,
        subtotal,
        tax,
        serviceCharge,
        total,
        notes: notes || null,
        isOnlineOrder: online,
        channel,
        trackingToken: generateTrackingToken(),
        deliveryAddress: req.body.deliveryAddress || null,
        deliveryPostalCode: req.body.deliveryPostalCode || null,
        deliveryCity: req.body.deliveryCity || null,
        scheduledAt: req.body.scheduledAt ? new Date(req.body.scheduledAt) : null,
        cashierId: req.user?.userId || null,
        ...applyPaymentMeta(req.body, total),
        items: { create: orderItemsData },
      },
      include: {
        items: { include: { menuItem: true } },
        table: true,
      },
    })

    // Update table status if dine-in
    if (tableId) {
      await prisma.table.update({
        where: { id: tableId },
        data: { status: 'OCCUPIED' },
      })
    }

    if (initialStatus === 'CONFIRMED') {
      void deductStockWithAlerts(
        prisma,
        businessId,
        order.id,
        order.items.map((i) => ({ menuItemId: i.menuItemId, quantity: i.quantity }))
      ).catch((err) => console.error('Stock deduct on create:', err))
    }

    if (order.paymentStatus === 'PAID') {
      try {
        assertManualCardPaymentMeta(order.paymentMethod, req.body.paymentMeta)
        await requireFiscalTicketForPaidOrder(prisma, businessId, order.id, req.user?.userId, {
          paymentMethod: order.paymentMethod,
        })
      } catch (fiscalErr) {
        await prisma.order.delete({ where: { id: order.id } }).catch(() => {})
        const msg = fiscalErr instanceof Error ? fiscalErr.message : 'Ticket fiscal impossible'
        return res.status(500).json({ error: msg })
      }
      void ensureInvoiceForPaidOrder(prisma, businessId, order.id, req.user?.userId).catch((err) =>
        console.error('Auto invoice on create:', err)
      )
      void ensureLoyaltyCreditForPaidOrder(prisma, businessId, order.id)
    }

    // Cuisine / KDS : uniquement commandes confirmées (CDC — pas de PENDING_PAYMENT)
    if (initialStatus === 'CONFIRMED') {
      io.to(`business:${businessId}`).emit('order:new', order)
      if (!online) {
        void enqueueConfirmedOrderPrints(prisma, io, businessId, order.id)
      }
    }

    res.status(201).json(order)
  } catch (error) {
    console.error('Create order error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * GET /api/orders
 * Get orders with optional filters (status, type, date range).
 * @query {status?, type?, dateFrom?, dateTo?, limit?}
 * @returns {Order[]}
 */
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma')
    const { status, type, dateFrom, dateTo, limit, isOnlineOrder, paymentStatus, paymentMethod, channel } =
      req.query

    const where: any = { businessId: req.user!.businessId }
    if (status) {
      const statuses = (status as string).split(',').map(s => s.trim()).filter(Boolean)
      where.status = statuses.length > 1 ? { in: statuses } : statuses[0]
    }
    if (type) {
      const types = (type as string).split(',').map((s) => s.trim()).filter(Boolean)
      where.type = types.length > 1 ? { in: types } : types[0]
    }
    if (isOnlineOrder !== undefined && isOnlineOrder !== '') {
      where.isOnlineOrder = isOnlineOrder === 'true'
    }
    if (paymentStatus) {
      where.paymentStatus = paymentStatus as string
    }
    if (paymentMethod) {
      where.paymentMethod = paymentMethod as string
    }
    if (channel) {
      where.channel = channel as string
    }
    if (dateFrom || dateTo) {
      where.createdAt = {}
      if (dateFrom) where.createdAt.gte = new Date(dateFrom as string)
      if (dateTo) where.createdAt.lte = new Date(dateTo as string)
    }

    // Exclure commandes impayées (tentatives CB abandonnées, comptoir non encaissé)
    if (shouldExcludeUnpaidOrders({
      includeUnpaid: req.query.includeUnpaid as string | undefined,
      paymentStatus: paymentStatus as string | undefined,
      status: status as string | undefined,
    })) {
      where.NOT = UNPAID_PENDING_ORDER_FILTER
    }

    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit ? parseInt(limit as string) : 250,
      include: {
        items: { include: { menuItem: true } },
        table: true,
        cashier: { select: { id: true, name: true } },
        driver: { select: { id: true, name: true } },
      },
    })
    res.json(orders)
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * GET /api/orders/:id
 * Get a single order by ID.
 * @returns {Order}
 * @throws 404 if order not found
 */
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma')
    const order = await prisma.order.findFirst({
      where: { id: req.params.id, businessId: req.user!.businessId },
      include: {
        items: { include: { menuItem: true } },
        table: true,
        cashier: { select: { id: true, name: true } },
        driver: { select: { id: true, name: true } },
      },
    })
    if (!order) return res.status(404).json({ error: 'Order not found' })
    res.json(order)
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * PATCH /api/orders/:id/status
 * Update order status. Frees the table when delivered if no active orders remain.
 * Emits socket event 'order:statusUpdate'.
 * @body {status: OrderStatus}
 * @returns {Order}
 */
router.patch('/:id/status', authenticate, logAction('UPDATE', 'ORDER_STATUS'), async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma')
    const io: SocketIOServer = req.app.get('io')
    const { status } = req.body

    const existing = await prisma.order.findFirst({
      where: { id: req.params.id, businessId: req.user!.businessId },
    })
    if (!existing) {
      return res.status(404).json({ error: 'Order not found' })
    }

    if (status === 'DELIVERED' && existing.type === 'DELIVERY') {
      return res.status(403).json({
        error: 'Livraison confirmée par le livreur uniquement (code client requis)',
      })
    }

    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: { status },
      include: {
        items: { include: { menuItem: true } },
        table: true,
        driver: { select: { id: true, name: true } },
      },
    })

    // Libérer la table quand la commande est terminée ou livrée
    const terminalStatuses = ['COMPLETED', 'DELIVERED']
    if (terminalStatuses.includes(status) && order.tableId) {
      const activeOrders = await prisma.order.count({
        where: {
          tableId: order.tableId,
          status: { notIn: ['COMPLETED', 'DELIVERED', 'CANCELLED'] },
        },
      })
      if (activeOrders === 0) {
        await prisma.table.update({
          where: { id: order.tableId },
          data: { status: 'AVAILABLE' },
        })
      }
    }

    if (status === 'READY' || status === 'OUT_FOR_DELIVERY' || status === 'DELIVERED') {
      void notifyOrderStatusChange(order).catch((err) =>
        console.error('[notifications] status:', err),
      )
    } else if (status === 'PREPARING' || status === 'CONFIRMED') {
      void notifyOrderStatusChange(order).catch(() => {})
    }

    io.to(`business:${order.businessId}`).emit('order:statusUpdate', order)
    emitOrderTrackUpdate(io, order)
    res.json(order)
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * PATCH /api/orders/:id/assign-driver
 * Attribue un livreur à une livraison prête (KDS / admin).
 * @body { driverId: string }
 */
router.patch(
  '/:id/assign-driver',
  authenticate,
  logAction('UPDATE', 'ORDER_DRIVER'),
  async (req: AuthRequest, res: Response) => {
    try {
      const prisma: PrismaClient = req.app.get('prisma')
      const io: SocketIOServer = req.app.get('io')
      const { driverId } = req.body as { driverId?: string }

      if (!driverId?.trim()) {
        return res.status(400).json({ error: 'Livreur requis' })
      }

      const existing = await prisma.order.findFirst({
        where: { id: req.params.id, businessId: req.user!.businessId },
      })
      if (!existing) {
        return res.status(404).json({ error: 'Order not found' })
      }
      if (existing.type !== 'DELIVERY') {
        return res.status(400).json({ error: 'Réservé aux commandes livraison' })
      }
      if (!['READY', 'OUT_FOR_DELIVERY'].includes(existing.status)) {
        return res.status(400).json({ error: 'Commande non prête pour attribution livreur' })
      }

      const driver = await prisma.user.findFirst({
        where: {
          id: driverId.trim(),
          businessId: req.user!.businessId,
          role: 'DRIVER',
          isActive: true,
        },
        select: { id: true, name: true },
      })
      if (!driver) {
        return res.status(400).json({ error: 'Livreur invalide ou inactif' })
      }

      const order = await prisma.order.update({
        where: { id: existing.id },
        data: {
          driverId: driver.id,
          ...(existing.status === 'READY' ? { status: 'OUT_FOR_DELIVERY' } : {}),
        },
        include: {
          items: { include: { menuItem: true } },
          table: true,
          driver: { select: { id: true, name: true } },
        },
      })

      io.to(`business:${order.businessId}`).emit('order:statusUpdate', order)
      emitOrderTrackUpdate(io, order)
      res.json(order)
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' })
    }
  },
)

/**
 * PATCH /api/orders/:id/encash
 * Encaissement comptoir d'une commande en ligne non payée (POS / SUNMI).
 */
router.patch('/:id/encash', authenticate, logAction('UPDATE', 'ORDER_PAYMENT'), async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma')
    const io: SocketIOServer = req.app.get('io')
    const { paymentMethod, paymentMeta } = req.body as {
      paymentMethod?: string
      paymentMeta?: OrderPaymentMeta
    }

    if (!paymentMethod || !['CASH', 'CARD'].includes(paymentMethod)) {
      return res.status(400).json({ error: 'paymentMethod must be CASH or CARD' })
    }

    const existing = await prisma.order.findFirst({
      where: {
        id: req.params.id,
        businessId: req.user!.businessId,
        isOnlineOrder: true,
        status: 'PENDING_PAYMENT',
        paymentStatus: 'UNPAID',
        paymentMethod: 'COUNTER',
      },
    })
    if (!existing) {
      return res.status(404).json({ error: 'Commande non trouvée ou déjà encaissée' })
    }

    const order = await prisma.order.update({
      where: { id: existing.id },
      data: {
        paymentStatus: 'PAID',
        paymentMethod,
        status: 'CONFIRMED',
        ...applyPaymentMeta({ paymentMethod, paymentMeta }, existing.total),
      },
      include: {
        items: { include: { menuItem: true } },
        table: true,
      },
    })

    io.to(`business:${order.businessId}`).emit('order:new', order)
    io.to(`business:${order.businessId}`).emit('order:paymentUpdate', order)
    emitOrderTrackUpdate(io, order)

    void deductStockWithAlerts(
      prisma,
      order.businessId,
      order.id,
      order.items.map((i) => ({ menuItemId: i.menuItemId, quantity: i.quantity }))
    ).catch((err) => console.error('Stock deduct on encash:', err))

    void enqueueConfirmedOrderPrints(prisma, io, order.businessId, order.id)

    void ensureInvoiceForPaidOrder(prisma, order.businessId, order.id, req.user!.userId).catch((err) =>
      console.error('Auto invoice on encash:', err)
    )
    void ensureLoyaltyCreditForPaidOrder(prisma, order.businessId, order.id)

    try {
      assertManualCardPaymentMeta(paymentMethod, paymentMeta)
      await requireFiscalTicketForPaidOrder(prisma, order.businessId, order.id, req.user!.userId, {
        paymentMethod: order.paymentMethod,
      })
    } catch (fiscalErr) {
      await prisma.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: 'UNPAID',
          status: 'PENDING_PAYMENT',
        },
      })
      const msg = fiscalErr instanceof Error ? fiscalErr.message : 'Ticket fiscal impossible'
      return res.status(500).json({ error: msg })
    }

    res.json(order)
  } catch (error) {
    console.error('Encash order error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * PATCH /api/orders/:id/pos-settle
 * Finalisation caisse SUNMI : encaissement (UNPAID → PAID) ou remise client (PAID → COMPLETED).
 * La cuisine reste sur READY jusqu'à cette action — pas d'archivage depuis le KDS pour le comptoir.
 */
router.patch('/:id/pos-settle', authenticate, requireRole('ADMIN', 'MANAGER', 'CASHIER'), logAction('UPDATE', 'ORDER_POS_SETTLE'), async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma')
    const io: SocketIOServer = req.app.get('io')
    const { action, paymentMethod } = req.body as { action?: string; paymentMethod?: string }

    if (!action || !['pay', 'handover'].includes(action)) {
      return res.status(400).json({ error: 'action must be pay or handover' })
    }

    const existing = await prisma.order.findFirst({
      where: {
        id: req.params.id,
        businessId: req.user!.businessId,
        status: 'READY',
      },
    })
    if (!existing) {
      return res.status(404).json({ error: 'Commande introuvable ou pas encore prête' })
    }

    if (action === 'pay') {
      if (existing.paymentStatus !== 'UNPAID') {
        return res.status(400).json({ error: 'Commande déjà payée' })
      }
      if (!paymentMethod || !['CASH', 'CARD'].includes(paymentMethod)) {
        return res.status(400).json({ error: 'paymentMethod must be CASH or CARD' })
      }
    } else {
      if (existing.paymentStatus !== 'PAID') {
        return res.status(400).json({ error: 'Encaissement requis avant remise' })
      }
      if (existing.type === 'DELIVERY') {
        return res.status(400).json({ error: 'Livraison gérée depuis le KDS' })
      }
    }

    const order = await prisma.order.update({
      where: { id: existing.id },
      data: {
        status: 'COMPLETED',
        ...(action === 'pay'
          ? { paymentStatus: 'PAID', paymentMethod }
          : {}),
      },
      include: {
        items: { include: { menuItem: true } },
        table: true,
      },
    })

    io.to(`business:${order.businessId}`).emit('order:statusUpdate', order)
    emitOrderTrackUpdate(io, order)

    if (action === 'pay') {
      void ensureInvoiceForPaidOrder(prisma, order.businessId, order.id, req.user!.userId).catch((err) =>
        console.error('Auto invoice on pos-settle:', err)
      )
      void ensureLoyaltyCreditForPaidOrder(prisma, order.businessId, order.id)
      try {
        await requireFiscalTicketForPaidOrder(prisma, order.businessId, order.id, req.user!.userId, {
          paymentMethod: order.paymentMethod,
        })
      } catch (fiscalErr) {
        await prisma.order.update({
          where: { id: order.id },
          data: { paymentStatus: 'UNPAID', status: 'READY' },
        })
        const msg = fiscalErr instanceof Error ? fiscalErr.message : 'Ticket fiscal impossible'
        return res.status(500).json({ error: msg })
      }
    }

    res.json(order)
  } catch (error) {
    console.error('POS settle error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * PATCH /api/orders/:orderId/items/:itemId/status
 * Update status of an individual item within an order (used by kitchen display).
 * Emits socket event 'order:itemStatusUpdate'.
 * @body {status: OrderStatus}
 * @returns {OrderItem}
 */
router.patch('/:orderId/items/:itemId/status', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma')
    const io: SocketIOServer = req.app.get('io')
    const { status } = req.body

    const item = await prisma.orderItem.update({
      where: { id: req.params.itemId },
      data: { status },
      include: { menuItem: true },
    })

    const order = await prisma.order.findUnique({
      where: { id: req.params.orderId },
      include: {
        items: { include: { menuItem: true } },
        table: true,
      },
    })

    if (order) {
      io.to(`business:${order.businessId}`).emit('order:itemStatusUpdate', {
        orderId: order.id,
        item,
        order,
      })
    }

    res.json(item)
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * PATCH /api/orders/:id/payment
 * Update payment status and method for an order.
 * Frees the table when paid if no active orders remain.
 * Emits socket event 'order:paymentUpdate'.
 * @body {paymentStatus: PaymentStatus, paymentMethod?: PaymentMethod}
 * @returns {Order}
 */
router.patch('/:id/payment', authenticate, requireRole('ADMIN', 'MANAGER', 'CASHIER'), async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma')
    const io: SocketIOServer = req.app.get('io')
    const { paymentStatus, paymentMethod } = req.body

    const existing = await prisma.order.findFirst({
      where: { id: req.params.id, businessId: req.user!.businessId },
    })
    if (!existing) return res.status(404).json({ error: 'Order not found' })

    if (existing.paymentStatus === 'PAID' && paymentStatus && paymentStatus !== 'PAID') {
      await assertOrderFiscallyMutable(prisma, existing.id, existing.businessId)
    }

    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: { paymentStatus, paymentMethod },
      include: {
        items: { include: { menuItem: true } },
        table: true,
      },
    })

    // Free table when paid
    if (paymentStatus === 'PAID' && order.tableId) {
      const activeOrders = await prisma.order.count({
        where: { tableId: order.tableId, status: { notIn: ['DELIVERED', 'CANCELLED'] } },
      })
      if (activeOrders === 0) {
        await prisma.table.update({
          where: { id: order.tableId! },
          data: { status: 'AVAILABLE' },
        })
      }
    }

    io.to(`business:${order.businessId}`).emit('order:paymentUpdate', order)

    if (paymentStatus === 'PAID') {
      if (existing.paymentStatus !== 'PAID' && order.status === 'CONFIRMED') {
        void deductStockWithAlerts(
          prisma,
          order.businessId,
          order.id,
          order.items.map((i) => ({ menuItemId: i.menuItemId, quantity: i.quantity })),
        ).catch((err) => console.error('Stock deduct on payment:', err))
      }
      void ensureInvoiceForPaidOrder(prisma, order.businessId, order.id, req.user!.userId).catch((err) =>
        console.error('Auto invoice on payment:', err)
      )
      void ensureLoyaltyCreditForPaidOrder(prisma, order.businessId, order.id)
      try {
        await requireFiscalTicketForPaidOrder(prisma, order.businessId, order.id, req.user!.userId, {
          paymentMethod: order.paymentMethod,
        })
      } catch (fiscalErr) {
        const msg = fiscalErr instanceof Error ? fiscalErr.message : 'Ticket fiscal impossible'
        return res.status(500).json({ error: msg })
      }
    }

    res.json(order)
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Internal server error'
    if (msg.includes('figée fiscalement')) {
      return res.status(409).json({ error: msg })
    }
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * PATCH /api/orders/:id/cancel
 * Annulation cuisine / caisse — motif, remise stock, sync POS & admin.
 * Emits socket events 'order:cancelled' and 'order:statusUpdate'.
 * @body { reason: OrderCancelReason, note?: string, source?: 'KITCHEN' | 'POS' | 'ADMIN' }
 * @returns {Order}
 */
router.patch('/:id/cancel', authenticate, logAction('UPDATE', 'ORDER_CANCEL'), async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma')
    const io: SocketIOServer = req.app.get('io')
    const { reason, note, source, refund } = req.body as {
      reason?: string
      note?: string
      source?: string
      /** false = annuler sans remboursement Stripe (défaut : true si PI Stripe) */
      refund?: boolean
    }

    if (!reason || !ORDER_CANCEL_REASONS.includes(reason as OrderCancelReason)) {
      return res.status(400).json({
        error: `reason required (${ORDER_CANCEL_REASONS.join(', ')})`,
      })
    }

    const existing = await prisma.order.findFirst({
      where: { id: req.params.id, businessId: req.user!.businessId },
      include: { items: { include: { menuItem: true } }, table: true },
    })
    if (!existing) return res.status(404).json({ error: 'Commande introuvable' })

    if (['COMPLETED', 'DELIVERED', 'CANCELLED'].includes(existing.status)) {
      return res.status(400).json({ error: 'Commande déjà clôturée ou annulée' })
    }

    const reasonLabel = CANCEL_REASON_LABEL[reason as OrderCancelReason]
    const sourceLabel = source === 'KITCHEN' ? 'cuisine' : source === 'POS' ? 'caisse' : 'staff'
    const cancelNoteText = note?.trim() || null
    const auditLine = `[Annulation ${sourceLabel}] ${reasonLabel}${cancelNoteText ? ` — ${cancelNoteText}` : ''}`

    if (existing.paymentStatus === 'PAID' && existing.stripePaymentIntentId) {
      const refundResult = await refundStripePaymentForOrder(prisma, existing, {
        refund: refund !== false,
      })
      if (!refundResult.ok) {
        return res.status(400).json({ error: refundResult.error })
      }
    }

    if (existing.paymentStatus === 'PAID') {
      try {
        await voidFiscalTicketForCancelledOrder(
          prisma,
          existing.businessId,
          existing.id,
          req.user!.userId,
          auditLine,
        )
      } catch (voidErr) {
        const msg = voidErr instanceof Error ? voidErr.message : 'Avoir fiscal impossible'
        return res.status(400).json({ error: msg })
      }
    }

    const order = await prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id: existing.id },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancelReason: reason,
          cancelNote: cancelNoteText,
          notes: existing.notes ? `${existing.notes}\n${auditLine}` : auditLine,
          ...(existing.paymentStatus === 'PAID' ? { paymentStatus: 'REFUNDED' } : {}),
        },
        include: { items: { include: { menuItem: true } }, table: true },
      })

      await restoreStockForOrder(
        tx,
        existing.businessId,
        existing.id,
        existing.items.map((i) => ({ menuItemId: i.menuItemId, quantity: i.quantity })),
        reasonLabel
      )

      if (existing.tableId) {
        await tx.table.update({
          where: { id: existing.tableId },
          data: { status: 'AVAILABLE' },
        })
      }

      return updated
    })

    const room = `business:${order.businessId}`
    io.to(room).emit('order:cancelled', order)
    io.to(room).emit('order:statusUpdate', order)
    emitOrderTrackUpdate(io, order)
    emitAdminLive(io, order.businessId, {
      domain: 'orders',
      action: 'cancel',
      label: 'Commande annulée',
      detail: `#${order.orderNumber} — ${reasonLabel}`,
    })

    res.json(order)
  } catch (error) {
    console.error('Cancel order error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * GET /api/orders/track-token/:token
 * Suivi client public par token (CDC §4.1 A5).
 */
router.get('/track-token/:token', async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma')
    const order = await prisma.order.findFirst({
      where: { trackingToken: req.params.token },
      include: {
        items: { include: { menuItem: true } },
        table: true,
      },
    })
    if (!order) return res.status(404).json({ error: 'Commande introuvable' })
    res.json(order)
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * GET /api/orders/track/:orderNumber
 * Public endpoint to look up an order by its order number.
 * @query {businessId: string}
 * @returns {Order}
 * @throws 400 if invalid order number
 * @throws 404 if order not found
 */
router.get('/track/:orderNumber', async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma')
    const orderNumber = parseInt(req.params.orderNumber)
    const businessId = req.query.businessId as string

    if (!orderNumber) return res.status(400).json({ error: 'Invalid order number' })

    const order = await prisma.order.findFirst({
      where: { orderNumber, businessId },
      include: {
        items: { include: { menuItem: true } },
        table: true,
      },
    })

    if (!order) return res.status(404).json({ error: 'Order not found' })

    res.json(order)
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * POST /api/orders/call-waiter
 * Public endpoint for customers to call a waiter from their table.
 * Emits socket event 'waiter:called'.
 * @body {tableId?, businessId, message?}
 * @returns {success, callData}
 */
router.post('/call-waiter', async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma')
    const io: SocketIOServer = req.app.get('io')
    const { tableId, businessId, message } = req.body

    const table = tableId ? await prisma.table.findUnique({ where: { id: tableId } }) : null

    const callData = {
      tableId,
      tableNumber: table?.number || 'Unknown',
      message: message || 'طلب نادل',
      timestamp: new Date().toISOString(),
    }

    io.to(`business:${businessId}`).emit('waiter:called', callData)

    res.json({ success: true, callData })
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * GET /api/orders/active
 * Get the active (non-delivered/non-cancelled) order for a table.
 * @query {tableId: string, businessId: string}
 * @returns {Order | null}
 * @throws 400 if tableId or businessId missing
 */
router.get('/active', async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma')
    const { tableId, businessId } = req.query

    if (!tableId || !businessId) {
      return res.status(400).json({ error: 'tableId and businessId required' })
    }

    const order = await prisma.order.findFirst({
      where: {
        tableId: tableId as string,
        businessId: businessId as string,
        status: { notIn: ['DELIVERED', 'CANCELLED'] },
      },
      include: {
        items: { include: { menuItem: true } },
        table: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    res.json(order)
  } catch (error) {
    console.error('Get active order error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * POST /api/orders/:id/items
 * Add items to an existing order (continue ordering).
 * Emits socket events 'order:statusUpdate' and 'kitchen:itemsAdded'.
 * @body {items: Array<{menuItemId, quantity, notes?, selectedModifiers?}>}
 * @returns {Order} updated order
 * @throws 400 if order is delivered/cancelled or item unavailable
 * @throws 404 if order not found
 */
router.post('/:id/items', async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma')
    const io: SocketIOServer = req.app.get('io')
    const { items } = req.body
    const orderId = req.params.id

    const existingOrder = await prisma.order.findUnique({
      where: { id: orderId },
      include: { table: true },
    })
    if (!existingOrder) return res.status(404).json({ error: 'Order not found' })
    if (existingOrder.status === 'DELIVERED' || existingOrder.status === 'CANCELLED') {
      return res.status(400).json({ error: 'Cannot add items to delivered/cancelled order' })
    }
    if (existingOrder.paymentStatus === 'PAID') {
      await assertOrderFiscallyMutable(prisma, orderId, existingOrder.businessId)
    }

    let additionalSubtotal = 0
    const newItemsData = []
    const vatLines: OrderVatLine[] = []

    for (const item of items) {
      const menuItem = await prisma.menuItem.findUnique({ where: { id: item.menuItemId } })
      if (!menuItem || !menuItem.isAvailable) {
        return res.status(400).json({ error: `Item ${item.menuItemId} not available` })
      }
      const itemPrice = menuItem.discountPrice || menuItem.price
      additionalSubtotal += itemPrice * item.quantity
      vatLines.push({
        quantity: item.quantity,
        unitPriceCents: itemPrice,
        vatRateBps: menuItem.vatRateBps,
      })
      newItemsData.push({
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        price: itemPrice,
        notes: item.notes || null,
        selectedModifiers: item.selectedModifiers || {},
        sortOrder: item.sortOrder || 0,
      })
    }

    const settings = await prisma.business.findUnique({ where: { id: existingOrder.businessId } })
    const defaultVatBps = defaultVatBpsFromTaxRate(settings?.taxRate ?? 10)
    const vatLinesResolved = vatLines.map((l) => ({
      ...l,
      vatRateBps: l.vatRateBps ?? defaultVatBps,
    }))
    const { tax, serviceCharge, total: addTotal } = computeOrderTotalsFromLines(vatLinesResolved, {
      priceMode: orderPriceMode(existingOrder),
      serviceRatePercent: settings?.serviceChargeRate ?? 0,
      orderType: existingOrder.type,
    })

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        subtotal: { increment: additionalSubtotal },
        tax: { increment: tax },
        serviceCharge: { increment: serviceCharge },
        total: { increment: addTotal },
        items: { create: newItemsData },
        status: 'PENDING',
      },
      include: {
        items: { include: { menuItem: true } },
        table: true,
      },
    })

    // Re-occupy table if it was freed
    if (existingOrder.tableId) {
      await prisma.table.update({
        where: { id: existingOrder.tableId },
        data: { status: 'OCCUPIED' },
      })
    }

    // Emit as a new order update to kitchen
    io.to(`business:${existingOrder.businessId}`).emit('order:statusUpdate', updatedOrder)
    io.to(`business:${existingOrder.businessId}`).emit('kitchen:itemsAdded', {
      orderId,
      items: newItemsData,
      order: updatedOrder,
    })

    res.json(updatedOrder)
  } catch (error) {
    console.error('Add items to order error:', error)
    const msg = error instanceof Error ? error.message : 'Internal server error'
    if (msg.includes('figée fiscalement')) {
      return res.status(409).json({ error: msg })
    }
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * POST /api/orders/:id/print
 * Enfile une impression cuisine ou étiquette sac (PrintJob + contenu texte).
 */
router.post('/:id/print', authenticate, logAction('CREATE', 'PRINT_JOB'), async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma')
    const io: SocketIOServer = req.app.get('io')
    const type = (req.body?.type as PrintTicketType) || 'KITCHEN'
    const isReprint = req.body?.reprint === true
    if (!['KITCHEN', 'BAG_LABEL', 'RECEIPT'].includes(type)) {
      return res.status(400).json({ error: 'type must be KITCHEN, BAG_LABEL or RECEIPT' })
    }
    if (isReprint && type !== 'RECEIPT') {
      return res.status(400).json({ error: 'reprint is only supported for RECEIPT' })
    }

    const order = await prisma.order.findFirst({
      where: { id: req.params.id, businessId: req.user!.businessId },
      include: {
        items: { include: { menuItem: true } },
        table: true,
      },
    })
    if (!order) return res.status(404).json({ error: 'Order not found' })

    let receiptMeta
    if (type === 'RECEIPT' && order.paymentStatus === 'PAID') {
      try {
        receiptMeta = await fiscalMetaForReceipt(
          prisma,
          req.user!.businessId,
          order.id,
          req.user!.userId,
          { isReprint },
        )
      } catch (e) {
        if (e instanceof FiscalReprintWindowError) {
          return res.status(400).json({ error: e.message })
        }
        throw e
      }
    } else if (isReprint) {
      return res.status(400).json({ error: 'Réimpression réservée aux commandes encaissées' })
    }

    const printJob = await enqueuePrintJob(
      prisma,
      io,
      req.user!.businessId,
      order.id,
      type,
      receiptMeta ? { receipt: receiptMeta } : undefined,
    )
    if (!printJob) return res.status(404).json({ error: 'Order not found' })

    const content = (printJob.payload as { text?: string })?.text ?? ''

    res.json({ printJob, content })
  } catch (error) {
    console.error('Print job error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * GET /api/orders/:id/receipt
 * Generate receipt data for an order (for thermal printer).
 * @returns {receiptData} formatted receipt object
 * @throws 404 if order not found
 */
router.get('/:id/receipt', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma')

    const order = await prisma.order.findFirst({
      where: { id: req.params.id, businessId: req.user!.businessId },
      include: {
        items: { include: { menuItem: true } },
        table: true,
        cashier: { select: { id: true, name: true } },
        driver: { select: { id: true, name: true } },
      },
    })

    if (!order) return res.status(404).json({ error: 'Order not found' })

    const business = await prisma.business.findUnique({ where: { id: req.user!.businessId } })

    const { generateReceiptData } = require('../services/printer')
    const receiptData = generateReceiptData(order, business)

    res.json(receiptData)
  } catch (error) {
    console.error('Receipt error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * POST /api/orders/:id/split
 * Split an order's items into multiple new orders.
 * @body {splits: Array<{items: string[]}>}
 * @returns {original: Order, splits: Order[]}
 * @throws 400 if order is already paid
 * @throws 404 if original order not found
 */
router.post('/:id/split', authenticate, requireRole('ADMIN', 'MANAGER', 'CASHIER'), async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma')
    const io: any = req.app.get('io')
    const { splits } = req.body // [{ items: string[] }] - array of item ID groups

    const originalOrder = await prisma.order.findFirst({
      where: { id: req.params.id, businessId: req.user!.businessId },
      include: { items: { include: { menuItem: true } }, table: true },
    })

    if (!originalOrder) return res.status(404).json({ error: 'Order not found' })
    if (originalOrder.paymentStatus === 'PAID') return res.status(400).json({ error: 'Cannot split a paid order' })

    const newOrders = []
    const movedItemIds: string[] = []

    for (const split of splits) {
      const itemIds = split.items as string[]
      if (!itemIds.length) continue

      const splitItems = originalOrder.items.filter(i => itemIds.includes(i.id))
      if (!splitItems.length) continue

      const settings = await prisma.business.findUnique({ where: { id: req.user!.businessId } })
      const defaultVatBps = defaultVatBpsFromTaxRate(settings?.taxRate ?? 10)
      const vatLines: OrderVatLine[] = splitItems.map((item) => ({
        quantity: item.quantity,
        unitPriceCents: item.price,
        vatRateBps: item.menuItem.vatRateBps ?? defaultVatBps,
      }))
      const { subtotal: splitSubtotal, tax, serviceCharge, total } = computeOrderTotalsFromLines(vatLines, {
        priceMode: orderPriceMode(originalOrder),
        serviceRatePercent: settings?.serviceChargeRate ?? 0,
        orderType: originalOrder.type,
      })

      const newOrder = await prisma.order.create({
        data: {
          businessId: originalOrder.businessId,
          orderNumber: generateOrderNumber(),
          tableId: originalOrder.tableId,
          customerName: originalOrder.customerName,
          type: originalOrder.type,
          subtotal: splitSubtotal,
          tax,
          serviceCharge,
          total,
          status: 'CONFIRMED',
          isOnlineOrder: false,
        },
      })

      // Move items to new order
      await prisma.orderItem.updateMany({
        where: { id: { in: itemIds } },
        data: { orderId: newOrder.id },
      })

      movedItemIds.push(...itemIds)

      const fullOrder = await prisma.order.findUnique({
        where: { id: newOrder.id },
        include: { items: { include: { menuItem: true } }, table: true },
      })

      newOrders.push(fullOrder)
      io.to(`business:${originalOrder.businessId}`).emit('order:new', fullOrder)
    }

    // Remove moved items from original order totals
    const remainingItems = originalOrder.items.filter(i => !movedItemIds.includes(i.id))
    if (remainingItems.length > 0) {
      const settings = await prisma.business.findUnique({ where: { id: req.user!.businessId } })
      const defaultVatBps = defaultVatBpsFromTaxRate(settings?.taxRate ?? 10)
      const vatLines: OrderVatLine[] = remainingItems.map((item) => ({
        quantity: item.quantity,
        unitPriceCents: item.price,
        vatRateBps: item.menuItem.vatRateBps ?? defaultVatBps,
      }))
      const { subtotal: remainingSubtotal, tax, serviceCharge, total } = computeOrderTotalsFromLines(
        vatLines,
        {
          priceMode: orderPriceMode(originalOrder),
          serviceRatePercent: settings?.serviceChargeRate ?? 0,
          orderType: originalOrder.type,
        },
      )

      await prisma.order.update({
        where: { id: originalOrder.id },
        data: {
          subtotal: remainingSubtotal,
          tax,
          serviceCharge,
          total,
        },
      })
    }

    const updatedOriginal = await prisma.order.findUnique({
      where: { id: originalOrder.id },
      include: { items: { include: { menuItem: true } }, table: true },
    })

    io.to(`business:${originalOrder.businessId}`).emit('order:statusUpdate', updatedOriginal)

    res.json({ original: updatedOriginal, splits: newOrders })
  } catch (error) {
    console.error('Split bill error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * GET /api/orders/customer/:phone
 * Public endpoint to get recent orders by customer phone number.
 * @query {businessId: string}
 * @returns {Order[]} last 10 orders
 */
router.get('/customer/:phone', async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma')
    const { phone } = req.params
    const businessId = req.query.businessId as string

    const orders = await prisma.order.findMany({
      where: { customerPhone: phone, businessId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        items: { include: { menuItem: true } },
        table: true,
      },
    })

    res.json(orders)
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
