import type { PrismaClient } from '@prisma/client';

export type LoyaltyOrderSnapshot = {
  id: string;
  customerPhone: string | null;
  customerName: string | null;
  total: number;
  paymentStatus: string;
  /** Nombre de pizzas dans la commande (catégories tomate/creme/z-pizzas) — base du programme, pas le total €. */
  pizzaCount: number;
};

/** Normalise téléphone FR pour clé fidélité (chiffres uniquement). */
export function normalizeLoyaltyPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10 && digits.startsWith('0')) return digits;
  if (digits.length === 11 && digits.startsWith('33')) return `0${digits.slice(2)}`;
  return digits;
}

/**
 * Points gagnés sur une commande payée — 1 pt par pizza commandée (pas par euro dépensé),
 * pour que "à la 10ème pizza, medium offerte" corresponde vraiment à 10 pizzas et pas à un
 * montant en euros qui varie selon les tailles/recettes commandées.
 */
export function loyaltyPointsForOrder(pizzaCount: number, pointsPerPizza: number): number {
  if (pizzaCount <= 0 || pointsPerPizza <= 0) return 0;
  return Math.round(pizzaCount * pointsPerPizza);
}

/** Pizza(s) offerte(s) disponibles selon le solde points. */
export function loyaltyFreePizzasAvailable(
  totalPoints: number,
  pointsForFreePizza: number
): number {
  if (pointsForFreePizza <= 0) return 0;
  return Math.floor(totalPoints / pointsForFreePizza);
}

export type LoyaltyBalance = {
  enabled: boolean;
  points: number;
  freePizzasAvailable: number;
  pointsUntilNextFree: number;
  pointsForFreePizza: number;
};

/** Solde fidélité pour un téléphone donné — usage checkout public (lecture seule, sans auth staff). */
export async function getLoyaltyBalance(
  prisma: PrismaClient,
  businessId: string,
  phoneRaw: string
): Promise<LoyaltyBalance> {
  const disabled: LoyaltyBalance = {
    enabled: false,
    points: 0,
    freePizzasAvailable: 0,
    pointsUntilNextFree: 0,
    pointsForFreePizza: 0,
  };
  const program = await prisma.loyaltyProgram.findFirst({ where: { businessId, enabled: true } });
  if (!program) return disabled;

  const phone = normalizeLoyaltyPhone(phoneRaw);
  if (!phone) return { ...disabled, enabled: true, pointsForFreePizza: program.pointsForFreePizza };

  const customer = await prisma.loyaltyCustomer.findFirst({ where: { businessId, phone } });
  const points = customer?.totalPoints ?? 0;
  const threshold =
    program.pointsForFreePizza > 0 ? program.pointsForFreePizza : program.minPointsRedeem;

  return {
    enabled: true,
    points,
    freePizzasAvailable: loyaltyFreePizzasAvailable(points, threshold),
    pointsUntilNextFree: loyaltyPointsUntilNextFree(points, threshold),
    pointsForFreePizza: threshold,
  };
}

/** Points restants avant la prochaine pizza offerte. */
export function loyaltyPointsUntilNextFree(totalPoints: number, threshold: number): number {
  if (threshold <= 0) return 0;
  const mod = totalPoints % threshold;
  if (mod === 0 && totalPoints >= threshold) return 0;
  return threshold - mod;
}

/**
 * Crédite les points fidélité après paiement (idempotent par commande).
 * Récompense = pizza offerte (pas de réduction €) — voir redeemLoyaltyFreePizza.
 */
