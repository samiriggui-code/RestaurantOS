import type { PrismaClient } from '@prisma/client';
import type { Server as SocketIOServer } from 'socket.io';
import { assertOrderStatusTransition, assertPaymentStatusTransition } from './order-status';
import { runPaidOrderSideEffects } from './paid-order-side-effects';
import { requireFiscalTicketForPaidOrder } from './fiscal/hook-paid-order';
import { emitOrderTrackUpdate } from './order-track-events';

export type PosSettleResult =
  { ok: true; order: unknown } | { ok: false; status: number; error: string };

/**
 * Finalisation caisse : pay (UNPAID→PAID + COMPLETED) ou handover (PAID→COMPLETED).
 */
export async function posSettleOrder(
  prisma: PrismaClient,
  io: SocketIOServer,
  params: {
    orderId: string;
    businessId: string;
    userId: string;
    action: string;
    paymentMethod?: string;
  }
): Promise<PosSettleResult> {
  const { action, paymentMethod } = params;
  if (!['pay', 'handover'].includes(action)) {
    return { ok: false, status: 400, error: 'action must be pay or handover' };
  }

  const existing = await prisma.order.findFirst({
    where: {
      id: params.orderId,
      businessId: params.businessId,
      status: 'READY',
    },
  });
  if (!existing) {
    return { ok: false, status: 404, error: 'Commande introuvable ou pas encore prête' };
  }

  if (action === 'pay') {
    if (existing.paymentStatus !== 'UNPAID') {
      return { ok: false, status: 400, error: 'Commande déjà payée' };
    }
    if (!paymentMethod || !['CASH', 'CARD'].includes(paymentMethod)) {
      return { ok: false, status: 400, error: 'paymentMethod must be CASH or CARD' };
    }
  } else {
    if (existing.paymentStatus !== 'PAID') {
      return { ok: false, status: 400, error: 'Encaissement requis avant remise' };
    }
    if (existing.type === 'DELIVERY') {
      return { ok: false, status: 400, error: 'Livraison gérée depuis le KDS' };
    }
  }

  const order = await prisma.order.update({
    where: { id: existing.id },
    data: {
      status: assertOrderStatusTransition(existing.status, 'COMPLETED'),
      ...(action === 'pay'
        ? {
            paymentStatus: assertPaymentStatusTransition(existing.paymentStatus, 'PAID'),
            paymentMethod,
          }
        : {}),
    },
    include: {
      items: { include: { menuItem: true } },
      table: true,
    },
  });

  io.to(`business:${order.businessId}`).emit('order:statusUpdate', order);
  emitOrderTrackUpdate(io, order);

  if (action === 'pay') {
    try {
      await requireFiscalTicketForPaidOrder(prisma, order.businessId, order.id, params.userId, {
        paymentMethod: order.paymentMethod,
      });
    } catch (fiscalErr) {
      await prisma.order.update({
        where: { id: order.id },
        data: { paymentStatus: 'UNPAID', status: 'READY' },
      });
      const msg = fiscalErr instanceof Error ? fiscalErr.message : 'Ticket fiscal impossible';
      return { ok: false, status: 500, error: msg };
    }
    try {
      await runPaidOrderSideEffects(prisma, {
        businessId: order.businessId,
        orderId: order.id,
        userId: params.userId,
      });
    } catch (sideErr) {
      console.error('[pos-settle] facture:', sideErr);
      return {
        ok: false,
        status: 500,
        error: sideErr instanceof Error ? sideErr.message : 'Facture impossible',
      };
    }
  }

  return { ok: true, order };
}
