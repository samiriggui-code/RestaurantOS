import type { PrismaClient } from '@prisma/client';
import { getPaymentProvider } from './payment-provider';
import { mergePaymentMeta, type OrderPaymentMeta } from './payment-meta';

type RefundResult =
  { ok: true; skipped?: boolean; alreadyRefunded?: boolean } | { ok: false; error: string };

/**
 * Rembourse SumUp si la commande a un checkout — via PaymentProvider (SumUp only).
 * Idempotent via `paymentMeta.sumupRefundedAt`.
 */
export async function refundSumupPaymentForOrder(
  prisma: PrismaClient,
  order: {
    id: string;
    businessId: string;
    sumupCheckoutId: string | null;
    paymentStatus: string;
    paymentMeta: unknown;
    total: number;
  },
  options: { refund?: boolean } = {}
): Promise<RefundResult> {
  if (options.refund === false) {
    return { ok: true, skipped: true };
  }

  if (!order.sumupCheckoutId) {
    return { ok: true, skipped: true };
  }

  if (order.paymentStatus !== 'PAID') {
    return { ok: true, skipped: true };
  }

  const meta = (order.paymentMeta ?? {}) as OrderPaymentMeta;
  if (meta.sumupRefundedAt) {
    return { ok: true, alreadyRefunded: true };
  }

  const provider = getPaymentProvider();
  const result = await provider.refund({
    checkoutId: order.sumupCheckoutId,
    amountCents: order.total,
  });

  if (!result.ok) {
    console.error('[sumup-refund]', order.id, result.error);
    return { ok: false, error: result.error ?? 'Remboursement SumUp échoué' };
  }

  await prisma.order.update({
    where: { id: order.id },
    data: {
      paymentMeta: mergePaymentMeta(order.paymentMeta, {
        sumupRefundedAt: new Date().toISOString(),
        sumupRefundAmountCents: order.total,
      }) as object,
    },
  });

  return { ok: true };
}