export async function creditLoyaltyForPaidOrder(
  prisma: PrismaClient,
  businessId: string,
  order: LoyaltyOrderSnapshot
): Promise<{ credited: boolean; points?: number }> {
  if (order.paymentStatus !== 'PAID') return { credited: false };
  const phoneRaw = order.customerPhone?.trim();
  if (!phoneRaw) return { credited: false };

  const program = await prisma.loyaltyProgram.findFirst({
    where: { businessId, enabled: true },
  });
  if (!program) return { credited: false };

  const existingTx = await prisma.loyaltyTransaction.findFirst({
    where: {
      referenceType: 'ORDER',
      referenceId: order.id,
      type: 'EARN',
      customer: { businessId },
    },
  });
  if (existingTx) return { credited: false };

  const phone = normalizeLoyaltyPhone(phoneRaw);
  if (!phone) return { credited: false };

  const points = loyaltyPointsForOrder(order.pizzaCount, program.pointsPerDinar);
  if (points <= 0) return { credited: false };

  let customer = await prisma.loyaltyCustomer.findFirst({
    where: { businessId, phone },
  });

  if (!customer) {
    customer = await prisma.loyaltyCustomer.create({
      data: {
        businessId,
        programId: program.id,
        phone,
        name: order.customerName?.trim() || null,
      },
    });
  } else if (order.customerName?.trim() && !customer.name) {
    await prisma.loyaltyCustomer.update({
      where: { id: customer.id },
      data: { name: order.customerName.trim() },
    });
  }

  await prisma.loyaltyTransaction.create({
    data: {
      customerId: customer.id,
      type: 'EARN',
      points,
      referenceType: 'ORDER',
      referenceId: order.id,
      description: `Commande — ${points} pt(s)`,
    },
  });

  await prisma.loyaltyCustomer.update({
    where: { id: customer.id },
    data: {
      totalPoints: { increment: points },
      totalSpent: { increment: order.total },
      visitCount: { increment: 1 },
      lastVisit: new Date(),
    },
  });

  return { credited: true, points };
}

/** Utilise les points pour 1 pizza offerte (déduction fixe, pas de montant €). */
export async function redeemLoyaltyFreePizza(
  prisma: PrismaClient,
  businessId: string,
  customerId: string,
  description?: string
): Promise<{ success: boolean; error?: string; remainingPoints?: number }> {
  const program = await prisma.loyaltyProgram.findFirst({
    where: { businessId, enabled: true },
  });
  if (!program) return { success: false, error: 'Programme fidélité inactif' };

  const cost =
    program.pointsForFreePizza > 0 ? program.pointsForFreePizza : program.minPointsRedeem;

  const customer = await prisma.loyaltyCustomer.findFirst({
    where: { id: customerId, businessId },
  });
  if (!customer) return { success: false, error: 'Client introuvable' };
  if (customer.totalPoints < cost) {
    return {
      success: false,
      error: `Il faut ${cost} points pour une pizza offerte (${customer.totalPoints} pts)`,
    };
  }

  await prisma.loyaltyTransaction.create({
    data: {
      customerId: customer.id,
      type: 'REDEEM',
      points: -cost,
      referenceType: 'FREE_PIZZA',
      description: description ?? '1 pizza offerte',
    },
  });

  const updated = await prisma.loyaltyCustomer.update({
    where: { id: customer.id },
    data: { totalPoints: { decrement: cost } },
  });

  return { success: true, remainingPoints: updated.totalPoints };
}

/** Catégories comptant comme "pizza" pour le programme fidélité (hors suppléments/desserts/boissons). */
const PIZZA_CATEGORY_SLUGS = ['tomate', 'creme', 'z-pizzas'];

export async function ensureLoyaltyCreditForPaidOrder(
  prisma: PrismaClient,
  businessId: string,
  orderId: string
): Promise<void> {
  const order = await prisma.order.findFirst({
    where: { id: orderId, businessId },
    select: {
      id: true,
      customerPhone: true,
      customerName: true,
      total: true,
      paymentStatus: true,
      items: {
        select: { quantity: true, menuItem: { select: { category: { select: { slug: true } } } } },
      },
    },
  });
  if (!order) return;
  const pizzaCount = order.items.reduce(
    (sum, item) =>
      sum + (PIZZA_CATEGORY_SLUGS.includes(item.menuItem.category.slug ?? '') ? item.quantity : 0),
    0
  );
  try {
    await creditLoyaltyForPaidOrder(prisma, businessId, {
      id: order.id,
      customerPhone: order.customerPhone,
      customerName: order.customerName,
      total: order.total,
      paymentStatus: order.paymentStatus,
      pizzaCount,
    });
  } catch (err) {
    console.error('[loyalty] credit order:', err);
  }
}
