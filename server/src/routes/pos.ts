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
import { runPaidOrderSideEffects } from '../lib/paid-order-side-effects';
import { requireFiscalTicketForPaidOrder } from '../lib/fiscal/hook-paid-order';
import { allocateOrderNumber } from '../lib/order-number';
import { randomBytes } from 'crypto';
import { PERMISSION, requirePermission } from '../lib/permissions';
import { openPosSession, closePosSession, getCurrentPosSession } from '../lib/pos-session';
import { emitAdminLive } from '../lib/admin-live-events';

const router = Router();

const posSession = [authenticate, requirePermission(PERMISSION.POS_SESSION)] as const;

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

        io.to(`business:${businessId}`).emit('order:new', order);
        void enqueueConfirmedOrderPrints(prisma, io, businessId, order.id);

        const offlineSoldAt = payload.offlineSoldAt ? new Date(payload.offlineSoldAt) : undefined;
        try {
          await requireFiscalTicketForPaidOrder(prisma, businessId, order.id, req.user!.userId, {
            offlineRef: payload.offlineRef,
            offlineSoldAt:
              offlineSoldAt && !Number.isNaN(offlineSoldAt.getTime()) ? offlineSoldAt : undefined,
            paymentMethod: order.paymentMethod,
          });
        } catch (fiscalErr) {
          // Ne jamais supprimer une vente déjà créée / éventuellement imprimée localement.
          console.error('[pos/sync] fiscal CRITICAL — commande conservée', order.id, fiscalErr);
          emitAdminLive(io, businessId, {
            domain: 'orders',
            action: 'fiscal_error',
            label: 'Ticket fiscal sync offline',
            detail: `Commande #${order.orderNumber} (offline) — ticket non émis, vente conservée`,
          });
        }

        try {
          await runPaidOrderSideEffects(prisma, {
            businessId,
            orderId: order.id,
            stockItems: order.items.map(i => ({ menuItemId: i.menuItemId, quantity: i.quantity })),
            userId: req.user!.userId,
          });
        } catch (sideErr) {
          console.error(
            '[pos/sync] stock/facture CRITICAL — commande conservée',
            order.id,
            sideErr
          );
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

/**
 * GET /api/pos/session/current
 * Session de caisse ouverte pour le cashier connecté, ou null.
 * (Avant /session/:id pour éviter toute ambiguïté Express.)
 */
router.get('/session/current', ...posSession, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma');
    const session = await getCurrentPosSession(prisma, {
      businessId: req.user!.businessId,
      cashierId: req.user!.userId,
    });
    res.json(session);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/pos/session/open
 * Ouvre une session de caisse (fond de caisse déclaré).
 * @body { openingCashAmount: number }
 */
router.post('/session/open', ...posSession, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma');
    const { openingCashAmount } = req.body as { openingCashAmount?: number };

    const result = await openPosSession(prisma, {
      businessId: req.user!.businessId,
      cashierId: req.user!.userId,
      openingCashAmount: Number(openingCashAmount),
    });
    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }
    res.status(201).json(result.session);
  } catch (error) {
    console.error('POS session open error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/pos/session/:id/close
 * Clôture une session de caisse — calcule l'écart avec les encaissements CASH.
 * @body { closingCashAmount: number, notes?: string }
 */
router.post('/session/:id/close', ...posSession, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma');
    const { closingCashAmount, notes } = req.body as { closingCashAmount?: number; notes?: string };

    const result = await closePosSession(prisma, {
      sessionId: req.params.id,
      businessId: req.user!.businessId,
      closingCashAmount: Number(closingCashAmount),
      notes,
    });
    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }
    res.json(result.session);
  } catch (error) {
    console.error('POS session close error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
