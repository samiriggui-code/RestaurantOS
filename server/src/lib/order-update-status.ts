import type { PrismaClient } from '@prisma/client';
import type { Server as SocketIOServer } from 'socket.io';
import { InvalidOrderTransitionError, transitionOrderStatus } from './order-status';
import { notifyOrderStatusChange } from './notifications';
import { emitOrderTrackUpdate } from './order-track-events';

export type UpdateOrderStatusResult =
  { ok: true; order: unknown } | { ok: false; status: number; error: string };

/**
 * Transition de statut commande + libération table + notifs / sockets.
 */
export async function updateOrderStatus(
  prisma: PrismaClient,
  io: SocketIOServer,
  params: {
    orderId: string;
    businessId: string;
    status: string;
  }
): Promise<UpdateOrderStatusResult> {
  const existing = await prisma.order.findFirst({
    where: { id: params.orderId, businessId: params.businessId },
  });
  if (!existing) {
    return { ok: false, status: 404, error: 'Order not found' };
  }

  if (params.status === 'DELIVERED' && existing.type === 'DELIVERY') {
    return {
      ok: false,
      status: 403,
      error: 'Livraison confirmée par le livreur uniquement (code client requis)',
    };
  }

  let nextStatus;
  try {
    nextStatus = transitionOrderStatus(existing.status, params.status).status;
  } catch (err) {
    if (err instanceof InvalidOrderTransitionError) {
      return { ok: false, status: 400, error: err.message };
    }
    throw err;
  }

  const order = await prisma.order.update({
    where: { id: params.orderId },
    data: { status: nextStatus },
    include: {
      items: { include: { menuItem: true } },
      table: true,
      driver: { select: { id: true, name: true } },
    },
  });

  const terminalStatuses = ['COMPLETED', 'DELIVERED'];
  if (terminalStatuses.includes(nextStatus) && order.tableId) {
    const activeOrders = await prisma.order.count({
      where: {
        tableId: order.tableId,
        status: { notIn: ['COMPLETED', 'DELIVERED', 'CANCELLED'] },
      },
    });
    if (activeOrders === 0) {
      await prisma.table.update({
        where: { id: order.tableId },
        data: { status: 'AVAILABLE' },
      });
    }
  }

  if (nextStatus === 'READY' || nextStatus === 'OUT_FOR_DELIVERY' || nextStatus === 'DELIVERED') {
    void notifyOrderStatusChange(order).catch(err => console.error('[notifications] status:', err));
  } else if (nextStatus === 'PREPARING' || nextStatus === 'CONFIRMED') {
    void notifyOrderStatusChange(order).catch(() => {});
  }

  io.to(`business:${order.businessId}`).emit('order:statusUpdate', order);
  emitOrderTrackUpdate(io, order);

  return { ok: true, order };
}
