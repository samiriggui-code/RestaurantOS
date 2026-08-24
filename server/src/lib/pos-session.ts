import type { PrismaClient } from '@prisma/client';

export type PosSessionResult =
  | { ok: true; session: unknown }
  | { ok: false; status: number; error: string };

/**
 * Ouvre une session de caisse (fond de caisse déclaré). Refuse s'il en existe
 * déjà une OPEN pour ce cashier/business — une seule session active à la fois.
 */
export async function openPosSession(
  prisma: PrismaClient,
  params: {
    businessId: string;
    cashierId: string;
    openingCashAmount: number;
  }
): Promise<PosSessionResult> {
  if (!Number.isFinite(params.openingCashAmount) || params.openingCashAmount < 0) {
    return { ok: false, status: 400, error: 'openingCashAmount doit être un entier positif (centimes)' };
  }

  const existing = await prisma.posSession.findFirst({
    where: { businessId: params.businessId, cashierId: params.cashierId, status: 'OPEN' },
  });
  if (existing) {
    return { ok: false, status: 400, error: 'Une session de caisse est déjà ouverte pour ce caissier' };
  }

  const session = await prisma.posSession.create({
    data: {
      businessId: params.businessId,
      cashierId: params.cashierId,
      openingCashAmount: Math.round(params.openingCashAmount),
      status: 'OPEN',
    },
  });

  return { ok: true, session };
}

/**
 * Ferme une session de caisse : calcule l'attendu (encaissements CASH sur la fenêtre
 * de session) et l'écart avec le comptage déclaré.
 */
export async function closePosSession(
  prisma: PrismaClient,
  params: {
    sessionId: string;
    businessId: string;
    closingCashAmount: number;
    notes?: string;
  }
): Promise<PosSessionResult> {
  if (!Number.isFinite(params.closingCashAmount) || params.closingCashAmount < 0) {
    return { ok: false, status: 400, error: 'closingCashAmount doit être un entier positif (centimes)' };
  }

  const existing = await prisma.posSession.findFirst({
    where: { id: params.sessionId, businessId: params.businessId },
  });
  if (!existing) {
    return { ok: false, status: 404, error: 'Session introuvable' };
  }
  if (existing.status === 'CLOSED') {
    return { ok: false, status: 400, error: 'Session déjà clôturée' };
  }

  const closedAt = new Date();
  const cashOrders = await prisma.order.aggregate({
    _sum: { total: true },
    where: {
      businessId: params.businessId,
      cashierId: existing.cashierId,
      paymentMethod: 'CASH',
      paymentStatus: 'PAID',
      createdAt: { gte: existing.openedAt, lte: closedAt },
    },
  });
  const expectedCashAmount = cashOrders._sum.total ?? 0;
  const closingCashAmount = Math.round(params.closingCashAmount);
  const discrepancy = closingCashAmount - expectedCashAmount;

  const session = await prisma.posSession.update({
    where: { id: existing.id },
    data: {
      status: 'CLOSED',
      closedAt,
      closingCashAmount,
      expectedCashAmount,
      discrepancy,
      notes: params.notes?.trim() || existing.notes,
    },
  });

  return { ok: true, session };
}

/** Session ouverte en cours pour ce cashier, ou null. */
export async function getCurrentPosSession(
  prisma: PrismaClient,
  params: { businessId: string; cashierId: string }
) {
  return prisma.posSession.findFirst({
    where: { businessId: params.businessId, cashierId: params.cashierId, status: 'OPEN' },
    orderBy: { openedAt: 'desc' },
  });
}
