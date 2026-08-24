import type { Prisma, PrismaClient } from '@prisma/client';
import type { Server as SocketIOServer } from 'socket.io';
import { assertOrderStatusTransition } from './order-status';
import { emitOrderTrackUpdate } from './order-track-events';

const assignedOrderInclude = {
  items: { include: { menuItem: true } },
  table: true,
  driver: { select: { id: true, name: true } },
} as const;

type AssignedOrder = Prisma.OrderGetPayload<{ include: typeof assignedOrderInclude }>;

export type AssignDriverResult =
  { ok: true; order: AssignedOrder } | { ok: false; status: number; error: string };

/**
 * Attribue un livreur à une commande livraison READY / OUT_FOR_DELIVERY.
 * Si READY → transition vers OUT_FOR_DELIVERY (state machine).
 */
export async function assignDriverToOrder(
  prisma: PrismaClient,
  io: SocketIOServer,
  params: {
    orderId: string;
    businessId: string;
    driverId: string;
  }
): Promise<AssignDriverResult> {
  const driverId = params.driverId.trim();
  if (!driverId) {
    return { ok: false, status: 400, error: 'Livreur requis' };
  }

  const existing = await prisma.order.findFirst({
    where: { id: params.orderId, businessId: params.businessId },
  });
  if (!existing) {
    return { ok: false, status: 404, error: 'Order not found' };
  }
  if (existing.type !== 'DELIVERY') {
    return { ok: false, status: 400, error: 'Réservé aux commandes livraison' };
  }
  if (!['READY', 'OUT_FOR_DELIVERY'].includes(existing.status)) {
    return { ok: false, status: 400, error: 'Commande non prête pour attribution livreur' };
  }

  const driver = await prisma.user.findFirst({
    where: {
      id: driverId,
      businessId: params.businessId,
      role: 'DRIVER',
      isActive: true,
    },
    select: { id: true, name: true },
  });
  if (!driver) {
    return { ok: false, status: 400, error: 'Livreur invalide ou inactif' };
  }

  const order = await prisma.order.update({
    where: { id: existing.id },
    data: {
      driverId: driver.id,
      ...(existing.status === 'READY'
        ? { status: assertOrderStatusTransition(existing.status, 'OUT_FOR_DELIVERY') }
        : {}),
    },
    include: assignedOrderInclude,
  });

  io.to(`business:${order.businessId}`).emit('order:statusUpdate', order);
  emitOrderTrackUpdate(io, order);

  return { ok: true, order };
}
