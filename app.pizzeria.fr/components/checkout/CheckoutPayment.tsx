'use client'

import { useEffect, useState, useRef } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { Loader2, Lock, Store } from 'lucide-react'
import { formatPriceEUR } from '@/lib/menu-types'
import type { CartLine, CheckoutDraft } from '@/lib/cart-types'
import { customerFullName } from '@/lib/cart-types'

async function completeOnlineCheckout(
  draftId: string,
  paymentIntentId: string | undefined,
  maxAttempts = 8
): Promise<{ token: string; orderNumber: number } | null> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const res = await fetch('/api/public/payments/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ draftId, paymentIntentId }),
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

function PaymentForm({
  total,
  draftId,
  paymentIntentId,
  onSuccess,
  onError,
}: {
  total: number
  draftId: string
  paymentIntentId: string | null
  onSuccess: (token: string, orderNumber: number) => void
  onError: (message: string) => void
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [paying, setPaying] = useState(false)
  const [payError, setPayError] = useState<string | null>(null)

  function reportError(message: string) {
    setPayError(message)
    onError(message)
  }

  async function handlePay(e: React.FormEvent) {
    e.preventDefault()
    if (!stripe || !elements) {
      reportError('Stripe pas encore prêt — patientez une seconde et réessayez.')
      return
    }

    setPaying(true)
    setPayError(null)
    try {
      const { error: submitError } = await elements.submit()
      if (submitError) {
        reportError(submitError.message ?? 'Vérifiez les informations de carte.')
        return
      }

      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        redirect: 'if_required',
        confirmParams: {
          return_url: `${window.location.origin}/commander`,
        },
      })

      if (error) {
        reportError(error.message ?? 'Paiement refusé')
        return
      }

      const piId = paymentIntent?.id ?? paymentIntentId ?? undefined
      const status = paymentIntent?.status

      if (status === 'succeeded' || status === 'processing') {
        const result = await completeOnlineCheckout(draftId, piId)
        if (!result) {
          reportError(
            status === 'processing'
              ? 'Paiement en cours de validation — réessayez dans quelques secondes.'
              : 'Paiement accepté — confirmation en cours, réessayez dans un instant.',
          )
          return
        }
        onSuccess(result.token, result.orderNumber)
        return
      }

      reportError(`Paiement non finalisé (${status ?? 'statut inconnu'}). Réessayez.`)
    } catch (err) {
      reportError(err instanceof Error ? err.message : 'Erreur paiement')
    } finally {
      setPaying(false)
    }
  }

  return (
    <form onSubmit={handlePay} className="space-y-4">
      {payError && (
        <p className="rounded-xl border border-red-500/40 bg-red-950/30 px-3 py-2 text-sm text-red-200">
          {payError}
        </p>
      )}
      <div className="rounded-xl border border-white/10 bg-charcoal/80 p-4">
        <PaymentElement options={{ layout: 'tabs' }} />
      </div>
      <button
        type="submit"
        disabled={!stripe || paying}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-tomato py-3.5 text-sm font-bold text-white hover:bg-tomato-light disabled:opacity-50"
      >
        {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
        {paying ? 'Paiement en cours…' : `Payer ${formatPriceEUR(total)}`}
      </button>
      <p className="text-center text-xs text-cream/35">Paiement sécurisé par Stripe</p>
    </form>
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
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [draftId, setDraftId] = useState<string | null>(null)
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null)
  const [stripePromise, setStripePromise] = useState<ReturnType<typeof loadStripe> | null>(null)
  const prepareKey = useRef<string | null>(null)

  useEffect(() => {
    if (paymentMode === 'counter') {
      setLoading(false)
      return
    }

    const abort = new AbortController()
    let cancelled = false
    const fingerprint = JSON.stringify({ lines, checkout, subtotal, deliveryFee, total })

    if (prepareKey.current === fingerprint && draftId && clientSecret) {
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

        const pk =
          data.publishableKey || process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ''
        if (!pk || !data.clientSecret || !data.draftId) {
          throw new Error('Stripe non configuré (clé publique ou client secret)')
        }

        prepareKey.current = fingerprint
        setDraftId(data.draftId)
        setPaymentIntentId(data.paymentIntentId ?? null)
        setStripePromise(loadStripe(pk))
        setClientSecret(data.clientSecret)
      } catch (err) {
        if (cancelled || abort.signal.aborted) return
        const message = err instanceof Error ? err.message : 'Erreur initialisation paiement'
        setInitError(message)
        onError(message)
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

  if (!clientSecret || !stripePromise || !draftId) {
    return (
      <p className="text-sm text-red-400">Paiement indisponible. Vérifiez la configuration Stripe.</p>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-cream/55">
        Commande pour <strong className="text-cream">{customerFullName(checkout)}</strong>
      </p>
      <Elements
        stripe={stripePromise}
        options={{
          clientSecret,
          appearance: {
            theme: 'night',
            variables: {
              colorPrimary: '#C23B22',
              colorBackground: '#1A1412',
              colorText: '#F5E6D3',
              borderRadius: '12px',
            },
          },
        }}
      >
        <PaymentForm
          total={total}
          draftId={draftId}
          paymentIntentId={paymentIntentId}
          onSuccess={onSuccess}
          onError={onError}
        />
      </Elements>
    </div>
  )
}
