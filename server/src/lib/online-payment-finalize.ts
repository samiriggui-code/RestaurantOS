import type { PrismaClient } from '@prisma/client';
import type { Server as SocketIOServer } from 'socket.io';
import { sendOrderConfirmationEmailV2, sendFiscalReceiptEmailV2 } from './mail-service';
import { ensureInvoiceForPaidOrder } from './invoice-from-order';
import { ensureLoyaltyCreditForPaidOrder } from './loyalty-order';
import { requireFiscalTicketForPaidOrder } from './fiscal/hook-paid-order';
import { enqueueConfirmedOrderPrints } from './enqueue-order-prints';
import { emitOrderTrackUpdate } from './order-track-events';
import { emitToBusinessRoom } from './socket-emit';

/** Après paiement CB en ligne : ticket fiscal, socket, impression, facture, email. */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- retour = payload Prisma Order (avec relations include) ou null, dérivé du schéma.
export async function runOnlineCardPaymentHooks(
  prisma: PrismaClient,
  io: SocketIOServer,
  businessId: string,
  orderId: string
) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, businessId },
    include: { items: { include: { menuItem: true } }, table: true },
  });
  if (!order || order.paymentStatus !== 'PAID') return order;

  const existingTicket = await prisma.fiscalTicket.findFirst({
    where: { orderId },
    select: { id: true, serialNumber: true, recordHash: true },
  });
  if (existingTicket) {
    await emitToBusinessRoom(io, businessId, 'order:paymentUpdate', order);
    return order;
  }

  let fiscalSerial: number | null = null;
  let fiscalHash: string | null = null;
  try {
    const fiscal = await requireFiscalTicketForPaidOrder(prisma, businessId, orderId, null, {
      paymentMethod: 'CARD',
    });
    fiscalSerial = fiscal.serialNumber;
    const ticket = await prisma.fiscalTicket.findUnique({
      where: { id: fiscal.ticketId },
      select: { recordHash: true },
    });
    fiscalHash = ticket?.recordHash ?? null;
  } catch (fiscalErr) {
    console.error('[fiscal] CRITICAL commande payée en ligne sans ticket:', orderId, fiscalErr);
    const { emitAdminLive } = await import('./admin-live-events');
    emitAdminLive(io, businessId, {
      domain: 'orders',
      action: 'fiscal_error',
      label: 'Échec ticket fiscal',
      detail: `Commande #${order.orderNumber} payée en ligne — ticket non émis`,
    });
  }

  await emitToBusinessRoom(io, businessId, 'order:paymentUpdate', order);
  await emitToBusinessRoom(io, businessId, 'order:new', order);

  const { deductStockWithAlerts } = await import('./stock-deduct-alerts');
  void deductStockWithAlerts(
    prisma,
    businessId,
    orderId,
    order.items.map(i => ({ menuItemId: i.menuItemId, quantity: i.quantity }))
  ).catch(err => console.error('Stock deduct on online payment:', err));

  void enqueueConfirmedOrderPrints(prisma, io, businessId, orderId);
  emitOrderTrackUpdate(io, order);

  void ensureInvoiceForPaidOrder(prisma, businessId, orderId).catch(err =>
    console.error('Auto invoice on online payment:', err)
  );
  void ensureLoyaltyCreditForPaidOrder(prisma, businessId, orderId);

  if (order.customerEmail) {
    void sendOrderConfirmationEmailV2(prisma, businessId, {
      to: order.customerEmail,
      orderNumber: order.orderNumber,
      customerName: order.customerName ?? undefined,
      trackingToken: order.trackingToken ?? undefined,
      deliveryHandoverCode:
        order.type === 'DELIVERY' ? (order.deliveryHandoverCode ?? undefined) : undefined,
    });
    if (fiscalSerial != null && fiscalHash) {
      void sendFiscalReceiptEmailV2(prisma, businessId, {
        to: order.customerEmail,
        customerName: order.customerName ?? undefined,
        orderNumber: order.orderNumber,
        fiscalSerialNumber: fiscalSerial,
        fiscalRecordHash: fiscalHash,
        totalCents: order.total,
        trackingToken: order.trackingToken,
      }).catch(err => console.error('[fiscal] receipt email:', err));
    }
  }

  return order;
}
