'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, Clock, Loader2, Phone, Package, ChefHat, Truck } from 'lucide-react'
import { PIZZERIA } from '@/lib/pizzeria-content'
import {
  ORDER_STATUS_LABEL,
  ORDER_TRACKING_STEPS_DELIVERY,
  ORDER_TRACKING_STEPS_PICKUP,
  orderTrackingStepIndex,
} from '@/lib/ops-orders'
import { formatEUR } from '@/lib/money'
import { cn } from '@/lib/cn'
import { getTrackSocket, joinTrackRoom, resetTrackSocket } from '@/lib/track-socket'

type Props = {
  token: string
  variant?: 'page' | 'sheet'
  orderNumber?: string | number | null
  onNewOrder?: () => void
}

type TrackedOrder = {
  orderNumber: number
  status: string
  paymentStatus: string
  total: number
  createdAt: string
  customerName: string | null
  type: string
  driverLat?: number | null
  driverLng?: number | null
  driverLocationAt?: string | null
  deliveryHandoverCode?: string | null
  deliveryRating?: number | null
}

const STEP_ICONS: Record<string, typeof Clock> = {
  PENDING_PAYMENT: Clock,
  CONFIRMED: CheckCircle2,
  PREPARING: ChefHat,
  READY: Package,
  COMPLETED: Truck,
  OUT_FOR_DELIVERY: Truck,
  DELIVERED: CheckCircle2,
}

function trackingSteps(isDelivery: boolean) {
  const base = isDelivery ? ORDER_TRACKING_STEPS_DELIVERY : ORDER_TRACKING_STEPS_PICKUP
  return base.map((step) => ({
    ...step,
    icon: STEP_ICONS[step.key] ?? Clock,
  }))
}

