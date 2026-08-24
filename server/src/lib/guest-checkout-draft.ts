import type { PrismaClient } from '@prisma/client';
import type { Server as SocketIOServer } from 'socket.io';
import { getBusinessId } from './business';
import { createOnlineOrder, validateOnlineOrderBody, type OnlineOrderBody } from './online-order';
import { eurosToCents } from './money';
import { runOnlineCardPaymentHooks } from './online-payment-finalize';
import { getPaymentProvider, assertPaymentConfigured } from './payment-provider';
import { sumupWebhookUrl } from './sumup-online-config';

const DRAFT_TTL_MS = 2 * 60 * 60 * 1000;

export async function createGuestCheckoutDraft(
  prisma: PrismaClient,
  body: OnlineOrderBody
): Promise<{ error: string; status: 400 } | { draftId: string; checkoutId: string }> {
  const businessId = getBusinessId();
  const validationError = validateOnlineOrderBody(body);
  if (validationError) {
    return { error: validationError, status: 400 as const };
  }

  try {
    assertPaymentConfigured();
  } catch {
    return { error: 'SumUp non configuré', status: 400 as const };
  }
  const returnUrl = sumupWebhookUrl();
  if (!returnUrl) {
    return { error: 'SumUp non configuré (API_PUBLIC_BASE_URL manquant)', status: 400 as const };
  }

  const totalCents = eurosToCents(body.total);
  if (totalCents < 50) {
    return { error: 'Montant minimum 0,50 €', status: 400 as const };
  }

  const expiresAt = new Date(Date.now() + DRAFT_TTL_MS);
  const draft = await prisma.guestCheckoutDraft.create({
    data: {
      businessId,
      payload: body as object,
      totalCents,
      expiresAt,
    },
  });

  const provider = getPaymentProvider();
  const checkout = await provider.createOnlineCheckout({
    amountCents: totalCents,
    currency: 'EUR',
    checkoutReference: draft.id,
    description: 'Commande en ligne',
    returnUrl,
  });

  await prisma.guestCheckoutDraft.update({
    where: { id: draft.id },
    data: { sumupCheckoutId: checkout.checkoutId },
  });

  return {
    draftId: draft.id,
    checkoutId: checkout.checkoutId,
  };
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- une dizaine de branches d'erreur à statuts distincts + succès ; l'union exacte doit rester dérivée du code, pas dupliquée à la main sur un chemin de paiement.
export async function completeGuestCheckout(
  prisma: PrismaClient,
  io: SocketIOServer | null,
  draftId: string,
  checkoutId?: string
) {
  const businessId = getBusinessId();

  const draft = await prisma.guestCheckoutDraft.findFirst({
    where: { id: draftId, businessId },
  });
  if (!draft) {
    return { error: 'Session de paiement introuvable', status: 404 as const };
  }
  if (draft.consumedAt) {
    const existing = draft.sumupCheckoutId
      ? await prisma.order.findFirst({
          where: { sumupCheckoutId: draft.sumupCheckoutId, businessId },
        })
      : null;
    if (existing?.trackingToken) {
      return {
        token: existing.trackingToken,
        orderNumber: existing.orderNumber,
        orderId: existing.id,
      };
    }
    return { error: 'Session déjà utilisée', status: 409 as const };
  }
  if (draft.expiresAt < new Date()) {
    return { error: 'Session expirée — recommencez votre commande', status: 410 as const };
  }

  const id = checkoutId ?? draft.sumupCheckoutId;
  if (!id) {
    return { error: 'Paiement introuvable', status: 400 as const };
  }

  const checkout = await getPaymentProvider().getCheckoutStatus(id);
  if (!checkout.paid) {
    return { error: 'Paiement non confirmé', status: 402 as const, pending: true as const };
  }
  if (checkout.amountCents != null && checkout.amountCents !== draft.totalCents) {
    return { error: 'Montant incohérent', status: 400 as const };
  }

  const existingOrder = await prisma.order.findFirst({
    where: { sumupCheckoutId: id, businessId },
  });
  if (existingOrder?.trackingToken) {
    await prisma.guestCheckoutDraft.update({
      where: { id: draft.id },
      data: { consumedAt: new Date(), sumupCheckoutId: id },
    });
    return {
      token: existingOrder.trackingToken,
      orderNumber: existingOrder.orderNumber,
      orderId: existingOrder.id,
    };
  }

  const body = draft.payload as OnlineOrderBody;
  const created = await createOnlineOrder(prisma, body, {
    cardPaid: { sumupCheckoutId: id },
  });
  if ('error' in created && created.error) {
    return { error: created.error, status: created.status ?? 400 };
  }
  const { order, trackingToken, orderNumber } = created;
  if (!order || !trackingToken) {
    return { error: 'Commande non créée', status: 500 as const };
  }

  await prisma.guestCheckoutDraft.update({
    where: { id: draft.id },
    data: { consumedAt: new Date(), sumupCheckoutId: id },
  });

  if (io) {
    await runOnlineCardPaymentHooks(prisma, io, businessId, order.id);
  }

  return { token: trackingToken, orderNumber, orderId: order.id };
}

/** Webhook SumUp (non signé — re-vérifie toujours le statut via l'API). Idempotent. */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- retour = payload Prisma Order (via completeGuestCheckout) ou null selon plusieurs branches d'idempotence webhook.
export async function reconcileGuestCheckoutFromWebhook(
  prisma: PrismaClient,
  io: SocketIOServer,
  checkoutId: string
) {
  const provider = getPaymentProvider();
  const checkout = await provider.getCheckoutStatus(checkoutId);
  if (!checkout.paid) return null;

  const draftId = checkout.checkoutReference;
  if (!draftId) return null;

  const draft = await prisma.guestCheckoutDraft.findUnique({ where: { id: draftId } });
  if (!draft) return null;

  const existing = await prisma.order.findFirst({
    where: { sumupCheckoutId: checkoutId, businessId: draft.businessId },
  });
  if (existing) {
    if (!draft.consumedAt) {
      await prisma.guestCheckoutDraft.update({
        where: { id: draft.id },
        data: { consumedAt: new Date(), sumupCheckoutId: checkoutId },
      });
    }
    return existing;
  }

  const result = await completeGuestCheckout(prisma, io, draftId, checkoutId);
  if ('error' in result && result.error) {
    console.error('[webhook] guest checkout finalize failed:', draftId, result.error);
    return null;
  }
  if ('orderId' in result) {
    return prisma.order.findFirst({ where: { id: result.orderId, businessId: draft.businessId } });
  }
  return null;
}
