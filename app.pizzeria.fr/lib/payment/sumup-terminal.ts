/**
 * Paiement carte via lecteur SumUp Solo (Cloud API, piloté serveur).
 * Pas de pont Android : le lecteur communique en Wi-Fi/LTE avec SumUp,
 * le serveur pilote le checkout et on poll le statut (pas de webhook signé côté SumUp).
 */

import { staffFetch } from '@/lib/staff-api'
import type { TerminalPaymentResult, TerminalStatusPayload } from '@/lib/payment/payment-terminal'

const SUMUP_TIMEOUT_MS = 120_000
const SUMUP_POLL_INTERVAL_MS = 1500

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

type SumupReaderStatusResponse =
  | { configured: false }
  | {
      configured: true
      reader: { id: string; name: string }
      status: { status: string; state?: string; battery_level?: number }
    }

export async function isSumupReaderAvailable(token: string): Promise<boolean> {
  try {
    const res = await staffFetch<SumupReaderStatusResponse>('/payments/sumup/reader/status', {
      token,
      // Check rapide qui gate un bouton de paiement — pas la peine d'attendre
      // jusqu'à 60s (5 tentatives × 12s) comme le reste de l'API : un seul essai
      // court, sinon on bascule vite en mode manuel plutôt que de bloquer la caisse.
      timeoutMs: 3000,
      retries: 1,
    })
    return res.configured && res.status.status === 'ONLINE'
  } catch {
    return false
  }
}

type SumupCheckoutResponse = { checkoutId: string; readerId: string }
type SumupCheckoutStatusResponse = {
  checkout_id: string
  status: 'pending' | 'successful' | 'failed' | 'cancelled' | string
  transaction_id?: string
}

async function cancelSumupCheckout(checkoutId: string, token: string): Promise<void> {
  try {
    await staffFetch(`/payments/sumup/checkout/${checkoutId}/cancel`, { method: 'POST', token })
  } catch {
    /* best-effort */
  }
}

export async function runSumupReaderPayment(
  amountCents: number,
  reference: string,
  token: string,
  onStatus: (status: TerminalStatusPayload) => void,
  signal?: AbortSignal,
): Promise<TerminalPaymentResult> {
  onStatus({ state: 'connecting', message: 'Envoi au lecteur SumUp…', provider: 'SUMUP' })

  let checkoutId: string
  try {
    const res = await staffFetch<SumupCheckoutResponse>('/payments/sumup/checkout', {
      method: 'POST',
      token,
      body: JSON.stringify({ amountCents, reference }),
    })
    checkoutId = res.checkoutId
  } catch (err) {
    return {
      ok: false,
      reason: 'unavailable',
      message: err instanceof Error ? err.message : 'Lecteur SumUp indisponible',
    }
  }

  onStatus({
    state: 'awaiting_card',
    message: 'Présentez la carte sur le lecteur SumUp',
    provider: 'SUMUP',
  })

  const deadline = Date.now() + SUMUP_TIMEOUT_MS

  while (Date.now() < deadline) {
    try {
      await sleep(SUMUP_POLL_INTERVAL_MS, signal)
    } catch {
      await cancelSumupCheckout(checkoutId, token)
      return { ok: false, reason: 'cancelled', message: 'Annulé par la caisse' }
    }

    if (signal?.aborted) {
      await cancelSumupCheckout(checkoutId, token)
      return { ok: false, reason: 'cancelled', message: 'Annulé par la caisse' }
    }

    let status: SumupCheckoutStatusResponse
    try {
      status = await staffFetch<SumupCheckoutStatusResponse>(
        `/payments/sumup/checkout/${checkoutId}`,
        { token },
      )
    } catch {
      continue
    }

    if (status.status === 'successful') {
      onStatus({ state: 'approved', message: 'Paiement accepté', provider: 'SUMUP' })
      return {
        ok: true,
        method: 'CARD',
        provider: 'SUMUP',
        transactionId: status.transaction_id,
        message: 'Paiement accepté',
      }
    }
    if (status.status === 'failed') {
      return { ok: false, reason: 'declined', message: 'Carte refusée' }
    }
    if (status.status === 'cancelled') {
      return { ok: false, reason: 'cancelled', message: 'Annulé sur le lecteur' }
    }

    onStatus({ state: 'processing', message: 'En attente du lecteur…', provider: 'SUMUP' })
  }

  await cancelSumupCheckout(checkoutId, token)
  return { ok: false, reason: 'timeout', message: 'Délai lecteur SumUp dépassé' }
}