export function SuiviConfirmation({
  token,
  variant = 'page',
  orderNumber: orderNumberProp,
  onNewOrder,
}: Props) {
  const searchParams = useSearchParams()
  const orderNumberParam = orderNumberProp ?? searchParams.get('n')
  const compact = variant === 'sheet'
  const [order, setOrder] = useState<TrackedOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const fetchOrder = useCallback(async () => {
    try {
      const res = await fetch(`/api/public/orders/track-token/${encodeURIComponent(token)}`)
      if (res.status === 404) {
        setNotFound(true)
        setOrder(null)
        return
      }
      const data = await res.json()
      if (data.success && data.order) {
        setOrder(data.order)
        setNotFound(false)
      }
    } catch {
      /* retry au prochain poll */
    } finally {
      setLoading(false)
    }
  }, [token])

  const isDelivery = order?.type === 'DELIVERY'
  const isDeliveryDone = Boolean(isDelivery && order?.status === 'DELIVERED')

  useEffect(() => {
    if (isDeliveryDone) return
    void fetchOrder()
    const id = setInterval(() => void fetchOrder(), 8000)
    return () => clearInterval(id)
  }, [fetchOrder, isDeliveryDone])

  useEffect(() => {
    const socket = getTrackSocket()
    joinTrackRoom(socket, token)

    const onUpdate = (payload: Partial<TrackedOrder>) => {
      setOrder((prev) => (prev ? { ...prev, ...payload } : prev))
    }

    socket.on('order:trackUpdate', onUpdate)
    return () => {
      socket.off('order:trackUpdate', onUpdate)
      resetTrackSocket()
    }
  }, [token])

  const steps = trackingSteps(isDelivery)
  const currentStep = order ? orderTrackingStepIndex(order.status, isDelivery) : 0
  const displayNumber = order?.orderNumber ?? orderNumberParam

  if (loading) {
    return (
      <div className={cn('flex flex-col items-center', compact ? 'py-6' : 'mx-auto max-w-lg py-8')}>
        <Loader2 className={cn('animate-spin text-tomato-light', compact ? 'h-7 w-7' : 'h-10 w-10')} />
        <p className={cn('mt-3 text-cream/50', compact ? 'text-xs' : 'mt-4')}>Chargement…</p>
      </div>
    )
  }

  if (notFound) {
    return (
      <div className={cn('text-center', !compact && 'mx-auto max-w-lg')}>
        <p className={cn('font-semibold text-cream', compact ? 'text-sm' : 'font-display text-2xl font-bold')}>
          Commande introuvable
        </p>
        <p className="mt-2 text-xs text-cream/55">Vérifiez le lien reçu.</p>
        {!compact && (
          <Link href="/menu" className="mt-6 inline-block text-tomato-light hover:underline">
            Retour à la carte →
          </Link>
        )}
      </div>
    )
  }

  return (
    <div className={cn(!compact && 'mx-auto max-w-lg')}>
      {isDeliveryDone ? (
        <DeliveredThankYou
          orderNumber={displayNumber}
          token={token}
          hasRating={Boolean(order?.deliveryRating)}
          onRated={() => void fetchOrder()}
          compact={compact}
          onNewOrder={onNewOrder}
        />
      ) : (
        <>
          <div className={cn('text-center', compact ? 'pb-2' : '')}>
            <CheckCircle2
              className={cn('mx-auto text-emerald-400', compact ? 'h-9 w-9' : 'h-14 w-14')}
            />
            {!compact && (
              <h1 className="mt-4 font-display text-2xl font-bold text-cream">
                {order?.status === 'PENDING_PAYMENT' ? 'Commande enregistrée' : 'Suivi de commande'}
              </h1>
            )}
            {displayNumber && (
              <p className={cn('font-semibold text-tomato-light', compact ? 'mt-2 text-base' : 'mt-2 text-lg')}>
                N° {displayNumber}
              </p>
            )}
            {order && (
              <p className={cn('text-cream/50', compact ? 'mt-1 text-[11px]' : 'mt-2 text-sm')}>
                {ORDER_STATUS_LABEL[order.status] ?? order.status}
                {order.paymentStatus === 'PAID'
                  ? ' · Payée'
                  : order.paymentStatus === 'UNPAID'
                    ? ' · En attente'
                    : ''}
              </p>
            )}
          </div>

          {order && (
            <ol className={cn(compact ? 'mt-4 space-y-0' : 'mt-10 space-y-0')}>
              {steps.map((step, i) => {
                const done = i <= currentStep && order.status !== 'CANCELLED'
                const active = i === currentStep
                const Icon = step.icon
                return (
                  <li
                    key={step.key}
                    className={cn('relative flex gap-3', compact ? 'pb-4 last:pb-0' : 'gap-4 pb-8 last:pb-0')}
                  >
                    {i < steps.length - 1 && (
                      <span
                        className={cn(
                          'absolute left-[11px] top-6 h-[calc(100%-6px)] w-0.5',
                          done ? 'bg-emerald-500/60' : 'bg-white/10',
                        )}
                      />
                    )}
                    <div
                      className={cn(
                        'relative z-10 flex shrink-0 items-center justify-center rounded-full border',
                        compact ? 'h-6 w-6' : 'h-8 w-8',
                        done
                          ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-300'
                          : 'border-white/15 bg-charcoal text-cream/30',
                        active && 'ring-2 ring-tomato/40',
                      )}
                    >
                      <Icon className={compact ? 'h-3 w-3' : 'h-4 w-4'} />
                    </div>
                    <div className="min-w-0 pt-0.5">
                      <p
                        className={cn(
                          'font-medium',
                          compact ? 'text-xs' : 'text-sm',
                          done ? 'text-cream' : 'text-cream/40',
                        )}
                      >
                        {step.label}
                      </p>
                      {active && (
                        <p className="mt-0.5 text-[10px] text-cream/45">
                          {ORDER_STATUS_LABEL[order.status] ?? 'En cours…'}
                        </p>
                      )}
                    </div>
                  </li>
                )
              })}
            </ol>
          )}

          {order?.type === 'DELIVERY' &&
            order.deliveryHandoverCode &&
            !['DELIVERED', 'CANCELLED', 'COMPLETED'].includes(order.status) && (
              <div
                className={cn(
                  'rounded-xl border border-tomato/35 bg-tomato/10 text-center',
                  compact ? 'mt-3 p-3' : 'mt-6 rounded-2xl p-5',
                )}
              >
                <p className={cn('font-medium text-cream', compact ? 'text-xs' : 'text-sm')}>
                  Code livreur
                </p>
                <p
                  className={cn(
                    'font-mono font-bold tracking-[0.35em] text-tomato-light',
                    compact ? 'mt-1 text-2xl' : 'mt-2 text-4xl',
                  )}
                >
                  {order.deliveryHandoverCode}
                </p>
              </div>
            )}

          {order?.driverLat != null && order.driverLng != null && (
            <div className={cn('rounded-xl border border-white/10 bg-charcoal/60', compact ? 'mt-3 p-3' : 'mt-6 p-4')}>
              <a
                href={`https://www.openstreetmap.org/?mlat=${order.driverLat}&mlon=${order.driverLng}#map=17/${order.driverLat}/${order.driverLng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-violet-300 underline"
              >
                Voir le livreur sur la carte
              </a>
            </div>
          )}

          {order && (
            <p className={cn('text-center text-cream/45', compact ? 'mt-3 text-xs' : 'mt-6 text-sm')}>
              Total {formatEUR(order.total)}
            </p>
          )}

          {!compact && !isDeliveryDone && (
            <>
              <p className="mt-6 text-center text-xs text-cream/35">
                Réf. <code className="rounded bg-charcoal px-2 py-1 text-cream/60">{token}</code>
              </p>
              <a
                href={PIZZERIA.phoneHref}
                className="mt-6 flex items-center justify-center gap-2 rounded-full border border-cream/20 px-5 py-2.5 text-sm text-cream hover:bg-white/5"
              >
                <Phone className="h-4 w-4" />
                {PIZZERIA.phone}
              </a>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
                <Link
                  href="/menu"
                  className="rounded-full bg-tomato px-6 py-2.5 text-center text-sm font-bold text-white hover:bg-tomato-light"
                >
                  Nouvelle commande
                </Link>
                <Link href="/" className="rounded-full border border-white/15 px-6 py-2.5 text-center text-sm text-cream/80 hover:bg-white/5">
                  Accueil
                </Link>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

function DeliveredThankYou({
  orderNumber,
  token,
  hasRating,
  onRated,
  compact,
  onNewOrder,
}: {
  orderNumber: string | number | null | undefined
  token: string
  hasRating: boolean
  onRated: () => void
  compact?: boolean
  onNewOrder?: () => void
}) {
  const [redirectIn, setRedirectIn] = useState<number | null>(null)
  const [feedbackDone, setFeedbackDone] = useState(hasRating)

  useEffect(() => {
    if (!feedbackDone || compact) return
    setRedirectIn(8)
  }, [feedbackDone, compact])

  useEffect(() => {
    if (redirectIn == null || redirectIn <= 0 || compact) return
    const t = window.setTimeout(() => setRedirectIn((n) => (n != null ? n - 1 : null)), 1000)
    if (redirectIn === 0) {
      window.location.href = '/'
    }
    return () => window.clearTimeout(t)
  }, [redirectIn, compact])

  return (
    <div className={compact ? 'py-2' : 'py-6 text-center'}>
      <div
        className={cn(
          'border border-emerald-500/30 bg-gradient-to-b from-emerald-950/40 to-transparent text-center',
          compact ? 'rounded-xl px-4 py-5' : 'rounded-3xl px-6 py-10',
        )}
      >
        <CheckCircle2 className={cn('mx-auto text-emerald-400', compact ? 'h-10 w-10' : 'h-16 w-16')} />
        <p className={cn('font-display font-bold text-cream', compact ? 'mt-3 text-lg' : 'mt-5 text-3xl')}>
          Merci !
        </p>
        {orderNumber && (
          <p className={cn('font-semibold text-tomato-light', compact ? 'mt-1 text-sm' : 'mt-2 text-lg')}>
            Commande n° {orderNumber}
          </p>
        )}
        <p className={cn('text-cream/60', compact ? 'mt-2 text-xs' : 'mx-auto mt-4 max-w-sm text-sm')}>
          Livrée — à bientôt chez {PIZZERIA.name}.
        </p>
      </div>

      {!feedbackDone && (
        <div className={compact ? 'mt-4' : 'mt-8 text-left'}>
          <DeliveryFeedbackForm
            token={token}
            compact={compact}
            onDone={() => {
              setFeedbackDone(true)
              onRated()
            }}
          />
          <button
            type="button"
            onClick={() => setFeedbackDone(true)}
            className="mt-2 w-full text-center text-[10px] text-cream/40 underline"
          >
            Passer l&apos;avis
          </button>
        </div>
      )}

      {feedbackDone && !compact && (
        <div className="mt-8 space-y-4">
          {redirectIn != null && redirectIn > 0 && (
            <p className="text-xs text-cream/40">Retour accueil dans {redirectIn} s…</p>
          )}
          <Link
            href="/"
            className="inline-block rounded-full bg-tomato px-8 py-3 text-sm font-bold text-white hover:bg-tomato-light"
          >
            Retour à l&apos;accueil
          </Link>
        </div>
      )}

      {feedbackDone && compact && onNewOrder && (
        <button
          type="button"
          onClick={onNewOrder}
          className="mt-4 w-full rounded-full bg-tomato py-2.5 text-xs font-bold text-white"
        >
          Nouvelle commande
        </button>
      )}
    </div>
  )
}

function DeliveryFeedbackForm({
  token,
  onDone,
  compact,
}: {
  token: string
  onDone: () => void
  compact?: boolean
}) {
  const [rating, setRating] = useState(5)
  const [feedback, setFeedback] = useState('')
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)

  async function submit() {
    setSending(true)
    try {
      const res = await fetch(`/api/public/orders/track-token/${encodeURIComponent(token)}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, feedback }),
      })
      if (!res.ok) throw new Error('Envoi impossible')
      setDone(true)
      onDone()
    } catch {
      /* ignore */
    } finally {
      setSending(false)
    }
  }

  if (done) {
    return <p className="mt-3 text-center text-xs text-emerald-300">Merci pour votre avis !</p>
  }

  return (
    <div className={cn('rounded-xl border border-white/10 bg-charcoal/80', compact ? 'p-3' : 'mt-6 p-4')}>
      <p className={cn('font-medium text-cream', compact ? 'text-xs' : '')}>Note livraison</p>
      <div className="mt-2 flex gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
            className={cn(
              'rounded-lg border font-bold',
              compact ? 'h-7 w-7 text-xs' : 'h-9 w-9 text-sm',
              rating >= n ? 'border-amber-400 bg-amber-500/20 text-amber-200' : 'border-white/15 text-cream/40',
            )}
          >
            {n}
          </button>
        ))}
      </div>
      <textarea
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        rows={2}
        placeholder="Commentaire (optionnel)"
        className="mt-2 w-full rounded-lg border border-white/10 bg-charcoal px-2.5 py-2 text-xs text-cream"
      />
      <button
        type="button"
        disabled={sending}
        onClick={() => void submit()}
        className="mt-2 w-full rounded-lg bg-tomato py-2 text-xs font-bold text-white disabled:opacity-50"
      >
        Envoyer
      </button>
    </div>
  )
}
