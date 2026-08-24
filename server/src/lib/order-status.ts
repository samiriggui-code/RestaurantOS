/**
 * Machine d'états commande — transitions autorisées uniquement via assert/transition helpers.
 */

export const ORDER_STATUSES = [
  'PENDING_PAYMENT',
  'CONFIRMED',
  'PREPARING',
  'READY',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'DELIVERY_ISSUE',
  'COMPLETED',
  'CANCELLED',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_STATUSES = ['UNPAID', 'PAID', 'REFUNDED'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const TABLE_STATUSES = ['AVAILABLE', 'OCCUPIED', 'RESERVED'] as const;
export type TableStatus = (typeof TABLE_STATUSES)[number];

const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  PENDING_PAYMENT: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PREPARING', 'READY', 'COMPLETED', 'CANCELLED'],
  PREPARING: ['READY', 'CANCELLED'],
  READY: ['OUT_FOR_DELIVERY', 'COMPLETED', 'DELIVERED', 'CANCELLED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'DELIVERY_ISSUE', 'CANCELLED'],
  DELIVERED: ['COMPLETED'],
  DELIVERY_ISSUE: ['READY', 'OUT_FOR_DELIVERY', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

const PAYMENT_TRANSITIONS: Record<PaymentStatus, readonly PaymentStatus[]> = {
  UNPAID: ['PAID', 'REFUNDED'],
  PAID: ['REFUNDED'],
  REFUNDED: [],
};

export class InvalidOrderTransitionError extends Error {
  constructor(
    public readonly from: string,
    public readonly to: string
  ) {
    super(`Transition de statut interdite: ${from} → ${to}`);
    this.name = 'InvalidOrderTransitionError';
  }
}

export class InvalidPaymentTransitionError extends Error {
  constructor(
    public readonly from: string,
    public readonly to: string
  ) {
    super(`Transition de paiement interdite: ${from} → ${to}`);
    this.name = 'InvalidPaymentTransitionError';
  }
}

/** Normalise un statut legacy (ex. PENDING) vers l'enum produit. */
export function normalizeOrderStatus(raw: string): OrderStatus | null {
  if (raw === 'PENDING') return 'CONFIRMED';
  if ((ORDER_STATUSES as readonly string[]).includes(raw)) {
    return raw as OrderStatus;
  }
  return null;
}

export function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === 'string' && (ORDER_STATUSES as readonly string[]).includes(value);
}

export function isPaymentStatus(value: unknown): value is PaymentStatus {
  return typeof value === 'string' && (PAYMENT_STATUSES as readonly string[]).includes(value);
}

export function canTransitionOrderStatus(from: string, to: string): boolean {
  const fromN = normalizeOrderStatus(from);
  const toN = normalizeOrderStatus(to);
  if (!fromN || !toN) return false;
  if (fromN === toN) return true;
  return ORDER_TRANSITIONS[fromN].includes(toN);
}

export function assertOrderStatusTransition(from: string, to: string): OrderStatus {
  const toN = normalizeOrderStatus(to);
  if (!toN) {
    throw new InvalidOrderTransitionError(from, String(to));
  }
  if (!canTransitionOrderStatus(from, toN)) {
    throw new InvalidOrderTransitionError(from, toN);
  }
  return toN;
}

export function canTransitionPaymentStatus(from: string, to: string): boolean {
  if (!(PAYMENT_STATUSES as readonly string[]).includes(from)) return false;
  if (!(PAYMENT_STATUSES as readonly string[]).includes(to)) return false;
  if (from === to) return true;
  return PAYMENT_TRANSITIONS[from as PaymentStatus].includes(to as PaymentStatus);
}

export function assertPaymentStatusTransition(from: string, to: string): PaymentStatus {
  if (!isPaymentStatus(to) || !canTransitionPaymentStatus(from, to)) {
    throw new InvalidPaymentTransitionError(from, String(to));
  }
  return to;
}

/**
 * Valide puis applique un changement de statut commande (données Prisma à merger).
 * Ne persiste pas — le caller reste maître de la transaction / includes.
 */
export function transitionOrderStatus(
  currentStatus: string,
  nextStatus: string
): { status: OrderStatus } {
  return { status: assertOrderStatusTransition(currentStatus, nextStatus) };
}
