import type { PrismaClient } from '@prisma/client';
import type { Server as SocketIOServer } from 'socket.io';
import {
  computeOrderTotalsFromLines,
  defaultVatBpsFromTaxRate,
  type OrderVatLine,
} from './order-vat';
import { orderPriceMode } from './invoice-vat';
import { allocateOrderNumber } from './order-number';

export type SplitOrderResult =
  { ok: true; original: unknown; splits: unknown[] } | { ok: false; status: number; error: string };

/**
 * Découpe une commande non payée en plusieurs commandes (items déplacés).
 */
export async function splitOrder(
  prisma: PrismaClient,
  io: SocketIOServer | undefined,
  params: {
    orderId: string;
    businessId: string;
    splits: Array<{ items: string[] }>;
  }
): Promise<SplitOrderResult> {
  const originalOrder = await prisma.order.findFirst({
    where: { id: params.orderId, businessId: params.businessId },
    include: { items: { include: { menuItem: true } }, table: true },
  });

  if (!originalOrder) {
    return { ok: false, status: 404, error: 'Order not found' };
  }
  if (originalOrder.paymentStatus === 'PAID') {
    return { ok: false, status: 400, error: 'Cannot split a paid order' };
  }

  const newOrders = [];
  const movedItemIds: string[] = [];

  for (const split of params.splits) {
    const itemIds = split.items;
    if (!itemIds.length) continue;

    const splitItems = originalOrder.items.filter(i => itemIds.includes(i.id));
    if (!splitItems.length) continue;

    const settings = await prisma.business.findUnique({ where: { id: params.businessId } });
    const defaultVatBps = defaultVatBpsFromTaxRate(settings?.taxRate ?? 10);
    const vatLines: OrderVatLine[] = splitItems.map(item => ({
      quantity: item.quantity,
      unitPriceCents: item.price,
      vatRateBps: item.menuItem.vatRateBps ?? defaultVatBps,
    }));
    const {
      subtotal: splitSubtotal,
      tax,
      serviceCharge,
      total,
    } = computeOrderTotalsFromLines(vatLines, {
      priceMode: orderPriceMode(originalOrder),
      serviceRatePercent: settings?.serviceChargeRate ?? 0,
      orderType: originalOrder.type,
    });

    const newOrder = await prisma.$transaction(async tx => {
      const orderNumber = await allocateOrderNumber(tx, originalOrder.businessId);
      return tx.order.create({
        data: {
          businessId: originalOrder.businessId,
          orderNumber,
          tableId: originalOrder.tableId,
          customerName: originalOrder.customerName,
          type: originalOrder.type,
          subtotal: splitSubtotal,
          tax,
          serviceCharge,
          total,
          status: 'CONFIRMED',
          isOnlineOrder: false,
        },
      });
    });

    await prisma.orderItem.updateMany({
      where: { id: { in: itemIds } },
      data: { orderId: newOrder.id },
    });

    movedItemIds.push(...itemIds);

    const fullOrder = await prisma.order.findUnique({
      where: { id: newOrder.id },
      include: { items: { include: { menuItem: true } }, table: true },
    });

    newOrders.push(fullOrder);
    io?.to(`business:${originalOrder.businessId}`).emit('order:new', fullOrder);
  }

  const remainingItems = originalOrder.items.filter(i => !movedItemIds.includes(i.id));
  if (remainingItems.length > 0) {
    const settings = await prisma.business.findUnique({ where: { id: params.businessId } });
    const defaultVatBps = defaultVatBpsFromTaxRate(settings?.taxRate ?? 10);
    const vatLines: OrderVatLine[] = remainingItems.map(item => ({
      quantity: item.quantity,
      unitPriceCents: item.price,
      vatRateBps: item.menuItem.vatRateBps ?? defaultVatBps,
    }));
    const {
      subtotal: remainingSubtotal,
      tax,
      serviceCharge,
      total,
    } = computeOrderTotalsFromLines(vatLines, {
      priceMode: orderPriceMode(originalOrder),
      serviceRatePercent: settings?.serviceChargeRate ?? 0,
      orderType: originalOrder.type,
    });

    await prisma.order.update({
      where: { id: originalOrder.id },
      data: {
        subtotal: remainingSubtotal,
        tax,
        serviceCharge,
        total,
      },
    });
  } else if (movedItemIds.length > 0) {
    // Tous les items déplacés — totaux à zéro (évite subtotal orphelin)
    await prisma.order.update({
      where: { id: originalOrder.id },
      data: {
        subtotal: 0,
        tax: 0,
        serviceCharge: 0,
        total: 0,
      },
    });
  }

  const updatedOriginal = await prisma.order.findUnique({
    where: { id: originalOrder.id },
    include: { items: { include: { menuItem: true } }, table: true },
  });

  io?.to(`business:${originalOrder.businessId}`).emit('order:statusUpdate', updatedOriginal);

  return { ok: true, original: updatedOriginal, splits: newOrders };
}
