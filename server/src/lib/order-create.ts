import { randomBytes } from 'crypto';
import type { Prisma, PrismaClient, PaymentStatus } from '@prisma/client';
import type { Server as SocketIOServer } from 'socket.io';
import { resolveBusinessId } from './business';
import {
  computeOrderTotalsFromLines,
  defaultVatBpsFromTaxRate,
  type OrderVatLine,
} from './order-vat';
import { resolveOrderChannel } from './order-channel';
import { allocateOrderNumber } from './order-number';
import { applyPaymentMeta } from './order-payment-meta';
import { deductStockWithAlerts } from './stock-deduct-alerts';
import { enqueueConfirmedOrderPrints } from './enqueue-order-prints';
import { ensureInvoiceForPaidOrder } from './invoice-from-order';
import { ensureLoyaltyCreditForPaidOrder } from './loyalty-order';
import { requireFiscalTicketForPaidOrder } from './fiscal/hook-paid-order';
import { assertManualCardPaymentMeta } from './fiscal/payment-validation';
import type { OrderPaymentMeta } from './payment-meta';

function generateTrackingToken(): string {
  return randomBytes(6).toString('hex');
}

/**
 * Ventes déjà fiscalisées ailleurs (ex. caisse SumUp comptoir) : ressaisies dans RestaurantOS
 * uniquement pour cuisine/stock/fidélité — ne doivent PAS émettre un 2e ticket fiscal ni une 2e
 * facture pour la même vente (double comptabilisation du CA déclaré).
 */
const EXTERNALLY_FISCALIZED_PAYMENT_METHODS = new Set(['CASH_SUMUP']);

/** Commande internet invité vs comptoir staff (isOnlineOrder: false). */
export function isOnlineCheckout(isOnlineOrder: unknown, hasStaffUser: boolean): boolean {
  if (isOnlineOrder === false) return false;
  if (isOnlineOrder === true) return true;
  return !hasStaffUser;
}

export type CreateOrderResult =
  { ok: true; status: 201; order: unknown } | { ok: false; status: number; error: string };

type CreateOrderBody = {
  items: Array<{
    menuItemId: string;
    quantity: number;
    price?: number;
    notes?: string;
    selectedModifiers?: unknown;
    sortOrder?: number;
  }>;
  tableId?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  type?: string;
  notes?: string;
  isOnlineOrder?: boolean;
  businessId?: string;
  channel?: string;
  source?: string;
  paymentStatus?: string;
  paymentMethod?: string;
  paymentMeta?: OrderPaymentMeta;
  deliveryAddress?: string;
  deliveryPostalCode?: string;
  deliveryCity?: string;
  scheduledAt?: string;
};

/**
 * Création commande staff / online (hors marketplace / totem / guest-checkout).
 */
