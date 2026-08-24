import type { Prisma, PrismaClient } from '@prisma/client';
import type { Server as SocketIOServer } from 'socket.io';
import {
  DELIVERY_ISSUE_REASONS,
  isValidHandoverCode,
  type DeliveryIssueReason,
} from './delivery-handover';
import { appendDriverTrail } from './driver-trail';
import { notifyOrderStatusChange } from './notifications';
import { assertOrderStatusTransition, type OrderStatus } from './order-status';
import { emitOrderTrackUpdate } from './order-track-events';

export type DriverActionResult<T = unknown> =
  ({ ok: true } & T) | { ok: false; status: number; error: string };

type DeliveryOrderRow = {
  id: string;
  businessId: string;
  type: string;
  status: string;
  driverId: string | null;
  driverTrail: unknown;
  deliveryHandoverCode: string | null;
  orderNumber: number;
};

const orderInclude = {
  items: { include: { menuItem: true } },
  table: true,
  driver: { select: { id: true, name: true } },
} as const;

type OrderWithDriver = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

/**
 * Scoping livreur :
 * - si `requireIdentity` : driverUserId obligatoire
 * - si commande déjà assignée : seul ce livreur (ou identity absente en mode compat public) peut agir
 */
export function assertDriverMayAct(
  order: { driverId: string | null },
  driverUserId: string | null,
  opts: { requireIdentity: boolean }
): { ok: false; status: number; error: string } | null {
  if (opts.requireIdentity && !driverUserId) {
    return { ok: false, status: 401, error: 'Identité livreur requise' };
  }
  if (driverUserId && order.driverId && order.driverId !== driverUserId) {
    return {
      ok: false,
      status: 403,
      error: 'Cette livraison est assignée à un autre livreur',
    };
  }
  return null;
}

async function loadDeliveryById(
  prisma: PrismaClient,
  orderId: string,
  businessId: string
): Promise<DeliveryOrderRow | null> {
  return prisma.order.findFirst({
    where: { id: orderId, businessId, type: 'DELIVERY' },
  });
}

async function loadDeliveryByToken(
  prisma: PrismaClient,
  token: string,
  businessId: string
): Promise<DeliveryOrderRow | null> {
  return prisma.order.findFirst({
    where: { trackingToken: token, businessId, type: 'DELIVERY' },
  });
}

/** Prise en charge : READY → OUT_FOR_DELIVERY + driverId. */
export async function acceptDelivery(
  prisma: PrismaClient,
  io: SocketIOServer | undefined,
  params: {
    orderId: string;
    businessId: string;
    driverUserId: string;
  }
): Promise<DriverActionResult<{ order: unknown }>> {
  const existing = await loadDeliveryById(prisma, params.orderId, params.businessId);
  if (!existing) {
    return { ok: false, status: 404, error: 'Livraison introuvable' };
  }
  if (!['READY', 'OUT_FOR_DELIVERY'].includes(existing.status)) {
    return { ok: false, status: 400, error: 'Commande non prête pour le livreur' };
  }
  const denied = assertDriverMayAct(existing, params.driverUserId, { requireIdentity: true });
  if (denied) return denied;

  const nextStatus: OrderStatus =
    existing.status === 'READY'
      ? assertOrderStatusTransition(existing.status, 'OUT_FOR_DELIVERY')
      : (existing.status as OrderStatus);

  const order: OrderWithDriver = await prisma.order.update({
    where: { id: existing.id },
    data: {
      driverId: params.driverUserId,
      status: nextStatus,
    },
    include: orderInclude,
  });

  if (io) {
    io.to(`business:${order.businessId}`).emit('order:statusUpdate', order);
    emitOrderTrackUpdate(io, order);
  }

  return { ok: true, order };
}

/** MAJ GPS + trail ; claim si non assignée. */
export async function updateDriverLocation(
  prisma: PrismaClient,
  io: SocketIOServer | undefined,
  params: {
    businessId: string;
    orderId?: string;
    trackingToken?: string;
    driverUserId: string | null;
    lat: number;
    lng: number;
    requireIdentity: boolean;
  }
): Promise<
  DriverActionResult<{
    order: {
      orderNumber: number;
      status: string;
      driverLat: number | null;
      driverLng: number | null;
      driverLocationAt: Date | null;
      driverId: string | null;
      driverName: string | null;
    };
  }>
