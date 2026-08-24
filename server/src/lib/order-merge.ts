import type { PrismaClient } from '@prisma/client';
import type { Server as SocketIOServer } from 'socket.io';
import {
  computeOrderTotalsFromLines,
  defaultVatBpsFromTaxRate,
  type OrderVatLine,
} from './order-vat';
import { orderPriceMode } from './invoice-vat';
import { assertOrderStatusTransition } from './order-status';
import { emitOrderTrackUpdate } from './order-track-events';

export type MergeOrderResult =
  | { ok: true; target: unknown }
  | { ok: false; status: number; error: string };

/**
 * Fusionne plusieurs commandes non payées dans une commande cible : déplace
 * tous les items, recalcule les totaux, annule les commandes sources
 * (garde la traçabilité — pas de suppression).
 */
export async function mergeOrders(
  prisma: PrismaClient,
  io: SocketIOServer | undefined,
  params: {
    targetOrderId: string;
    sourceOrderIds: string[];
    businessId: string;
  }
): Promise<MergeOrderResult> {
  const sourceIds = [...new Set(params.sourceOrderIds)].filter(id => id !== params.targetOrderId);
  if (!sourceIds.length) {
    return { ok: false, status: 400, error: 'Au moins une commande source distincte de la cible requise' };
  }

  const target = await prisma.order.findFirst({
    where: { id: params.targetOrderId, businessId: params.businessId },
    include: { items: { include: { menuItem: true } } },
  });
  if (!target) {
    return { ok: false, status: 404, error: 'Commande cible introuvable' };
  }
  if (['PAID'].includes(target.paymentStatus)) {
    return { ok: false, status: 400, error: 'Impossible de fusionner sur une commande déjà payée' };
  }
  if (['COMPLETED', 'DELIVERED', 'CANCELLED'].includes(target.status)) {
    return { ok: false, status: 400, error: 'Commande cible déjà clôturée ou annulée' };
  }

  const sources = await prisma.order.findMany({
    where: { id: { in: sourceIds }, businessId: params.businessId },
    include: { items: { include: { menuItem: true } } },
  });
  if (sources.length !== sourceIds.length) {
    return { ok: false, status: 404, error: 'Une ou plusieurs commandes sources introuvables' };
  }
  for (const src of sources) {
    if (src.paymentStatus === 'PAID') {
      return { ok: false, status: 400, error: `Commande #${src.orderNumber} déjà payée, fusion impossible` };
    }
    if (['COMPLETED', 'DELIVERED', 'CANCELLED'].includes(src.status)) {
      return { ok: false, status: 400, error: `Commande #${src.orderNumber} déjà clôturée ou annulée` };
    }
  }

  const settings = await prisma.business.findUnique({ where: { id: params.businessId } });
  const defaultVatBps = defaultVatBpsFromTaxRate(settings?.taxRate ?? 10);
  const allItems = [...target.items, ...sources.flatMap(s => s.items)];
  const vatLines: OrderVatLine[] = allItems.map(item => ({
    quantity: item.quantity,
    unitPriceCents: item.price,
    vatRateBps: item.menuItem.vatRateBps ?? defaultVatBps,
  }));
  const { subtotal, tax, serviceCharge, total } = computeOrderTotalsFromLines(vatLines, {
    priceMode: orderPriceMode(target),
    serviceRatePercent: settings?.serviceChargeRate ?? 0,
    orderType: target.type,
  });

  const sourceItemIds = sources.flatMap(s => s.items.map(i => i.id));

  const updatedTarget = await prisma.$transaction(async tx => {
    if (sourceItemIds.length) {
      await tx.orderItem.updateMany({
        where: { id: { in: sourceItemIds } },
        data: { orderId: target.id },
      });
    }

    await tx.order.update({
      where: { id: target.id },
      data: { subtotal, tax, serviceCharge, total },
    });

    for (const src of sources) {
      await tx.order.update({
        where: { id: src.id },
        data: {
          status: assertOrderStatusTransition(src.status, 'CANCELLED'),
          cancelledAt: new Date(),
          cancelReason: 'OTHER',
          cancelNote: `Fusionnée dans #${target.orderNumber}`,
          notes: src.notes
            ? `${src.notes}\n[Fusion] déplacée vers #${target.orderNumber}`
            : `[Fusion] déplacée vers #${target.orderNumber}`,
        },
      });
    }

    return tx.order.findUnique({
      where: { id: target.id },
      include: { items: { include: { menuItem: true } }, table: true },
    });
  });

  const room = `business:${params.businessId}`;
  io?.to(room).emit('order:statusUpdate', updatedTarget);
  for (const src of sources) {
    io?.to(room).emit('order:cancelled', { id: src.id, orderNumber: src.orderNumber });
  }
  if (updatedTarget) emitOrderTrackUpdate(io, updatedTarget);

  return { ok: true, target: updatedTarget };
}
