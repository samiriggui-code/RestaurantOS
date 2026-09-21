import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { Server as SocketIOServer } from 'socket.io';
import { authenticate, optionalAuthenticate } from '../middleware/auth';
import { PERMISSION, requirePermission } from '../lib/permissions';
import { logAction } from '../middleware/auditLog';
import { AuthRequest } from '../types';
import {
  computeOrderTotalsFromLines,
  defaultVatBpsFromTaxRate,
  type OrderVatLine,
} from '../lib/order-vat';
import { orderPriceMode } from '../lib/invoice-vat';
import { type PrintTicketType, generateReceiptData } from '../services/printer';
import { enqueuePrintJob } from '../lib/enqueue-print-job';
import { assertOrderFiscallyMutable } from '../lib/fiscal/guards';
import { fiscalMetaForReceipt, FiscalReprintWindowError } from '../lib/fiscal/receipt-meta';
import { type OrderPaymentMeta } from '../lib/payment-meta';
import { shouldExcludeUnpaidOrders, UNPAID_PENDING_ORDER_FILTER } from '../lib/order-list-filters';
import { ORDER_CANCEL_REASONS, type OrderCancelReason, cancelOrder } from '../lib/order-cancel';
import { assignDriverToOrder } from '../lib/order-assign-driver';
import { encashOrder } from '../lib/order-encash';
import { posSettleOrder } from '../lib/order-pos-settle';
import { updateOrderPayment } from '../lib/order-payment-update';
import { updateOrderStatus } from '../lib/order-update-status';
import { createOrder } from '../lib/order-create';
import { splitOrder } from '../lib/order-split';
import { mergeOrders } from '../lib/order-merge';
import { transferOrder } from '../lib/order-transfer';

export { ORDER_CANCEL_REASONS, type OrderCancelReason };

const router = Router();

const ordersRead = [authenticate, requirePermission(PERMISSION.ORDERS_READ)] as const;
const ordersWrite = [authenticate, requirePermission(PERMISSION.ORDERS_WRITE)] as const;
const ordersPayment = [authenticate, requirePermission(PERMISSION.ORDERS_PAYMENT)] as const;
const ordersCancel = [authenticate, requirePermission(PERMISSION.ORDERS_CANCEL)] as const;
const ordersAssignDriver = [
  authenticate,
  requirePermission(PERMISSION.ORDERS_ASSIGN_DRIVER),
] as const;
const ordersCustomerPii = [
  authenticate,
  requirePermission(PERMISSION.ORDERS_CUSTOMER_PII),
] as const;

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
    const prisma: PrismaClient = req.app.get('prisma');
    const io: SocketIOServer = req.app.get('io');
    const result = await createOrder(prisma, io, {
      body: req.body,
      userId: req.user?.userId,
      userBusinessId: req.user?.businessId,
    });
    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }
    res.status(201).json(result.order);
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/orders
 * Get orders with optional filters (status, type, date range).
 * @query {status?, type?, dateFrom?, dateTo?, limit?}
 * @returns {Order[]}
 */
router.get('/', ...ordersRead, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma');
    const {
      status,
      type,
      dateFrom,
      dateTo,
      limit,
      isOnlineOrder,
      paymentStatus,
      paymentMethod,
      channel,
    } = req.query;

    const where: Record<string, unknown> = { businessId: req.user!.businessId };
    if (status) {
      const statuses = (status as string)
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
      where.status = statuses.length > 1 ? { in: statuses } : statuses[0];
    }
    if (type) {
      const types = (type as string)
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
      where.type = types.length > 1 ? { in: types } : types[0];
    }
    if (isOnlineOrder !== undefined && isOnlineOrder !== '') {
      where.isOnlineOrder = isOnlineOrder === 'true';
    }
    if (paymentStatus) {
      where.paymentStatus = paymentStatus as string;
    }
    if (paymentMethod) {
      where.paymentMethod = paymentMethod as string;
    }
    if (channel) {
      where.channel = channel as string;
    }
    if (dateFrom || dateTo) {
      const createdAt: { gte?: Date; lte?: Date } = {};
      if (dateFrom) createdAt.gte = new Date(dateFrom as string);
      if (dateTo) createdAt.lte = new Date(dateTo as string);
      where.createdAt = createdAt;
    }

    // Exclure commandes impayées (tentatives CB abandonnées, comptoir non encaissé)
    if (
      shouldExcludeUnpaidOrders({
        includeUnpaid: req.query.includeUnpaid as string | undefined,
        paymentStatus: paymentStatus as string | undefined,
        status: status as string | undefined,
      })
    ) {
      where.NOT = UNPAID_PENDING_ORDER_FILTER;
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
    });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/orders/track-token/:token
 * Suivi client public par token (CDC §4.1 A5).
 */
