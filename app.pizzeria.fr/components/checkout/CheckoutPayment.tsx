'use client'

import { useEffect, useState, useRef } from 'react'
import { Loader2, Lock, Store } from 'lucide-react'
import { formatPriceEUR } from '@/lib/menu-types'
import type { CartLine, CheckoutDraft } from '@/lib/cart-types'
import { customerFullName } from '@/lib/cart-types'

const SUMUP_SDK_URL = 'https://gateway.sumup.com/gateway/ecom/card/v2/sdk.js'

declare global {
  interface Window {
    SumUpCard?: {
      mount: (options: {
        id: string
        checkoutId: string
        locale?: string
        onResponse: (type: string, body: unknown) => void
      }) => void
    }
  }
}

let sumupSdkPromise: Promise<void> | null = null
function loadSumupSdk(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('SDK indisponible côté serveur'))
  if (window.SumUpCard) return Promise.resolve()
  if (sumupSdkPromise) return sumupSdkPromise

  sumupSdkPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SUMUP_SDK_URL}"]`)
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('SDK de paiement introuvable')))
      return
    }
    const script = document.createElement('script')
    script.src = SUMUP_SDK_URL
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('SDK de paiement introuvable'))
    document.body.appendChild(script)
  })
  return sumupSdkPromise
}

async function completeOnlineCheckout(
  draftId: string,
  checkoutId: string | undefined,
  maxAttempts = 8
): Promise<{ token: string; orderNumber: number } | null> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const res = await fetch('/api/public/payments/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ draftId, checkoutId }),
    })
    const data = await res.json()
    if (res.ok && data.success && data.token) {
      return { token: data.token, orderNumber: data.orderNumber }
    }
    if (res.status === 402 || res.status === 202) {
      await new Promise((r) => setTimeout(r, 1200))
      continue
    }
    throw new Error(data.error ?? 'Confirmation impossible')
  }
  return null
}

type Props = {
  lines: CartLine[]
  checkout: CheckoutDraft
  subtotal: number
  deliveryFee: number
  total: number
  paymentMode: 'online' | 'counter'
  onSuccess: (token: string, orderNumber: number) => void
  onError: (message: string) => void
}

/** Formulaire carte SumUp (widget embarqué — les numéros de carte ne passent pas par notre serveur). */
function SumupCardForm({
  total,
  draftId,
  checkoutId,
  onSuccess,
}: {
  total: number
  draftId: string
  checkoutId: string
  onSuccess: (token: string, orderNumber: number) => void
}) {
  const [paying, setPaying] = useState(false)
  const [payError, setPayError] = useState<string | null>(null)
  const [mounting, setMounting] = useState(true)
  const containerId = useRef(`sumup-card-${draftId}`).current

  function reportError(message: string) {
    setPayError(message)
  }

  useEffect(() => {
    let cancelled = false
    setMounting(true)
    setPayError(null)

    loadSumupSdk()
      .then(() => {
        if (cancelled) return
        setMounting(false)
        window.SumUpCard?.mount({
          id: containerId,
          checkoutId,
          locale: 'fr-FR',
          onResponse: (type, body) => {
            if (cancelled) return

            if (type === 'sent') {
              setPaying(true)
              setPayError(null)
              return
            }
            if (type === 'auth-screen') {
              // 3DS affiché dans le widget lui-même — rien à faire côté appli.
              return
            }
            if (type === 'invalid') {
              setPaying(false)
              reportError('Vérifiez les informations de carte.')
              return
            }
            if (type === 'success') {
              void (async () => {
                try {
                  const result = await completeOnlineCheckout(draftId, checkoutId)
                  if (!result) {
                    setPaying(false)
                    reportError('Paiement accepté — confirmation en cours, réessayez dans un instant.')
                    return
                  }
                  onSuccess(result.token, result.orderNumber)
                } catch (err) {
                  setPaying(false)
                  reportError(err instanceof Error ? err.message : 'Erreur confirmation paiement')
                }
              })()
              return
            }
            // 'error' | 'fail'
            setPaying(false)
            const hasMessage =
              body !== null && typeof body === 'object' && 'message' in body
            const message = hasMessage
              ? String((body as { message: unknown }).message)
              : 'Paiement refusé'
            reportError(message)
          },
        })
      })
      .catch((err) => {
        if (cancelled) return
        setMounting(false)
        reportError(err instanceof Error ? err.message : 'Widget de paiement indisponible')
      })

    return () => {
      cancelled = true
    }
  }, [checkoutId, draftId, containerId])

  return (
    <div className="space-y-4">
      {payError && (
        <p className="rounded-xl border border-red-500/40 bg-red-950/30 px-3 py-2 text-sm text-red-200">
          {payError}
        </p>
      )}
      {mounting && (
        <div className="flex items-center justify-center gap-2 py-8 text-cream/50">
          <Loader2 className="h-5 w-5 animate-spin" />
          Chargement du paiement…
        </div>
      )}
      <div
        id={containerId}
        className={mounting ? 'hidden' : 'rounded-xl border border-white/10 bg-charcoal/80 p-4'}
      />
      {!mounting && (
        <p className="flex items-center justify-center gap-2 text-center text-sm font-semibold text-cream">
          {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
          {paying ? 'Paiement en cours…' : `À payer : ${formatPriceEUR(total)}`}
        </p>
      )}
      <p className="text-center text-xs text-cream/35">Paiement sécurisé par carte bancaire</p>
    </div>
  )
}

function CounterPaymentForm({
  lines,
  checkout,
  subtotal,
  deliveryFee,
  total,
  onSuccess,
  onError,
}: Props) {
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit() {
    setSubmitting(true)
    try {
      const res = await fetch('/api/public/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lines,
          checkout: { ...checkout, payAtCounter: true },
          subtotal,
          deliveryFee,
          total,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error ?? 'Impossible de créer la commande')
      }
      onSuccess(data.token, data.orderNumber)
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Erreur commande')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
        Votre commande sera envoyée en cuisine après paiement au comptoir. Présentez-vous à la caisse avec
        votre numéro de commande.
      </p>
      <button
        type="button"
        disabled={submitting}
        onClick={() => void handleSubmit()}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 py-3.5 text-sm font-bold text-charcoal hover:bg-amber-400 disabled:opacity-50"
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Store className="h-4 w-4" />}
        {submitting ? 'Envoi…' : `Commander — ${formatPriceEUR(total)} à payer au comptoir`}
      </button>
    </div>
  )
}

