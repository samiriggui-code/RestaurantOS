/** Métadonnées encaissement TPE — stockées sur Order.paymentMeta (JSON). */

export type PaymentTerminalProvider =
  | 'SUNMI_PAY'
  | 'INGENICO_BT'
  | 'INGENICO_USB'
  | 'MANUAL'
  | 'STRIPE'

export type PaymentCaptureMode = 'native' | 'manual'

export type OrderPaymentMeta = {
  provider?: PaymentTerminalProvider
  captureMode?: PaymentCaptureMode
  amountCents?: number
  transactionId?: string
  cardBrand?: string
  terminalReference?: string
  capturedAt?: string
  deviceUserAgent?: string
  /** Remboursement Stripe (annulation commande web) */
  stripeRefundId?: string
  stripeRefundedAt?: string
  stripeRefundAmountCents?: number
}

export function parsePaymentMeta(raw: unknown): OrderPaymentMeta | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (typeof o.provider !== 'string' || typeof o.captureMode !== 'string') return null
  return raw as OrderPaymentMeta
}

export function mergePaymentMeta(
  existing: unknown,
  patch: Partial<OrderPaymentMeta> & Record<string, unknown>
): OrderPaymentMeta & Record<string, unknown> {
  const base =
    existing && typeof existing === 'object'
      ? { ...(existing as Record<string, unknown>) }
      : {}
  return { ...base, ...patch } as OrderPaymentMeta & Record<string, unknown>
}
