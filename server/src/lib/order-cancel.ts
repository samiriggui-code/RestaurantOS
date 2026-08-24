import type { PrismaClient } from '@prisma/client';
import type { Server as SocketIOServer } from 'socket.io';
import { restoreStockForOrder } from './order-stock';
import { assertOrderStatusTransition, assertPaymentStatusTransition } from './order-status';
import { refundSumupPaymentForOrder } from './sumup-refund';
import { voidFiscalTicketForCancelledOrder } from './fiscal/auto-void';
import { emitOrderTrackUpdate } from './order-track-events';
import { emitAdminLive } from './admin-live-events';

export const ORDER_CANCEL_REASONS = [
  'CLIENT_REFUSED',
  'OUT_OF_STOCK',
  'MISSING_INGREDIENT',
  'INCIDENT',
  'OTHER',
] as const;

export type OrderCancelReason = (typeof ORDER_CANCEL_REASONS)[number];

export const CANCEL_REASON_LABEL: Record<OrderCancelReason, string> = {
  CLIENT_REFUSED: 'Client refuse la commande',
  OUT_OF_STOCK: 'Stock épuisé',
  MISSING_INGREDIENT: 'Ingrédient manquant',
  INCIDENT: 'Incident cuisine',
  OTHER: 'Autre motif',
};

export type CancelOrderResult =
  { ok: true; order: unknown } | { ok: false; status: number; error: string };

/**
 * Annulation commande (cuisine / caisse / admin) — motif, stock, SumUp, fiscal.
 */
export async function cancelOrder(
  prisma: PrismaClient,
  io: SocketIOServer,
  params: {
    orderId: string;
    businessId: string;
    userId: string;
    reason: OrderCancelReason;
    note?: string | null;
    source?: string;
    refund?: boolean;
  }
): Promise<CancelOrderResult> {
  const existing = await prisma.order.findFirst({
    where: { id: params.orderId, businessId: params.businessId },
    include: { items: { include: { menuItem: true } }, table: true },
  });
  if (!existing) {
    return { ok: false, status: 404, error: 'Commande introuvable' };
  }

  if (['COMPLETED', 'DELIVERED', 'CANCELLED'].includes(existing.status)) {
    return { ok: false, status: 400, error: 'Commande déjà clôturée ou annulée' };
  }

  const reasonLabel = CANCEL_REASON_LABEL[params.reason];
  const sourceLabel =
    params.source === 'KITCHEN' ? 'cuisine' : params.source === 'POS' ? 'caisse' : 'staff';
  const cancelNoteText = params.note?.trim() || null;
  const auditLine = `[Annulation ${sourceLabel}] ${reasonLabel}${
    cancelNoteText ? ` — ${cancelNoteText}` : ''
  }`;

  if (existing.paymentStatus === 'PAID' && existing.sumupCheckoutId) {
    const refundResult = await refundSumupPaymentForOrder(prisma, existing, {
      refund: params.refund !== false,
    });
    if (!refundResult.ok) {
      return { ok: false, status: 400, error: refundResult.error };
    }
  }

  if (existing.paymentStatus === 'PAID') {
    try {
      await voidFiscalTicketForCancelledOrder(
        prisma,
        existing.businessId,
        existing.id,
        params.userId,
        auditLine
      );
    } catch (voidErr) {
      const msg = voidErr instanceof Error ? voidErr.message : 'Avoir fiscal impossible';
      return { ok: false, status: 400, error: msg };
    }
  }

  const order = await prisma.$transaction(async tx => {
    assertOrderStatusTransition(existing.status, 'CANCELLED');
    const updated = await tx.order.update({
      where: { id: existing.id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelReason: params.reason,
        cancelNote: cancelNoteText,
        notes: existing.notes ? `${existing.notes}\n${auditLine}` : auditLine,
        ...(existing.paymentStatus === 'PAID'
          ? { paymentStatus: assertPaymentStatusTransition(existing.paymentStatus, 'REFUNDED') }
          : {}),
      },
      include: { items: { include: { menuItem: true } }, table: true },
    });

    await restoreStockForOrder(
      tx,
      existing.businessId,
      existing.id,
      existing.items.map(i => ({ menuItemId: i.menuItemId, quantity: i.quantity })),
      reasonLabel
    );

    if (existing.tableId) {
      await tx.table.update({
        where: { id: existing.tableId },
        data: { status: 'AVAILABLE' },
      });
    }

    return updated;
  });

  const room = `business:${order.businessId}`;
  io.to(room).emit('order:cancelled', order);
  io.to(room).emit('order:statusUpdate', order);
  emitOrderTrackUpdate(io, order);
  emitAdminLive(io, order.businessId, {
    domain: 'orders',
    action: 'cancel',
    label: 'Commande annulée',
    detail: `#${order.orderNumber} — ${reasonLabel}`,
  });

  return { ok: true, order };
}
