/**

 * Pont TPE — SUNMI Pay + Ingenico BT/USB via APK Android.

 * Repli automatique : mode manuel si aucun provider natif ou échec.

 */



import type { PaymentMeta, PaymentTerminalProvider } from '@/lib/payment/payment-meta'



export type TerminalPaymentState =

  | 'idle'

  | 'connecting'

  | 'awaiting_card'

  | 'processing'

  | 'approved'

  | 'declined'

  | 'cancelled'

  | 'error'



export type TerminalPaymentResult =

  | {

      ok: true

      method: 'CARD'

      transactionId?: string

      cardBrand?: string

      provider?: PaymentTerminalProvider

      message?: string

    }

  | {

      ok: false

      reason: 'declined' | 'cancelled' | 'error' | 'timeout' | 'unavailable'

      message?: string

    }



export type TerminalStatusPayload = {

  state: TerminalPaymentState

  message?: string

  transactionId?: string

  cardBrand?: string

  provider?: string

}



export type TerminalProviderCapability = {

  id: string

  label: string

  connection: 'integrated' | 'bluetooth' | 'usb' | string

  available: boolean

}



export type TerminalCapabilities = {

  providers: TerminalProviderCapability[]

  activeProvider: string | null

  fallbackManual: boolean

}



export type PaymentTerminalBridge = {

  startPayment: (amountCents: number, reference: string) => string

  cancelPayment: (sessionId: string) => void

  getPaymentStatus: (sessionId: string) => string

  isAvailable?: () => boolean

  getCapabilities?: () => string

}



declare global {

  interface Window {

    PaymentTerminal?: PaymentTerminalBridge

  }

}



const TERMINAL_LABEL: Record<TerminalPaymentState, string> = {

  idle: 'Inactif',

  connecting: 'Connexion au TPE…',

  awaiting_card: 'Présentez la carte ou Apple Pay',

  processing: 'Traitement en cours…',

  approved: 'Paiement accepté',

  declined: 'Paiement refusé',

  cancelled: 'Paiement annulé',

  error: 'Erreur terminal',

}



export function terminalStateLabel(state: TerminalPaymentState): string {

  return TERMINAL_LABEL[state] ?? state

}



export function getTerminalCapabilities(): TerminalCapabilities | null {

  try {

    const raw = window.PaymentTerminal?.getCapabilities?.()

    if (!raw) return null

    return JSON.parse(raw) as TerminalCapabilities

  } catch {

    return null

  }

}



export function isPaymentTerminalAvailable(): boolean {

  try {

    if (typeof window === 'undefined') return false

    const bridge = window.PaymentTerminal

    if (!bridge?.startPayment || !bridge.getPaymentStatus) return false

    if (bridge.isAvailable?.() === true) return true

    const caps = getTerminalCapabilities()

    return caps?.providers.some((p) => p.available) ?? false

  } catch {

    return false

  }

}



export function getPaymentTerminalMode(): 'native' | 'manual' {

  return isPaymentTerminalAvailable() ? 'native' : 'manual'

}



export function nativeProviderLabel(): string {

  const caps = getTerminalCapabilities()

  const active = caps?.providers.find((p) => p.id === caps.activeProvider && p.available)

  return active?.label ?? 'TPE natif'

}



function parseStatus(raw: string): TerminalStatusPayload | null {

  try {

    const data = JSON.parse(raw) as TerminalStatusPayload

    if (data?.state) return data

  } catch {

    /* ignore */

  }

  return null

}



function mapProvider(id?: string): PaymentTerminalProvider {

  if (id === 'SUNMI_PAY' || id === 'INGENICO_BT' || id === 'INGENICO_USB') return id

  return 'MANUAL'

}



const TERMINAL_TIMEOUT_MS = 120_000

const POLL_INTERVAL_MS = 450



function sleep(ms: number, signal?: AbortSignal): Promise<void> {

  return new Promise((resolve, reject) => {

    if (signal?.aborted) {

      reject(new DOMException('Aborted', 'AbortError'))

      return

    }

    const t = setTimeout(resolve, ms)

    signal?.addEventListener('abort', () => {

      clearTimeout(t)

      reject(new DOMException('Aborted', 'AbortError'))

    })

  })

}



export async function runNativeTerminalPayment(

  amountCents: number,

  reference: string,

  onStatus: (status: TerminalStatusPayload) => void,

  signal?: AbortSignal,

): Promise<TerminalPaymentResult> {

  const bridge = window.PaymentTerminal

  if (!bridge?.startPayment) {

    return { ok: false, reason: 'unavailable', message: 'Pont TPE indisponible — mode manuel' }

  }



  if (!isPaymentTerminalAvailable()) {

    return { ok: false, reason: 'unavailable', message: 'Aucun TPE natif détecté' }

  }



  let sessionId: string

  try {

    sessionId = bridge.startPayment(amountCents, reference)

  } catch (err) {

    return {

      ok: false,

      reason: 'error',

      message: err instanceof Error ? err.message : 'Impossible de démarrer le TPE',

    }

  }



  const deadline = Date.now() + TERMINAL_TIMEOUT_MS



  while (Date.now() < deadline) {

    if (signal?.aborted) {

      try {

        bridge.cancelPayment?.(sessionId)

      } catch {

        /* ignore */

      }

      return { ok: false, reason: 'cancelled', message: 'Annulé par la caisse' }

    }



    let payload: TerminalStatusPayload | null = null

    try {

      payload = parseStatus(bridge.getPaymentStatus(sessionId))

    } catch {

      payload = { state: 'error', message: 'Lecture statut TPE impossible' }

    }



    if (payload) {

      onStatus(payload)

      if (payload.state === 'approved') {

        return {

          ok: true,

          method: 'CARD',

          transactionId: payload.transactionId,

          cardBrand: payload.cardBrand,

          provider: mapProvider(payload.provider),

          message: payload.message,

        }

      }

      if (payload.state === 'declined') {

        return { ok: false, reason: 'declined', message: payload.message ?? 'Carte refusée' }

      }

      if (payload.state === 'cancelled') {

        return { ok: false, reason: 'cancelled', message: payload.message ?? 'Annulé sur le TPE' }

      }

      if (payload.state === 'error') {

        return { ok: false, reason: 'error', message: payload.message ?? 'Erreur TPE' }

      }

    }



    await sleep(POLL_INTERVAL_MS, signal)

  }



  try {

    bridge.cancelPayment?.(sessionId)

  } catch {

    /* ignore */

  }

  return { ok: false, reason: 'timeout', message: 'Délai TPE dépassé' }

}



export function terminalResultToPaymentMeta(

  amountCents: number,

  reference: string,

  result: Extract<TerminalPaymentResult, { ok: true }>,

): PaymentMeta {

  return {

    provider: result.provider ?? 'MANUAL',

    captureMode: 'native',

    amountCents,

    transactionId: result.transactionId,

    cardBrand: result.cardBrand,

    terminalReference: reference,

    capturedAt: new Date().toISOString(),

  }

}



export function cancelNativeTerminalSession(sessionId: string | null) {

  if (!sessionId || !window.PaymentTerminal?.cancelPayment) return

  try {

    window.PaymentTerminal.cancelPayment(sessionId)

  } catch {

    /* ignore */

  }

}


