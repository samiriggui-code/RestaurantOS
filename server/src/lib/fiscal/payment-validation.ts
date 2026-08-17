import type { OrderPaymentMeta } from '../payment-meta'

/** Carte manuelle : référence TPE obligatoire pour traçabilité. */
export function assertManualCardPaymentMeta(
  paymentMethod: string | null | undefined,
  paymentMeta: OrderPaymentMeta | null | undefined,
): void {
  if (paymentMethod !== 'CARD') return
  const provider = paymentMeta?.provider ?? 'MANUAL'
  if (provider !== 'MANUAL') return
  const ref =
    paymentMeta?.terminalReference?.trim() ||
    paymentMeta?.transactionId?.trim()
  if (!ref) {
    throw new Error(
      'Référence TPE requise pour un paiement carte manuel (n° transaction ou autorisation)',
    )
  }
}
