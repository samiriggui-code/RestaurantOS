import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { getBusinessId } from './business';
import { computeDeliveryQuote } from './delivery-quote';
import { eurosToCents } from './money';
import { pizzaSubtotalFromLines } from './pizza-subtotal';
import { parseTimeSlotToDate, validateTimeSlot } from './time-slots';
import { validateFormuleLines } from './sync-menu-formules';
import { generateDeliveryHandoverCode } from './delivery-handover';
import { geocodeDeliveryAddress } from './geocode';
import { allocateOrderNumber } from './order-number';

const SNAPSHOT_SLUG = '__snapshot__';

export type OnlineCartLine = {
  slug: string;
  name: string;
  categoryId: string;
  unitPrice: number;
  quantity: number;
  sizeLabel?: string;
  offerTag?: string;
};

export type OnlineCheckout = {
  orderType: 'pickup' | 'delivery';
  customerFirstName: string;
  customerLastName: string;
  customerPhone: string;
  customerEmail?: string;
  addressLine?: string;
  postalCode?: string;
  city?: string;
  instructions?: string;
  timeSlot?: string;
  /** Paiement au comptoir — commande PENDING_PAYMENT jusqu'à encaissement POS */
  payAtCounter?: boolean;
};

export type OnlineOrderBody = {
  lines: OnlineCartLine[];
  checkout: OnlineCheckout;
  subtotal: number;
  deliveryFee: number;
  total: number;
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- retour = payload Prisma MenuItem (existant ou créé), type dérivé du client généré.
export async function ensureSnapshotMenuItem(prisma: PrismaClient, businessId: string) {
  const existing = await prisma.menuItem.findFirst({
    where: { slug: SNAPSHOT_SLUG, category: { businessId } },
  });
  if (existing) return existing;

  const category = await prisma.menuCategory.create({
    data: {
      businessId,
      name: 'Commande en ligne (interne)',
      sortOrder: 999,
      isActive: false,
    },
  });

  return prisma.menuItem.create({
    data: {
      categoryId: category.id,
      name: 'Ligne commande en ligne',
      slug: SNAPSHOT_SLUG,
      price: 0,
      isActive: false,
      isAvailable: false,
    },
  });
}

async function resolveMenuItem(
  prisma: PrismaClient,
  businessId: string,
  line: OnlineCartLine,
  snapshotItemId: string
): Promise<string> {
  const bySlug = await prisma.menuItem.findFirst({
    where: { slug: line.slug, category: { businessId } },
  });
  if (bySlug && bySlug.slug !== SNAPSHOT_SLUG) return bySlug.id;
  return snapshotItemId;
}

export function validateOnlineOrderBody(body: OnlineOrderBody): string | null {
  if (!body.lines?.length) return 'Panier vide';
  const { checkout } = body;
  if (!checkout?.customerFirstName?.trim() || !checkout?.customerLastName?.trim()) {
    return 'Prénom et nom obligatoires';
  }
  if (!checkout?.customerPhone?.trim()) return 'Téléphone obligatoire';

  if (checkout.orderType === 'delivery') {
    if (!checkout.addressLine?.trim() || !checkout.postalCode?.trim() || !checkout.city?.trim()) {
      return 'Adresse de livraison incomplète';
    }
  }

  const computedSubtotal = body.lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  if (Math.abs(computedSubtotal - body.subtotal) > 0.05) {
    return 'Sous-total incohérent';
  }

  const expectedTotal = body.subtotal + (checkout.orderType === 'delivery' ? body.deliveryFee : 0);
  if (Math.abs(expectedTotal - body.total) > 0.05) {
    return 'Total incohérent';
  }

  return null;
}

export type CreateOnlineOrderOptions = {
  cardPaid?: { sumupCheckoutId: string };
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- une dizaine de branches d'erreur + succès (payload Order Prisma) ; union dérivée du code, pas dupliquée à la main sur le chemin de création de commande.
export async function createOnlineOrder(
  prisma: PrismaClient,
  body: OnlineOrderBody,
  options: CreateOnlineOrderOptions = {}
) {
  const businessId = getBusinessId();
  const validationError = validateOnlineOrderBody(body);
  if (validationError) {
    return { error: validationError, status: 400 as const };
  }

  if (body.checkout.orderType === 'delivery') {
    const pizzaSubtotal = pizzaSubtotalFromLines(body.lines);
    const quote = await computeDeliveryQuote(
      prisma,
      businessId,
      body.checkout.postalCode!.trim(),
      body.checkout.city!.trim(),
      pizzaSubtotal
    );
    if (!quote.ok) {
      return { error: quote.error ?? 'Livraison impossible', status: 400 as const };
    }
    if (Math.abs(body.deliveryFee - quote.fee) > 0.05) {
      return { error: 'Frais de livraison invalides', status: 400 as const };
    }
  }

  const slotError = await validateTimeSlot(prisma, businessId, body.checkout.timeSlot);
  if (slotError) {
    return { error: slotError, status: 400 as const };
  }

  const formuleError = await validateFormuleLines(
    prisma,
    businessId,
    body.lines.map(l => ({ slug: l.slug, unitPrice: l.unitPrice, offerTag: l.offerTag }))
  );
  if (formuleError) {
    return { error: formuleError, status: 400 as const };
  }

  const scheduledAt = parseTimeSlotToDate(body.checkout.timeSlot);

  const snapshot = await ensureSnapshotMenuItem(prisma, businessId);
  const { checkout } = body;

  let itemsSubtotalCents = 0;
  const orderItemsData: Array<{
    menuItemId: string;
    quantity: number;
    price: number;
    notes: string | null;
    selectedModifiers: object;
  }> = [];

  for (const line of body.lines) {
    const menuItemId = await resolveMenuItem(prisma, businessId, line, snapshot.id);
    const priceCents = eurosToCents(line.unitPrice);
    itemsSubtotalCents += priceCents * line.quantity;

    const notes = [line.sizeLabel, line.offerTag ? `Offre: ${line.offerTag}` : null]
      .filter(Boolean)
      .join(' · ');

    orderItemsData.push({
      menuItemId,
      quantity: line.quantity,
      price: priceCents,
      notes: notes || null,
      selectedModifiers: {
        slug: line.slug,
        name: line.name,
        categoryId: line.categoryId,
        sizeLabel: line.sizeLabel,
        offerTag: line.offerTag,
      },
    });
  }

  const deliveryCents = checkout.orderType === 'delivery' ? eurosToCents(body.deliveryFee) : 0;
  const orderTotal = itemsSubtotalCents + deliveryCents;

  if (Math.abs(orderTotal - eurosToCents(body.total)) > 5) {
    return { error: 'Total serveur incohérent', status: 400 as const };
  }

  const trackingToken = randomUUID().replace(/-/g, '').slice(0, 12);

  const customerName =
    `${checkout.customerFirstName.trim()} ${checkout.customerLastName.trim()}`.trim();
  const orderType = checkout.orderType === 'delivery' ? 'DELIVERY' : 'TAKEAWAY';
  const cardPaid = options.cardPaid;

  let order;
  try {
    order = await prisma.$transaction(async tx => {
      const orderNumber = await allocateOrderNumber(tx, businessId);
      return tx.order.create({
        data: {
          businessId,
          orderNumber,
          customerName,
          customerPhone: checkout.customerPhone.trim(),
          customerEmail: checkout.customerEmail?.trim() || null,
          type: orderType,
          status: cardPaid ? 'CONFIRMED' : 'PENDING_PAYMENT',
          paymentStatus: cardPaid ? 'PAID' : 'UNPAID',
          paymentMethod: cardPaid ? 'CARD' : checkout.payAtCounter ? 'COUNTER' : null,
          sumupCheckoutId: cardPaid?.sumupCheckoutId ?? null,
          isOnlineOrder: true,
          channel: 'WEB',
          trackingToken,
          subtotal: itemsSubtotalCents,
          tax: 0,
          serviceCharge: deliveryCents,
          total: orderTotal,
          notes:
            [
              checkout.instructions?.trim(),
              checkout.timeSlot ? `Créneau: ${checkout.timeSlot}` : null,
            ]
              .filter(Boolean)
              .join('\n') || null,
          deliveryAddress: checkout.orderType === 'delivery' ? checkout.addressLine?.trim() : null,
          deliveryPostalCode:
            checkout.orderType === 'delivery' ? checkout.postalCode?.trim() : null,
          deliveryCity: checkout.orderType === 'delivery' ? checkout.city?.trim() : null,
          deliveryHandoverCode: orderType === 'DELIVERY' ? generateDeliveryHandoverCode() : null,
          scheduledAt,
          items: { create: orderItemsData },
        },
        include: {
          items: { include: { menuItem: true } },
        },
      });
    });
  } catch (err: unknown) {
    const checkoutId = cardPaid?.sumupCheckoutId;
    if (checkoutId && isPrismaUniqueViolation(err)) {
      const existing = await prisma.order.findFirst({
        where: { sumupCheckoutId: checkoutId, businessId },
        include: { items: { include: { menuItem: true } } },
      });
      if (existing?.trackingToken) {
        return {
          order: existing,
          trackingToken: existing.trackingToken,
          orderNumber: existing.orderNumber,
        };
      }
    }
    throw err;
  }

  if (orderType === 'DELIVERY') {
    void geocodeDeliveryAddress(order.deliveryAddress, order.deliveryPostalCode, order.deliveryCity)
      .then(coords => {
        if (coords) {
          return prisma.order.update({
            where: { id: order.id },
            data: { deliveryLat: coords.lat, deliveryLng: coords.lng },
          });
        }
      })
      .catch(() => {});
  }

  return { order, trackingToken, orderNumber: order.orderNumber };
}

function isPrismaUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: string }).code === 'P2002'
  );
}