> {
  if (!Number.isFinite(params.lat) || !Number.isFinite(params.lng)) {
    return { ok: false, status: 400, error: 'lat/lng invalides' };
  }

  const existing = params.orderId
    ? await loadDeliveryById(prisma, params.orderId, params.businessId)
    : params.trackingToken
      ? await loadDeliveryByToken(prisma, params.trackingToken, params.businessId)
      : null;

  if (!existing || !['READY', 'OUT_FOR_DELIVERY'].includes(existing.status)) {
    return { ok: false, status: 404, error: 'Livraison introuvable ou clôturée' };
  }

  const denied = assertDriverMayAct(existing, params.driverUserId, {
    requireIdentity: params.requireIdentity,
  });
  if (denied) return denied;

  const now = new Date();
  const trail = appendDriverTrail(existing.driverTrail, params.lat, params.lng, now);
  const nextStatus: OrderStatus =
    existing.status === 'READY'
      ? assertOrderStatusTransition(existing.status, 'OUT_FOR_DELIVERY')
      : (existing.status as OrderStatus);

  const order: OrderWithDriver = await prisma.order.update({
    where: { id: existing.id },
    data: {
      driverLat: params.lat,
      driverLng: params.lng,
      driverLocationAt: now,
      driverTrail: trail,
      ...(params.driverUserId && !existing.driverId ? { driverId: params.driverUserId } : {}),
      status: nextStatus,
    },
    include: orderInclude,
  });

  if (io) {
    io.to(`business:${order.businessId}`).emit('order:statusUpdate', order);
    emitOrderTrackUpdate(io, order);
  }

  return {
    ok: true,
    order: {
      orderNumber: order.orderNumber,
      status: order.status,
      driverLat: order.driverLat,
      driverLng: order.driverLng,
      driverLocationAt: order.driverLocationAt,
      driverId: order.driverId,
      driverName: order.driver?.name ?? null,
    },
  };
}

/** Code client → DELIVERED. */
export async function confirmDeliveryHandover(
  prisma: PrismaClient,
  io: SocketIOServer | undefined,
  params: {
    businessId: string;
    orderId?: string;
    trackingToken?: string;
    driverUserId: string | null;
    code: string;
    requireIdentity: boolean;
  }
): Promise<DriverActionResult<{ order: { orderNumber: number; status: string } }>> {
  if (!params.code?.trim()) {
    return { ok: false, status: 400, error: 'Code requis' };
  }

  const existing = params.orderId
    ? await loadDeliveryById(prisma, params.orderId, params.businessId)
    : params.trackingToken
      ? await loadDeliveryByToken(prisma, params.trackingToken, params.businessId)
      : null;

  if (!existing || existing.status !== 'OUT_FOR_DELIVERY') {
    return { ok: false, status: 404, error: 'Livraison introuvable ou déjà clôturée' };
  }

  const denied = assertDriverMayAct(existing, params.driverUserId, {
    requireIdentity: params.requireIdentity,
  });
  if (denied) return denied;

  if (!isValidHandoverCode(params.code, existing.deliveryHandoverCode)) {
    return { ok: false, status: 400, error: 'Code incorrect — demandez le code au client' };
  }

  const status = assertOrderStatusTransition(existing.status, 'DELIVERED');
  const order = await prisma.order.update({
    where: { id: existing.id },
    data: {
      status,
      ...(params.driverUserId && !existing.driverId ? { driverId: params.driverUserId } : {}),
    },
    include: orderInclude,
  });

  void notifyOrderStatusChange(order).catch(err =>
    console.error('[notifications] delivered:', err)
  );

  if (io) {
    io.to(`business:${order.businessId}`).emit('order:statusUpdate', order);
    emitOrderTrackUpdate(io, order);
  }

  return {
    ok: true,
    order: { orderNumber: order.orderNumber, status: order.status },
  };
}

/** Problème livraison → DELIVERY_ISSUE. */
export async function reportDeliveryIssue(
  prisma: PrismaClient,
  io: SocketIOServer | undefined,
  params: {
    businessId: string;
    orderId?: string;
    trackingToken?: string;
    driverUserId: string | null;
    reason: string;
    note?: string;
    requireIdentity: boolean;
  }
): Promise<DriverActionResult<{ order: { orderNumber: number; status: string } }>> {
  const validReasons = DELIVERY_ISSUE_REASONS.map(r => r.value);
  if (!params.reason || !validReasons.includes(params.reason as DeliveryIssueReason)) {
    return { ok: false, status: 400, error: 'Motif requis' };
  }

  const existing = params.orderId
    ? await loadDeliveryById(prisma, params.orderId, params.businessId)
    : params.trackingToken
      ? await loadDeliveryByToken(prisma, params.trackingToken, params.businessId)
      : null;

  if (!existing || existing.status !== 'OUT_FOR_DELIVERY') {
    return { ok: false, status: 404, error: 'Livraison introuvable ou déjà clôturée' };
  }

  const denied = assertDriverMayAct(existing, params.driverUserId, {
    requireIdentity: params.requireIdentity,
  });
  if (denied) return denied;

  const status = assertOrderStatusTransition(existing.status, 'DELIVERY_ISSUE');
  const order = await prisma.order.update({
    where: { id: existing.id },
    data: {
      status,
      deliveryIssueReason: params.reason,
      deliveryIssueNote: params.note?.trim() || null,
      deliveryIssueAt: new Date(),
      driverLat: null,
      driverLng: null,
      driverLocationAt: null,
      ...(params.driverUserId && !existing.driverId ? { driverId: params.driverUserId } : {}),
    },
    include: orderInclude,
  });

  if (io) {
    io.to(`business:${order.businessId}`).emit('order:statusUpdate', order);
    emitOrderTrackUpdate(io, order);
  }

  return {
    ok: true,
    order: { orderNumber: order.orderNumber, status: order.status },
  };
}
