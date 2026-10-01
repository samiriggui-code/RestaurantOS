import type { PrismaClient } from '@prisma/client';
import type { Server as SocketIOServer } from 'socket.io';
import { applyPaymentMeta } from './order-payment-meta';
import { assertOrderStatusTransition, assertPaymentStatusTransition } from './order-status';
import type { OrderPaymentMeta } from './payment-meta';
import { deductStockWithAlerts } from './stock-deduct-alerts';
import { enqueueConfirmedOrderPrints } from './enqueue-order-prints';
import { ensureInvoiceForPaidOrder } from './invoice-from-order';
import { ensureLoyaltyCreditForPaidOrder } from './loyalty-order';
import { requireFiscalTicketForPaidOrder } from './fiscal/hook-paid-order';
import { assertManualCardPaymentMeta } from './fiscal/payment-validation';
import { emitOrderTrackUpdate } from './order-track-events';

export type EncashOrderResult =
  { ok: true; order: unknown } | { ok: false; status: number; error: string };

/**
 * Encaissement comptoir d'une commande en ligne PENDING_PAYMENT / COUNTER.
 */
export async function encashOrder(
  prisma: PrismaClient,
  io: SocketIOServer,
  params: {
    orderId: string;
    businessId: string;
    userId: string;
    paymentMethod: string;
    paymentMeta?: OrderPaymentMeta;
  }
): Promise<EncashOrderResult> {
  const { paymentMethod, paymentMeta } = params;
  if (!['CASH', 'CARD'].includes(paymentMethod)) {
    return { ok: false, status: 400, error: 'paymentMethod must be CASH or CARD' };
  }

  const existing = await prisma.order.findFirst({
    where: {
      id: params.orderId,
      businessId: params.businessId,
      isOnlineOrder: true,
      status: 'PENDING_PAYMENT',
      paymentStatus: 'UNPAID',
      paymentMethod: 'COUNTER',
    },
  });
  if (!existing) {
    return { ok: false, status: 404, error: 'Commande non trouvée ou déjà encaissée' };
  }

  const order = await prisma.order.update({
    where: { id: existing.id },
    data: {
      paymentStatus: assertPaymentStatusTransition(existing.paymentStatus, 'PAID'),
      paymentMethod,
      status: assertOrderStatusTransition(existing.status, 'CONFIRMED'),
      ...applyPaymentMeta({ paymentMethod, paymentMeta }, existing.total),
    },
    include: {
      items: { include: { menuItem: true } },
      table: true,
    },
  });

  io.to(`business:${order.businessId}`).emit('order:new', order);
  io.to(`business:${order.businessId}`).emit('order:paymentUpdate', order);
  emitOrderTrackUpdate(io, order);

  void deductStockWithAlerts(
    prisma,
    order.businessId,
    order.id,
    order.items.map(i => ({ menuItemId: i.menuItemId, quantity: i.quantity }))
  ).catch(err => console.error('Stock deduct on encash:', err));

  void enqueueConfirmedOrderPrints(prisma, io, order.businessId, order.id).catch(err =>
    console.error('[prints] enqueue après paiement:', err)
  );

  void ensureInvoiceForPaidOrder(prisma, order.businessId, order.id, params.userId).catch(err =>
    console.error('Auto invoice on encash:', err)
  );
  void ensureLoyaltyCreditForPaidOrder(prisma, order.businessId, order.id);

  try {
    assertManualCardPaymentMeta(paymentMethod, paymentMeta);
    await requireFiscalTicketForPaidOrder(prisma, order.businessId, order.id, params.userId, {
      paymentMethod: order.paymentMethod,
    });
  } catch (fiscalErr) {
    await prisma.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: 'UNPAID',
        status: 'PENDING_PAYMENT',
      },
    });
    const msg = fiscalErr instanceof Error ? fiscalErr.message : 'Ticket fiscal impossible';
    return { ok: false, status: 500, error: msg };
  }

  return { ok: true, order };
}
