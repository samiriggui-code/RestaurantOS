/**
 * Métadonnées encaissement — alignées server/src/lib/payment-meta.ts
 */

export type PaymentTerminalProvider =
  | 'SUNMI_PAY'
  | 'INGENICO_BT'
  | 'INGENICO_USB'
  | 'SUMUP'
  | 'MANUAL'

export type PaymentCaptureMode = 'native' | 'manual'

export type PaymentMeta = {
  provider: PaymentTerminalProvider
  captureMode: PaymentCaptureMode
  amountCents: number
  transactionId?: string
  cardBrand?: string
  terminalReference?: string
  capturedAt: string
}

export function buildPaymentMeta(
  method: 'CASH' | 'CARD',
  amountCents: number,
  opts?: {
    provider?: PaymentTerminalProvider
    captureMode?: PaymentCaptureMode
    transactionId?: string
    cardBrand?: string
    terminalReference?: string
  }
): PaymentMeta {
  const now = new Date().toISOString()
  if (method === 'CASH') {
    return {
      provider: 'MANUAL',
      captureMode: 'manual',
      amountCents,
      capturedAt: now,
      terminalReference: opts?.terminalReference,
    }
  }
  return {
    provider: opts?.provider ?? 'MANUAL',
    captureMode: opts?.captureMode ?? 'manual',
    amountCents,
    transactionId: opts?.transactionId,
    cardBrand: opts?.cardBrand,
    terminalReference: opts?.terminalReference,
    capturedAt: now,
  }
}

export function manualCardMeta(
  amountCents: number,
  reference: string,
  terminalReference?: string,
): PaymentMeta {
  return buildPaymentMeta('CARD', amountCents, {
    provider: 'MANUAL',
    captureMode: 'manual',
    terminalReference: terminalReference?.trim() || reference,
  })
}