export function CheckoutPayment({
  lines,
  checkout,
  subtotal,
  deliveryFee,
  total,
  paymentMode,
  onSuccess,
  onError,
}: Props) {
  const [loading, setLoading] = useState(true)
  const [initError, setInitError] = useState<string | null>(null)
  const [draftId, setDraftId] = useState<string | null>(null)
  const [checkoutId, setCheckoutId] = useState<string | null>(null)
  const prepareKey = useRef<string | null>(null)

  useEffect(() => {
    if (paymentMode === 'counter') {
      setLoading(false)
      return
    }

    const abort = new AbortController()
    let cancelled = false
    const fingerprint = JSON.stringify({ lines, checkout, subtotal, deliveryFee, total })

    if (prepareKey.current === fingerprint && draftId && checkoutId) {
      setLoading(false)
      return
    }

    async function init() {
      setInitError(null)
      setLoading(true)
      try {
        const res = await fetch('/api/public/payments/prepare', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lines, checkout, subtotal, deliveryFee, total }),
          signal: abort.signal,
        })
        const data = await res.json()
        if (!res.ok || !data.success) {
          throw new Error(data.error ?? "Impossible d'initialiser le paiement")
        }

        if (cancelled) return

        if (!data.draftId || !data.checkoutId) {
          throw new Error('Paiement en ligne non configuré')
        }

        prepareKey.current = fingerprint
        setDraftId(data.draftId)
        setCheckoutId(data.checkoutId)
      } catch (err) {
        if (cancelled || abort.signal.aborted) return
        // Affiché une seule fois ici — ne pas remonter au parent (évite le triple « SumUp non configuré »).
        const raw = err instanceof Error ? err.message : 'Erreur initialisation paiement'
        const message = /sumup|non configuré|paiement en ligne/i.test(raw)
          ? 'Paiement en ligne indisponible pour le moment. Choisissez « Comptoir » pour commander.'
          : raw
        setInitError(message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void init()
    return () => {
      cancelled = true
      abort.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentMode, lines, checkout, subtotal, deliveryFee, total])

  if (paymentMode === 'counter') {
    return (
      <CounterPaymentForm
        lines={lines}
        checkout={checkout}
        subtotal={subtotal}
        deliveryFee={deliveryFee}
        total={total}
        paymentMode={paymentMode}
        onSuccess={onSuccess}
        onError={onError}
      />
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-cream/50">
        <Loader2 className="h-5 w-5 animate-spin" />
        Préparation du paiement…
      </div>
    )
  }

  if (initError) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-950/20 px-4 py-3 text-sm text-red-200">
        {initError}
      </div>
    )
  }

  if (!draftId || !checkoutId) {
    return (
      <p className="text-sm text-red-400">Paiement indisponible. Vérifiez la configuration du paiement en ligne.</p>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-cream/55">
        Commande pour <strong className="text-cream">{customerFullName(checkout)}</strong>
      </p>
      <SumupCardForm
        total={total}
        draftId={draftId}
        checkoutId={checkoutId}
        onSuccess={onSuccess}
      />
    </div>
  )
}