router.get('/track-token/:token', async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma');
    const order = await prisma.order.findFirst({
      where: { trackingToken: req.params.token },
      include: {
        items: { include: { menuItem: true } },
        table: true,
      },
    });
    if (!order) return res.status(404).json({ error: 'Commande introuvable' });
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/orders/track/:orderNumber
 * Staff only — lookup par n° dans le tenant JWT.
 * Suivi client public : GET /api/public/orders/track-token/:token (pas d’énumération).
 */
router.get('/track/:orderNumber', ...ordersRead, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma');
    const orderNumber = parseInt(req.params.orderNumber, 10);
    const businessId = req.user!.businessId;

    if (!Number.isFinite(orderNumber) || orderNumber < 1) {
      return res.status(400).json({ error: 'Invalid order number' });
    }

    const order = await prisma.order.findFirst({
      where: { orderNumber, businessId },
      include: {
        items: { include: { menuItem: true } },
        table: true,
      },
    });

    if (!order) return res.status(404).json({ error: 'Order not found' });

    res.json(order);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/orders/call-waiter
 * Public endpoint for customers to call a waiter from their table.
 * Emits socket event 'waiter:called'.
 * @body {tableId?, businessId, message?}
 * @returns {success, callData}
 */
router.post('/call-waiter', async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma');
    const io: SocketIOServer = req.app.get('io');
    const { tableId, businessId, message } = req.body;

    const table = tableId ? await prisma.table.findUnique({ where: { id: tableId } }) : null;

    const callData = {
      tableId,
      tableNumber: table?.number || 'Unknown',
      message: message || 'طلب نادل',
      timestamp: new Date().toISOString(),
    };

    io.to(`business:${businessId}`).emit('waiter:called', callData);

    res.json({ success: true, callData });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/orders/active
 * Get the active (non-delivered/non-cancelled) order for a table.
 * @query {tableId: string, businessId: string}
 * @returns {Order | null}
 * @throws 400 if tableId missing
 */
router.get('/active', ...ordersRead, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma');
    const { tableId } = req.query;
    const businessId = req.user!.businessId;

    if (!tableId) {
      return res.status(400).json({ error: 'tableId required' });
    }

    const order = await prisma.order.findFirst({
      where: {
        tableId: tableId as string,
        businessId,
        status: { notIn: ['DELIVERED', 'CANCELLED'] },
      },
      include: {
        items: { include: { menuItem: true } },
        table: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(order);
  } catch (error) {
    console.error('Get active order error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/orders/customer/:phone
 * Staff lookup of recent orders by customer phone (PII — ORDERS_CUSTOMER_PII).
 * businessId = JWT tenant
 * @returns {Order[]} last 10 orders
 */
router.get('/customer/:phone', ...ordersCustomerPii, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma');
    const { phone } = req.params;
    const businessId = req.user!.businessId;

    const orders = await prisma.order.findMany({
      where: { customerPhone: phone, businessId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        items: { include: { menuItem: true } },
        table: true,
      },
    });

    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/orders/:id
 * Get a single order by ID.
 * @returns {Order}
 * @throws 404 if order not found
 */
router.get('/:id', ...ordersRead, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma');
    const order = await prisma.order.findFirst({
      where: { id: req.params.id, businessId: req.user!.businessId },
      include: {
        items: { include: { menuItem: true } },
        table: true,
        cashier: { select: { id: true, name: true } },
        driver: { select: { id: true, name: true } },
      },
    });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PATCH /api/orders/:id/status
 * Update order status. Frees the table when delivered if no active orders remain.
 * Emits socket event 'order:statusUpdate'.
 * @body {status: OrderStatus}
 * @returns {Order}
 */
router.patch(
  '/:id/status',
  ...ordersWrite,
  logAction('UPDATE', 'ORDER_STATUS'),
  async (req: AuthRequest, res: Response) => {
    try {
      const prisma: PrismaClient = req.app.get('prisma');
      const io: SocketIOServer = req.app.get('io');
      const { status, forceDelivered } = req.body as {
        status?: string;
        forceDelivered?: boolean;
      };

      const result = await updateOrderStatus(prisma, io, {
        orderId: req.params.id,
        businessId: req.user!.businessId,
        status: status!,
        forceDelivered: forceDelivered === true,
        actorRole: req.user!.role,
        actorUserId: req.user!.userId,
      });
      if (!result.ok) {
        return res.status(result.status).json({ error: result.error });
      }
      res.json(result.order);
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * PATCH /api/orders/:id/assign-driver
 * Attribue un livreur à une livraison prête (KDS / admin).
 * @body { driverId: string }
 */
router.patch(
  '/:id/assign-driver',
  ...ordersAssignDriver,
  logAction('UPDATE', 'ORDER_DRIVER'),
  async (req: AuthRequest, res: Response) => {
    try {
      const prisma: PrismaClient = req.app.get('prisma');
      const io: SocketIOServer = req.app.get('io');
      const { driverId } = req.body as { driverId?: string };

      const result = await assignDriverToOrder(prisma, io, {
        orderId: req.params.id,
        businessId: req.user!.businessId,
        driverId: driverId ?? '',
      });
      if (!result.ok) {
        return res.status(result.status).json({ error: result.error });
      }
      res.json(result.order);
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * PATCH /api/orders/:id/encash
 * Encaissement comptoir d'une commande en ligne non payée (POS / SUNMI).
 */
router.patch(
  '/:id/encash',
  ...ordersPayment,
  logAction('UPDATE', 'ORDER_PAYMENT'),
  async (req: AuthRequest, res: Response) => {
    try {
      const prisma: PrismaClient = req.app.get('prisma');
      const io: SocketIOServer = req.app.get('io');
      const { paymentMethod, paymentMeta } = req.body as {
        paymentMethod?: string;
        paymentMeta?: OrderPaymentMeta;
      };

      const result = await encashOrder(prisma, io, {
        orderId: req.params.id,
        businessId: req.user!.businessId,
        userId: req.user!.userId,
        paymentMethod: paymentMethod ?? '',
        paymentMeta,
      });
      if (!result.ok) {
        return res.status(result.status).json({ error: result.error });
      }
      res.json(result.order);
    } catch (error) {
      console.error('Encash order error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * PATCH /api/orders/:id/pos-settle
 * Finalisation caisse SUNMI : encaissement (UNPAID → PAID) ou remise client (PAID → COMPLETED).
 * La cuisine reste sur READY jusqu'à cette action — pas d'archivage depuis le KDS pour le comptoir.
 */
router.patch(
  '/:id/pos-settle',
  ...ordersPayment,
  logAction('UPDATE', 'ORDER_POS_SETTLE'),
  async (req: AuthRequest, res: Response) => {
    try {
      const prisma: PrismaClient = req.app.get('prisma');
      const io: SocketIOServer = req.app.get('io');
      const { action, paymentMethod } = req.body as { action?: string; paymentMethod?: string };

      const result = await posSettleOrder(prisma, io, {
        orderId: req.params.id,
        businessId: req.user!.businessId,
        userId: req.user!.userId,
        action: action ?? '',
        paymentMethod,
      });
      if (!result.ok) {
        return res.status(result.status).json({ error: result.error });
      }
      res.json(result.order);
    } catch (error) {
      console.error('POS settle error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * PATCH /api/orders/:orderId/items/:itemId/status
 * Update status of an individual item within an order (used by kitchen display).
 * Emits socket event 'order:itemStatusUpdate'.
 * @body {status: OrderStatus}
 * @returns {OrderItem}
 */
router.patch(
  '/:orderId/items/:itemId/status',
  ...ordersWrite,
  async (req: AuthRequest, res: Response) => {
    try {
      const prisma: PrismaClient = req.app.get('prisma');
      const io: SocketIOServer = req.app.get('io');
      const { status } = req.body;

      const item = await prisma.orderItem.update({
        where: { id: req.params.itemId },
        data: { status },
        include: { menuItem: true },
      });

      const order = await prisma.order.findUnique({
        where: { id: req.params.orderId },
        include: {
          items: { include: { menuItem: true } },
          table: true,
        },
      });

      if (order) {
        io.to(`business:${order.businessId}`).emit('order:itemStatusUpdate', {
          orderId: order.id,
          item,
          order,
        });
      }

      res.json(item);
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * PATCH /api/orders/:id/payment
 * Update payment status and method for an order.
 * Frees the table when paid if no active orders remain.
 * Emits socket event 'order:paymentUpdate'.
 * @body {paymentStatus: PaymentStatus, paymentMethod?: PaymentMethod}
 * @returns {Order}
 */
router.patch('/:id/payment', ...ordersPayment, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma');
    const io: SocketIOServer = req.app.get('io');
    const { paymentStatus, paymentMethod } = req.body;

    const result = await updateOrderPayment(prisma, io, {
      orderId: req.params.id,
      businessId: req.user!.businessId,
      userId: req.user!.userId,
      paymentStatus,
      paymentMethod,
    });
    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }
    res.json(result.order);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Internal server error';
    if (msg.includes('figée fiscalement')) {
      return res.status(409).json({ error: msg });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PATCH /api/orders/:id/cancel
 * Annulation cuisine / caisse — motif, remise stock, sync POS & admin.
 * Emits socket events 'order:cancelled' and 'order:statusUpdate'.
 * @body { reason: OrderCancelReason, note?: string, source?: 'KITCHEN' | 'POS' | 'ADMIN' }
 * @returns {Order}
 */
router.patch(
  '/:id/cancel',
  ...ordersCancel,
  logAction('UPDATE', 'ORDER_CANCEL'),
  async (req: AuthRequest, res: Response) => {
    try {
      const prisma: PrismaClient = req.app.get('prisma');
      const io: SocketIOServer = req.app.get('io');
      const { reason, note, source, refund } = req.body as {
        reason?: string;
        note?: string;
        source?: string;
        refund?: boolean;
      };

      if (!reason || !ORDER_CANCEL_REASONS.includes(reason as OrderCancelReason)) {
        return res.status(400).json({
          error: `reason required (${ORDER_CANCEL_REASONS.join(', ')})`,
        });
      }

      const result = await cancelOrder(prisma, io, {
        orderId: req.params.id,
        businessId: req.user!.businessId,
        userId: req.user!.userId,
        reason: reason as OrderCancelReason,
        note,
        source,
        refund,
      });
      if (!result.ok) {
        return res.status(result.status).json({ error: result.error });
      }
      res.json(result.order);
    } catch (error) {
      console.error('Cancel order error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * POST /api/orders/:id/items
 * Add items to an existing order (continue ordering).
 * Emits socket events 'order:statusUpdate' and 'kitchen:itemsAdded'.
 * @body {items: Array<{menuItemId, quantity, notes?, selectedModifiers?}>}
 * @returns {Order} updated order
 * @throws 400 if order is delivered/cancelled or item unavailable
 * @throws 404 if order not found
 */
router.post('/:id/items', ...ordersWrite, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma');
    const io: SocketIOServer = req.app.get('io');
    const { items } = req.body;
    const orderId = req.params.id;

    const existingOrder = await prisma.order.findFirst({
      where: { id: orderId, businessId: req.user!.businessId },
      include: { table: true },
    });
    if (!existingOrder) return res.status(404).json({ error: 'Order not found' });
    if (existingOrder.status === 'DELIVERED' || existingOrder.status === 'CANCELLED') {
      return res.status(400).json({ error: 'Cannot add items to delivered/cancelled order' });
    }
    if (existingOrder.paymentStatus === 'PAID') {
      await assertOrderFiscallyMutable(prisma, orderId, existingOrder.businessId);
    }

    let additionalSubtotal = 0;
    const newItemsData = [];
    const vatLines: OrderVatLine[] = [];

    for (const item of items) {
      const menuItem = await prisma.menuItem.findUnique({ where: { id: item.menuItemId } });
      if (!menuItem || !menuItem.isAvailable) {
        return res.status(400).json({ error: `Item ${item.menuItemId} not available` });
      }
      const itemPrice = menuItem.discountPrice || menuItem.price;
      additionalSubtotal += itemPrice * item.quantity;
      vatLines.push({
        quantity: item.quantity,
        unitPriceCents: itemPrice,
        vatRateBps: menuItem.vatRateBps,
      });
      newItemsData.push({
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        price: itemPrice,
        notes: item.notes || null,
        selectedModifiers: item.selectedModifiers || {},
        sortOrder: item.sortOrder || 0,
      });
    }

    const settings = await prisma.business.findUnique({ where: { id: existingOrder.businessId } });
    const defaultVatBps = defaultVatBpsFromTaxRate(settings?.taxRate ?? 10);
    const vatLinesResolved = vatLines.map(l => ({
      ...l,
      vatRateBps: l.vatRateBps ?? defaultVatBps,
    }));
    const {
      tax,
      serviceCharge,
      total: addTotal,
    } = computeOrderTotalsFromLines(vatLinesResolved, {
      priceMode: orderPriceMode(existingOrder),
      serviceRatePercent: settings?.serviceChargeRate ?? 0,
      orderType: existingOrder.type,
    });

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        subtotal: { increment: additionalSubtotal },
        tax: { increment: tax },
        serviceCharge: { increment: serviceCharge },
        total: { increment: addTotal },
        items: { create: newItemsData },
        status: 'CONFIRMED',
      },
      include: {
        items: { include: { menuItem: true } },
        table: true,
      },
    });

    // Re-occupy table if it was freed
    if (existingOrder.tableId) {
      await prisma.table.update({
        where: { id: existingOrder.tableId },
        data: { status: 'OCCUPIED' },
      });
    }

    // Emit as a new order update to kitchen
    io.to(`business:${existingOrder.businessId}`).emit('order:statusUpdate', updatedOrder);
    io.to(`business:${existingOrder.businessId}`).emit('kitchen:itemsAdded', {
      orderId,
      items: newItemsData,
      order: updatedOrder,
    });

    res.json(updatedOrder);
  } catch (error) {
    console.error('Add items to order error:', error);
    const msg = error instanceof Error ? error.message : 'Internal server error';
    if (msg.includes('figée fiscalement')) {
      return res.status(409).json({ error: msg });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/orders/:id/print
 * Enfile une impression cuisine ou étiquette sac (PrintJob + contenu texte).
 */
router.post(
  '/:id/print',
  ...ordersWrite,
  logAction('CREATE', 'PRINT_JOB'),
  async (req: AuthRequest, res: Response) => {
    try {
      const prisma: PrismaClient = req.app.get('prisma');
      const io: SocketIOServer = req.app.get('io');
      const type = (req.body?.type as PrintTicketType) || 'KITCHEN';
      const isReprint = req.body?.reprint === true;
      if (!['KITCHEN', 'BAG_LABEL', 'RECEIPT'].includes(type)) {
        return res.status(400).json({ error: 'type must be KITCHEN, BAG_LABEL or RECEIPT' });
      }
      if (isReprint && type !== 'RECEIPT') {
        return res.status(400).json({ error: 'reprint is only supported for RECEIPT' });
      }

      const order = await prisma.order.findFirst({
        where: { id: req.params.id, businessId: req.user!.businessId },
        include: {
          items: { include: { menuItem: true } },
          table: true,
        },
      });
      if (!order) return res.status(404).json({ error: 'Order not found' });

      let receiptMeta;
      if (type === 'RECEIPT' && order.paymentStatus === 'PAID') {
        try {
          receiptMeta = await fiscalMetaForReceipt(
            prisma,
            req.user!.businessId,
            order.id,
            req.user!.userId,
            { isReprint }
          );
        } catch (e) {
          if (e instanceof FiscalReprintWindowError) {
            return res.status(400).json({ error: e.message });
          }
          throw e;
        }
      } else if (isReprint) {
        return res.status(400).json({ error: 'Réimpression réservée aux commandes encaissées' });
      }

      const printJob = await enqueuePrintJob(
        prisma,
        io,
        req.user!.businessId,
        order.id,
        type,
        receiptMeta ? { receipt: receiptMeta } : undefined
      );
      if (!printJob) return res.status(404).json({ error: 'Order not found' });

      const content = (printJob.payload as { text?: string })?.text ?? '';

      res.json({ printJob, content });
    } catch (error) {
      console.error('Print job error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * GET /api/orders/:id/receipt
 * Generate receipt data for an order (for thermal printer).
 * @returns {receiptData} formatted receipt object
 * @throws 404 if order not found
 */
router.get('/:id/receipt', ...ordersRead, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma');

    const order = await prisma.order.findFirst({
      where: { id: req.params.id, businessId: req.user!.businessId },
      include: {
        items: { include: { menuItem: true } },
        table: true,
        cashier: { select: { id: true, name: true } },
        driver: { select: { id: true, name: true } },
      },
    });

    if (!order) return res.status(404).json({ error: 'Order not found' });

    const business = await prisma.business.findUnique({ where: { id: req.user!.businessId } });
    if (!business) return res.status(404).json({ error: 'Business not found' });

    const receiptData = generateReceiptData(order, business);

    res.json(receiptData);
  } catch (error) {
    console.error('Receipt error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/orders/:id/split
 * Split an order's items into multiple new orders.
 * @body {splits: Array<{items: string[]}>}
 * @returns {original: Order, splits: Order[]}
 * @throws 400 if order is already paid
 * @throws 404 if original order not found
 */
router.post('/:id/split', ...ordersPayment, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma');
    const io: SocketIOServer | undefined = req.app.get('io');
    const { splits } = req.body as { splits?: Array<{ items: string[] }> };
    if (!Array.isArray(splits) || splits.length === 0) {
      return res.status(400).json({ error: 'splits requis (Array<{items: string[]}>)' });
    }

    const result = await splitOrder(prisma, io, {
      orderId: req.params.id,
      businessId: req.user!.businessId,
      splits,
    });
    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }
    res.json({ original: result.original, splits: result.splits });
  } catch (error) {
    console.error('Split bill error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PATCH /api/orders/:id/transfer
 * Réassigne une commande ouverte à une autre table et/ou un autre cashier/serveur,
 * sans passer par annulation (Phase F).
 * @body {tableId?: string | null, cashierId?: string | null}
 * @returns {order: Order}
 * @throws 400 if order is paid/terminal, or neither field provided
 * @throws 404 if order/table/cashier not found
 */
router.patch('/:id/transfer', ...ordersPayment, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma');
    const io: SocketIOServer | undefined = req.app.get('io');
    const { tableId, cashierId } = req.body as {
      tableId?: string | null;
      cashierId?: string | null;
    };

    const result = await transferOrder(prisma, io, {
      orderId: req.params.id,
      businessId: req.user!.businessId,
      tableId,
      cashierId,
    });
    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }
    res.json({ order: result.order });
  } catch (error) {
    console.error('Transfer order error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/orders/merge
 * Fusionne plusieurs commandes non payées dans une commande cible.
 * @body {targetOrderId: string, sourceOrderIds: string[]}
 * @returns {target: Order}
 * @throws 400 if any order is paid/closed
 * @throws 404 if any order not found
 */
router.post('/merge', ...ordersPayment, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma');
    const io: SocketIOServer | undefined = req.app.get('io');
    const { targetOrderId, sourceOrderIds } = req.body as {
      targetOrderId?: string;
      sourceOrderIds?: string[];
    };
    if (!targetOrderId || !Array.isArray(sourceOrderIds) || sourceOrderIds.length === 0) {
      return res
        .status(400)
        .json({ error: 'targetOrderId et sourceOrderIds (Array<string> non vide) requis' });
    }

    const result = await mergeOrders(prisma, io, {
      targetOrderId,
      sourceOrderIds,
      businessId: req.user!.businessId,
    });
    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }
    res.json({ target: result.target });
  } catch (error) {
    console.error('Merge bill error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
