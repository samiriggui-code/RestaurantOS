import type { OrderStatus, PrismaClient } from '@prisma/client';
import type { Server as SocketIOServer } from 'socket.io';
import { emitOrderTrackUpdate } from './order-track-events';

export type TransferOrderResult =
  { ok: true; order: unknown } | { ok: false; status: number; error: string };

const TERMINAL_STATUSES: OrderStatus[] = ['COMPLETED', 'DELIVERED', 'CANCELLED'];

/**
 * Réassigne une commande ouverte à une autre table et/ou un autre cashier/serveur,
 * sans passer par annulation. Mêmes garde-fous que merge/split (pas de commande
 * payée/terminale). Libère l'ancienne table si plus aucune commande active dessus,
 * occupe la nouvelle.
 */
export async function transferOrder(
  prisma: PrismaClient,
  io: SocketIOServer | undefined,
  params: {
    orderId: string;
    businessId: string;
    tableId?: string | null;
    cashierId?: string | null;
  }
): Promise<TransferOrderResult> {
  if (params.tableId === undefined && params.cashierId === undefined) {
    return { ok: false, status: 400, error: 'tableId ou cashierId requis' };
  }

  const order = await prisma.order.findFirst({
    where: { id: params.orderId, businessId: params.businessId },
  });
  if (!order) {
    return { ok: false, status: 404, error: 'Commande introuvable' };
  }
  if (order.paymentStatus === 'PAID') {
    return { ok: false, status: 400, error: 'Impossible de transférer une commande déjà payée' };
  }
  if (TERMINAL_STATUSES.includes(order.status)) {
    return { ok: false, status: 400, error: 'Commande déjà clôturée ou annulée' };
  }

  if (params.tableId) {
    const targetTable = await prisma.table.findFirst({
      where: { id: params.tableId, businessId: params.businessId },
    });
    if (!targetTable) {
      return { ok: false, status: 404, error: 'Table cible introuvable' };
    }
  }

  if (params.cashierId) {
    const cashier = await prisma.user.findFirst({
      where: { id: params.cashierId, businessId: params.businessId },
    });
    if (!cashier) {
      return { ok: false, status: 404, error: 'Utilisateur cible introuvable' };
    }
  }

  const previousTableId = order.tableId;

  const updated = await prisma.$transaction(async tx => {
    const result = await tx.order.update({
      where: { id: order.id },
      data: {
        ...(params.tableId !== undefined ? { tableId: params.tableId || null } : {}),
        ...(params.cashierId !== undefined ? { cashierId: params.cashierId || null } : {}),
      },
      include: { items: { include: { menuItem: true } }, table: true },
    });

    if (params.tableId !== undefined && params.tableId && params.tableId !== previousTableId) {
      await tx.table.update({
        where: { id: params.tableId },
        data: { status: 'OCCUPIED' },
      });
    }

    if (params.tableId !== undefined && previousTableId && previousTableId !== params.tableId) {
      const stillActive = await tx.order.count({
        where: {
          tableId: previousTableId,
          businessId: params.businessId,
          status: { notIn: TERMINAL_STATUSES },
        },
      });
      if (stillActive === 0) {
        await tx.table.update({
          where: { id: previousTableId },
          data: { status: 'AVAILABLE' },
        });
      }
    }

    return result;
  });

  const room = `business:${params.businessId}`;
  io?.to(room).emit('order:statusUpdate', updated);
  emitOrderTrackUpdate(io, updated);

  return { ok: true, order: updated };
}
