import type { OrderStatus } from '@prisma/client';

/**
 * Miroir de l'enum Prisma OrderStatus, volontairement sans import runtime de @prisma/client
 * (mocké dans plusieurs tests de routes). Un test garantit qu'il reste identique à l'enum.
 */
export const ORDER_STATUS_VALUES: readonly OrderStatus[] = [
  'PENDING_PAYMENT',
  'CONFIRMED',
  'PREPARING',
  'READY',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'DELIVERY_ISSUE',
  'COMPLETED',
  'CANCELLED',
];

/**
 * Parse `?status=A,B,C` en ne gardant que les valeurs de l'enum OrderStatus.
 * Un statut inconnu (ex. l'ancien `PENDING`) faisait lever une PrismaClientValidationError
 * → 500 sur la cuisine / le moniteur. On l'ignore plutôt que de faire planter la liste.
 */
export function parseOrderStatusFilter(raw: string | undefined): OrderStatus[] {
  if (!raw) return [];
  const valid = new Set<string>(ORDER_STATUS_VALUES);
  return raw
    .split(',')
    .map(s => s.trim())
    .filter((s): s is OrderStatus => valid.has(s));
}
