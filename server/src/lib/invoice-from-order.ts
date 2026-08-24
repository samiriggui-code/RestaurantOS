import type { Prisma, PrismaClient } from '@prisma/client';
import { displayName } from './locale';
import { buildInvoiceLinesFromOrder, invoiceTotalsFromOrder } from './invoice-vat';

type OrderWithItems = {
  id: string;
  businessId: string;
  orderNumber: number;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  isOnlineOrder: boolean;
  paymentStatus: string;
  status: string;
  type: string;
  subtotal: number;
  tax: number;
  serviceCharge: number;
  discount: number;
  total: number;
  deliveryAddress: string | null;
  deliveryPostalCode: string | null;
  deliveryCity: string | null;
  items: Array<{
    quantity: number;
    price: number;
    menuItem: { name: string; nameAr?: string | null; vatRateBps?: number | null };
  }>;
};

export { computeLineTotals } from './invoice-vat';

export function clientAddressFromOrder(
  order: Pick<OrderWithItems, 'type' | 'deliveryAddress' | 'deliveryPostalCode' | 'deliveryCity'>
): string | null {
  if (order.type !== 'DELIVERY') return null;
  const parts = [order.deliveryAddress, order.deliveryPostalCode, order.deliveryCity].filter(
    Boolean
  );
  return parts.length ? parts.join(', ') : null;
}

export function defaultClientName(
  order: Pick<OrderWithItems, 'customerName' | 'orderNumber'>
): string {
  return order.customerName?.trim() || `Commande n° ${order.orderNumber}`;
}

export function invoiceStatusForOrder(
  order: Pick<OrderWithItems, 'customerName' | 'customerEmail' | 'isOnlineOrder'>
): 'DRAFT' | 'ISSUED' {
  const name = order.customerName?.trim();
  if (!name) return 'DRAFT' as const;
  if (order.isOnlineOrder && !order.customerEmail?.trim()) return 'DRAFT' as const;
  return 'ISSUED' as const;
}

export function orderLinesToInvoiceLines(
  order: OrderWithItems,
  taxRate: number
): ReturnType<typeof buildInvoiceLinesFromOrder> {
  return buildInvoiceLinesFromOrder(order, taxRate, item => displayName(item));
}

/**
 * Alloue le prochain numéro de facture pour un business, de façon atomique.
 * Doit être appelé DANS la transaction qui crée la facture : l'upsert prend un
 * verrou de ligne sur FiscalSequence, donc deux encaissements concurrents (deux
 * caisses qui payent en même temps) se sérialisent au lieu de lire le même
 * MAX(invoiceNumber) et de se marcher dessus. Même mécanisme que
 * FiscalSequence.nextTicketNo (cf. src/lib/fiscal/ticket.ts).
 */
export async function allocateInvoiceNumber(
  tx: Prisma.TransactionClient,
  businessId: string
): Promise<number> {
  const seq = await tx.fiscalSequence.upsert({
    where: { businessId },
    create: { businessId },
    update: {},
  });
  const invoiceNumber = seq.nextInvoiceNo;
  await tx.fiscalSequence.update({
    where: { businessId },
    data: { nextInvoiceNo: invoiceNumber + 1 },
  });
  return invoiceNumber;
}

export type CreateInvoiceFromOrderOptions = {
  createdById?: string;
  status?: 'DRAFT' | 'ISSUED';
  type?: string;
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- retour = payload Prisma (invoice + relations include), dérivé des requêtes ci-dessous plutôt que dupliqué à la main.
export async function createInvoiceFromOrder(
  prisma: PrismaClient,
  businessId: string,
  orderId: string,
  options: CreateInvoiceFromOrderOptions = {}
) {
  const existing = await prisma.invoice.findFirst({
    where: { businessId, orderId },
    include: { lines: { orderBy: { sortOrder: 'asc' } }, order: { select: { orderNumber: true } } },
  });
  if (existing) return { invoice: existing, created: false as const };

  const order = await prisma.order.findFirst({
    where: { id: orderId, businessId },
    include: { items: { include: { menuItem: true } } },
  });
  if (!order) return null;
  if (order.paymentStatus !== 'PAID' || order.status === 'CANCELLED') return null;

  const business = await prisma.business.findUnique({ where: { id: businessId } });
  const taxRate = business?.taxRate ?? 10;
  const lines = orderLinesToInvoiceLines(order, taxRate);
  const totals = invoiceTotalsFromOrder(order, lines);
  const status = options.status ?? invoiceStatusForOrder(order);

  const invoice = await prisma.$transaction(async tx => {
    const invoiceNumber = await allocateInvoiceNumber(tx, businessId);
    return tx.invoice.create({
      data: {
        businessId,
        invoiceNumber,
        status,
        type: options.type ?? 'FROM_ORDER',
        orderId: order.id,
        clientName: defaultClientName(order),
        clientEmail: order.customerEmail?.trim() || null,
        clientPhone: order.customerPhone?.trim() || null,
        clientAddress: clientAddressFromOrder(order),
        subtotalCents: totals.subtotalCents,
        taxCents: totals.taxCents,
        totalCents: totals.totalCents,
        createdById: options.createdById ?? null,
        lines: { create: lines },
      },
      include: {
        lines: { orderBy: { sortOrder: 'asc' } },
        order: { select: { orderNumber: true } },
      },
    });
  });

  return { invoice, created: true as const };
}

export function ensureInvoiceForPaidOrder(
  prisma: PrismaClient,
  businessId: string,
  orderId: string,
  createdById?: string
): ReturnType<typeof createInvoiceFromOrder> {
  return createInvoiceFromOrder(prisma, businessId, orderId, { createdById, type: 'AUTO' });
}

export function invoiceMissingFields(invoice: {
  clientName: string;
  clientEmail: string | null;
  status: string;
}): string[] {
  const missing: string[] = [];
  if (!invoice.clientName?.trim() || /^Commande n°/.test(invoice.clientName.trim())) {
    missing.push('nom client');
  }
  if (!invoice.clientEmail?.trim()) missing.push('email');
  return missing;
}