export async function createOrder(
  prisma: PrismaClient,
  io: SocketIOServer,
  params: {
    body: CreateOrderBody;
    userId?: string;
    userBusinessId?: string;
  }
): Promise<CreateOrderResult> {
  const { body } = params;
  const { items, tableId, customerName, customerPhone, customerEmail, type, notes, isOnlineOrder } =
    body;

  const businessId = params.userBusinessId || resolveBusinessId(body.businessId);
  if (!businessId) {
    return { ok: false, status: 400, error: 'businessId required' };
  }

  let subtotal = 0;
  const orderItemsData: Prisma.OrderItemUncheckedCreateWithoutOrderInput[] = [];
  const vatLines: OrderVatLine[] = [];

  for (const item of items) {
    const menuItem = await prisma.menuItem.findUnique({ where: { id: item.menuItemId } });
    if (!menuItem || !menuItem.isAvailable || !menuItem.isActive) {
      return { ok: false, status: 400, error: `Item ${item.menuItemId} not available` };
    }
    let itemPrice = menuItem.discountPrice ?? menuItem.price;
    if (
      params.userId &&
      typeof item.price === 'number' &&
      Number.isInteger(item.price) &&
      item.price >= 0
    ) {
      itemPrice = item.price;
    }
    subtotal += itemPrice * item.quantity;
    vatLines.push({
      quantity: item.quantity,
      unitPriceCents: itemPrice,
      vatRateBps: menuItem.vatRateBps,
    });
    orderItemsData.push({
      menuItemId: item.menuItemId,
      quantity: item.quantity,
      price: itemPrice,
      notes: item.notes || null,
      selectedModifiers: (item.selectedModifiers || {}) as Prisma.InputJsonValue,
      sortOrder: item.sortOrder || 0,
    });
  }

  const settings = await prisma.business.findUnique({ where: { id: businessId } });
  const defaultVatBps = defaultVatBpsFromTaxRate(settings?.taxRate ?? 10);
  const vatLinesResolved = vatLines.map(l => ({
    ...l,
    vatRateBps: l.vatRateBps ?? defaultVatBps,
  }));
  const serviceRate = settings?.serviceChargeRate ?? 0;
  const orderType = type || 'DINE_IN';
  const online = isOnlineCheckout(isOnlineOrder, Boolean(params.userId));
  const channel = resolveOrderChannel({
    channel: body.channel,
    isOnlineOrder: online,
    source: body.source,
  });
  const { tax, serviceCharge, total } = computeOrderTotalsFromLines(vatLinesResolved, {
    priceMode: online ? 'TTC' : 'HT',
    serviceRatePercent: serviceRate,
    orderType,
  });
  const initialStatus = online ? 'PENDING_PAYMENT' : 'CONFIRMED';

  type CreatedOrder = Prisma.OrderGetPayload<{
    include: { items: { include: { menuItem: true } }; table: true };
  }>;

  const order: CreatedOrder = await prisma.$transaction(async tx => {
    const orderNumber = await allocateOrderNumber(tx, businessId);
    return tx.order.create({
      data: {
        businessId,
        orderNumber,
        tableId: tableId || null,
        customerName: customerName || null,
        customerPhone: customerPhone || null,
        customerEmail: customerEmail || null,
        type: orderType,
        status: initialStatus,
        paymentStatus: (online ? 'UNPAID' : body.paymentStatus || 'UNPAID') as PaymentStatus,
        paymentMethod: body.paymentMethod || null,
        subtotal,
        tax,
        serviceCharge,
        total,
        notes: notes || null,
        isOnlineOrder: online,
        channel,
        trackingToken: generateTrackingToken(),
        deliveryAddress: body.deliveryAddress || null,
        deliveryPostalCode: body.deliveryPostalCode || null,
        deliveryCity: body.deliveryCity || null,
        scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
        cashierId: params.userId || null,
        ...applyPaymentMeta(body, total),
        items: { create: orderItemsData },
      },
      include: {
        items: { include: { menuItem: true } },
        table: true,
      },
    });
  });

  if (tableId) {
    await prisma.table.update({
      where: { id: tableId },
      data: { status: 'OCCUPIED' },
    });
  }

  if (initialStatus === 'CONFIRMED') {
    void deductStockWithAlerts(
      prisma,
      businessId,
      order.id,
      order.items.map(i => ({ menuItemId: i.menuItemId, quantity: i.quantity }))
    ).catch(err => console.error('Stock deduct on create:', err));
  }

  if (order.paymentStatus === 'PAID') {
    const alreadyFiscalized = EXTERNALLY_FISCALIZED_PAYMENT_METHODS.has(order.paymentMethod ?? '');
    if (!alreadyFiscalized) {
      try {
        assertManualCardPaymentMeta(order.paymentMethod, body.paymentMeta);
        await requireFiscalTicketForPaidOrder(prisma, businessId, order.id, params.userId, {
          paymentMethod: order.paymentMethod,
        });
      } catch (fiscalErr) {
        try {
          await prisma.order.delete({ where: { id: order.id } });
        } catch {
          /* ignore rollback delete */
        }
        const msg = fiscalErr instanceof Error ? fiscalErr.message : 'Ticket fiscal impossible';
        return { ok: false, status: 500, error: msg };
      }
      void ensureInvoiceForPaidOrder(prisma, businessId, order.id, params.userId).catch(err =>
        console.error('Auto invoice on create:', err)
      );
    }
    void ensureLoyaltyCreditForPaidOrder(prisma, businessId, order.id);
  }

  if (initialStatus === 'CONFIRMED') {
    io.to(`business:${businessId}`).emit('order:new', order);
    if (!online) {
      void Promise.resolve(enqueueConfirmedOrderPrints(prisma, io, businessId, order.id)).catch(
        () => {}
      );
    }
  }

  return { ok: true, status: 201, order };
}
