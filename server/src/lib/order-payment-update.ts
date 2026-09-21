import type { PrismaClient } from '@prisma/client';
import type { Server as SocketIOServer } from 'socket.io';
import { assertPaymentStatusTransition, InvalidPaymentTransitionError } from './order-status';
import { assertOrderFiscallyMutable } from './fiscal/guards';
import { runPaidOrderSideEffects } from './paid-order-side-effects';
import { requireFiscalTicketForPaidOrder } from './fiscal/hook-paid-order';

export type UpdateOrderPaymentResult =
  { ok: true; order: unknown } | { ok: false; status: number; error: string };

/**
 * Mise à jour paymentStatus / paymentMethod + effets de bord (table, stock, fiscal).
 */
export async function updateOrderPayment(
  prisma: PrismaClient,
  io: SocketIOServer,
  params: {
    orderId: string;
    businessId: string;
    userId: string;
    paymentStatus?: string;
    paymentMethod?: string;
  }
): Promise<UpdateOrderPaymentResult> {
  const existing = await prisma.order.findFirst({
    where: { id: params.orderId, businessId: params.businessId },
  });
  if (!existing) {
    return { ok: false, status: 404, error: 'Order not found' };
  }

  const { paymentStatus, paymentMethod } = params;

  if (existing.paymentStatus === 'PAID' && paymentStatus && paymentStatus !== 'PAID') {
    try {
      await assertOrderFiscallyMutable(prisma, existing.id, existing.businessId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Internal server error';
      if (msg.includes('figée fiscalement')) {
        return { ok: false, status: 409, error: msg };
      }
      throw err;
    }
  }

  let nextPaymentStatus = existing.paymentStatus;
  if (paymentStatus) {
    try {
      nextPaymentStatus = assertPaymentStatusTransition(existing.paymentStatus, paymentStatus);
    } catch (err) {
      if (err instanceof InvalidPaymentTransitionError) {
        return { ok: false, status: 400, error: err.message };
      }
      throw err;
    }
  }

  const order = await prisma.order.update({
    where: { id: params.orderId },
    data: { paymentStatus: nextPaymentStatus, paymentMethod },
    include: {
      items: { include: { menuItem: true } },
      table: true,
    },
  });

  if (nextPaymentStatus === 'PAID' && order.tableId) {
    const activeOrders = await prisma.order.count({
      where: { tableId: order.tableId, status: { notIn: ['DELIVERED', 'CANCELLED'] } },
    });
    if (activeOrders === 0) {
      await prisma.table.update({
        where: { id: order.tableId },
        data: { status: 'AVAILABLE' },
      });
    }
  }

  io.to(`business:${order.businessId}`).emit('order:paymentUpdate', order);

  if (nextPaymentStatus === 'PAID') {
    try {
      await requireFiscalTicketForPaidOrder(prisma, order.businessId, order.id, params.userId, {
        paymentMethod: order.paymentMethod,
      });
    } catch (fiscalErr) {
      const msg = fiscalErr instanceof Error ? fiscalErr.message : 'Ticket fiscal impossible';
      return { ok: false, status: 500, error: msg };
    }
    try {
      await runPaidOrderSideEffects(prisma, {
        businessId: order.businessId,
        orderId: order.id,
        stockItems:
          existing.paymentStatus !== 'PAID' && order.status === 'CONFIRMED'
            ? order.items.map(i => ({ menuItemId: i.menuItemId, quantity: i.quantity }))
            : undefined,
        userId: params.userId,
      });
    } catch (sideErr) {
      console.error('[payment-update] stock/facture:', sideErr);
      return {
        ok: false,
        status: 500,
        error: sideErr instanceof Error ? sideErr.message : 'Stock / facture impossible',
      };
    }
  }

  return { ok: true, order };
}
