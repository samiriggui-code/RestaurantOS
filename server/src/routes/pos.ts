import { Router, Response } from 'express';
import { Prisma, PrismaClient } from '@prisma/client';
import { Server as SocketIOServer } from 'socket.io';
import { authenticate, requireRole } from '../middleware/auth';
import { AuthRequest } from '../types';
import {
  computeOrderTotalsFromLines,
  defaultVatBpsFromTaxRate,
  type OrderVatLine,
} from '../lib/order-vat';
import { enqueueConfirmedOrderPrints } from '../lib/enqueue-order-prints';
import { deductStockWithAlerts } from '../lib/stock-deduct-alerts';
import { ensureInvoiceForPaidOrder } from '../lib/invoice-from-order';
import { ensureLoyaltyCreditForPaidOrder } from '../lib/loyalty-order';
import { requireFiscalTicketForPaidOrder } from '../lib/fiscal/hook-paid-order';
import { allocateOrderNumber } from '../lib/order-number';
import { randomBytes } from 'crypto';

const router = Router();

function generateTrackingToken(): string {
  return randomBytes(6).toString('hex');
}

type SyncOrderPayload = {
  offlineRef: string;
  offlineSoldAt?: string;
  items: Array<{
    menuItemId: string;
    quantity: number;
    price?: number;
    notes?: string | null;
    selectedModifiers?: Record<string, unknown>;
  }>;
  type?: string;
  paymentMethod?: string;
  customerName?: string;
  customerPhone?: string;
  notes?: string;
};

/**
 * POST /api/pos/sync
 * Rejoue les commandes comptoir mises en file IndexedDB hors-ligne (CDC §4.2 B5).
 */
router.post(
  '/sync',
  authenticate,
  requireRole('ADMIN', 'MANAGER', 'CASHIER'),
  async (req: AuthRequest, res: Response) => {
    try {
      const prisma: PrismaClient = req.app.get('prisma');
      const io: SocketIOServer = req.app.get('io');
      const businessId = req.user!.businessId;
      const orders = (req.body?.orders ?? []) as SyncOrderPayload[];

      if (!Array.isArray(orders) || orders.length === 0) {
        return res.status(400).json({ error: 'orders array required' });
      }

      const results: Array<{ offlineRef: string; orderId: string; created: boolean }> = [];

      for (const payload of orders) {
        if (!payload.offlineRef || !payload.items?.length) {
          continue;
        }

        const marker = `[offline:${payload.offlineRef}]`;
        const existing = await prisma.order.findFirst({
          where: { businessId, notes: { contains: marker } },
        });
        if (existing) {
          results.push({ offlineRef: payload.offlineRef, orderId: existing.id, created: false });
          continue;
        }

        let subtotal = 0;
        const orderItemsData: Prisma.OrderItemCreateWithoutOrderInput[] = [];
        const vatLines: OrderVatLine[] = [];
        for (const item of payload.items) {
          const menuItem = await prisma.menuItem.findUnique({ where: { id: item.menuItemId } });
          if (!menuItem || !menuItem.isAvailable || !menuItem.isActive) {
            return res.status(400).json({ error: `Item ${item.menuItemId} not available` });
          }
          const itemPrice =
            typeof item.price === 'number' && Number.isInteger(item.price) && item.price >= 0
              ? item.price
              : (menuItem.discountPrice ?? menuItem.price);
          subtotal += itemPrice * item.quantity;
          vatLines.push({
            quantity: item.quantity,
            unitPriceCents: itemPrice,
            vatRateBps: menuItem.vatRateBps,
          });
          orderItemsData.push({
            menuItem: { connect: { id: item.menuItemId } },
            quantity: item.quantity,
            price: itemPrice,
            notes: item.notes || null,
            selectedModifiers: (item.selectedModifiers ?? {}) as Prisma.InputJsonValue,
            sortOrder: 0,
          });
        }

        const settings = await prisma.business.findUnique({ where: { id: businessId } });
        const defaultVatBps = defaultVatBpsFromTaxRate(settings?.taxRate ?? 10);
        const vatLinesResolved = vatLines.map(l => ({
          ...l,
          vatRateBps: l.vatRateBps ?? defaultVatBps,
        }));
        const serviceRate = settings?.serviceChargeRate ?? 0;
        const orderType = payload.type || 'DINE_IN';
        const { tax, serviceCharge, total } = computeOrderTotalsFromLines(vatLinesResolved, {
          priceMode: 'HT',
          serviceRatePercent: serviceRate,
          orderType,
        });

        const userNotes = payload.notes?.trim() ?? '';
        const notes = userNotes ? `${userNotes}\n${marker}` : marker;

        const order = await prisma.$transaction(async tx => {
          const orderNumber = await allocateOrderNumber(tx, businessId);
          return tx.order.create({
            data: {
              businessId,
              orderNumber,
              customerName: payload.customerName || null,
              customerPhone: payload.customerPhone || null,
              type: orderType,
              status: 'CONFIRMED',
              paymentStatus: 'PAID',
              paymentMethod: payload.paymentMethod || 'CASH',
              subtotal,
              tax,
              serviceCharge,
              total,
              notes,
              isOnlineOrder: false,
              channel: 'POS',
              trackingToken: generateTrackingToken(),
              cashierId: req.user!.userId,
              items: { create: orderItemsData },
            },
            include: { items: { include: { menuItem: true } }, table: true },
          });
        });

        void deductStockWithAlerts(
          prisma,
          businessId,
          order.id,
          order.items.map(i => ({ menuItemId: i.menuItemId, quantity: i.quantity }))
        ).catch(err => console.error('Stock deduct on sync:', err));

        io.to(`business:${businessId}`).emit('order:new', order);
        void enqueueConfirmedOrderPrints(prisma, io, businessId, order.id);

        void ensureInvoiceForPaidOrder(prisma, businessId, order.id, req.user!.userId).catch(err =>
          console.error('Auto invoice on pos sync:', err)
        );
        void ensureLoyaltyCreditForPaidOrder(prisma, businessId, order.id);

        const offlineSoldAt = payload.offlineSoldAt ? new Date(payload.offlineSoldAt) : undefined;
        try {
          await requireFiscalTicketForPaidOrder(prisma, businessId, order.id, req.user!.userId, {
            offlineRef: payload.offlineRef,
            offlineSoldAt:
              offlineSoldAt && !Number.isNaN(offlineSoldAt.getTime()) ? offlineSoldAt : undefined,
            paymentMethod: order.paymentMethod,
          });
        } catch (fiscalErr) {
          await prisma.order.delete({ where: { id: order.id } }).catch(() => {});
          throw fiscalErr;
        }

        results.push({ offlineRef: payload.offlineRef, orderId: order.id, created: true });
      }

      res.json({ synced: results.length, results });
    } catch (err) {
      console.error('POS sync error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

export default router;
