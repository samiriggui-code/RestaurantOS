import { mergePaymentMeta, type OrderPaymentMeta } from './payment-meta';

/** Meta d'encaissement manuel CASH/CARD pour create / encash. */
export function applyPaymentMeta(
  body: { paymentMeta?: OrderPaymentMeta; paymentMethod?: string },
  totalCents: number
): { paymentMeta?: object; paymentCapturedAt?: Date } {
  if (!body.paymentMethod || !['CASH', 'CARD'].includes(body.paymentMethod)) return {};
  const meta = mergePaymentMeta(body.paymentMeta ?? null, {
    amountCents: totalCents,
    capturedAt: body.paymentMeta?.capturedAt ?? new Date().toISOString(),
    provider: body.paymentMeta?.provider ?? (body.paymentMethod === 'CASH' ? 'MANUAL' : 'MANUAL'),
    captureMode: body.paymentMeta?.captureMode ?? 'manual',
  });
  return {
    paymentMeta: meta as object,
    paymentCapturedAt: new Date(meta.capturedAt ?? new Date().toISOString()),
  };
}
