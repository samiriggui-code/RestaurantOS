'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertCircle,
  Banknote,
  CheckCircle2,
  CreditCard,
  Loader2,
  RefreshCw,
  Smartphone,
  X,
} from 'lucide-react'
import { formatEUR } from '@/lib/money'
import { cn } from '@/lib/cn'
import {
  getPaymentTerminalMode,
  nativeProviderLabel,
  runNativeTerminalPayment,
  terminalResultToPaymentMeta,
  terminalStateLabel,
  type TerminalPaymentState,
  type TerminalStatusPayload,
} from '@/lib/payment/payment-terminal'
import { isSumupReaderAvailable, runSumupReaderPayment } from '@/lib/payment/sumup-terminal'
import { buildPaymentMeta, manualCardMeta, type PaymentMeta } from '@/lib/payment/payment-meta'
import { useAppFeedback } from '@/components/feedback/AppFeedbackProvider'

export type PosPaymentLine = { id: string; label: string; detail?: string; amountCents?: number }

type SheetStep = 'choose' | 'cash_confirm' | 'terminal' | 'terminal_result'

type Props = {
  open: boolean
  title: string
  subtitle?: string
  amountCents: number
  reference: string
  /** Requis pour le paiement via lecteur SumUp Solo (Cloud API, appels authentifiés). */
  token?: string
  lines?: PosPaymentLine[]
  busy?: boolean
  onClose: () => void
  /** Appelé après paiement validé (espèces ou TPE OK) — créer commande / encaisser. */
  onPaid: (method: 'CASH' | 'CARD', meta?: PaymentMeta) => Promise<void>
}

export function PosPaymentSheet({
  open,
  title,
  subtitle,
  amountCents,
  reference,
  token,
  lines = [],
  busy = false,
  onClose,
  onPaid,
}: Props) {
  const terminalMode = getPaymentTerminalMode()
  const [manualFallback, setManualFallback] = useState(false)
  const [sumupCheck, setSumupCheck] = useState<'checking' | 'available' | 'unavailable'>('checking')
  const cardProvider: 'native' | 'sumup' | 'manual' | 'checking' =
    terminalMode === 'native'
      ? 'native'
      : sumupCheck === 'checking'
        ? 'checking'
        : sumupCheck === 'available'
          ? 'sumup'
          : 'manual'
  const effectiveManual = cardProvider === 'manual' || manualFallback
  const cardPaymentPending = cardProvider === 'checking'
  const { notifyError } = useAppFeedback()
  const [step, setStep] = useState<SheetStep>('choose')
  const [terminalState, setTerminalState] = useState<TerminalPaymentState>('idle')
  const [terminalMessage, setTerminalMessage] = useState<string | null>(null)
  const [failureReason, setFailureReason] = useState<string | null>(null)
  const [manualTpeRef, setManualTpeRef] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!open || terminalMode === 'native' || !token) {
      setSumupCheck('unavailable')
      return
    }
    let cancelled = false
    setSumupCheck('checking')
    void isSumupReaderAvailable(token).then((available) => {
      if (!cancelled) setSumupCheck(available ? 'available' : 'unavailable')
    })
    return () => {
      cancelled = true
    }
  }, [open, terminalMode, token])

  const reset = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setStep('choose')
    setTerminalState('idle')
    setTerminalMessage(null)
    setFailureReason(null)
    setManualTpeRef('')
    setManualFallback(false)
    setSubmitting(false)
  }, [])

  useEffect(() => {
    if (!open) reset()
  }, [open, reset])

  useEffect(() => () => abortRef.current?.abort(), [])

  const reportFailure = useCallback(
    (reason: string) => {
      setFailureReason(reason)
      notifyError(reason)
    },
    [notifyError],
  )

  async function completeCash() {
    setSubmitting(true)
    try {
      await onPaid('CASH', buildPaymentMeta('CASH', amountCents, { terminalReference: reference }))
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  async function completeCardSuccess(meta?: PaymentMeta) {
    setSubmitting(true)
    try {
      await onPaid(
        'CARD',
        meta ?? manualCardMeta(amountCents, reference),
      )
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  const onTerminalStatus = useCallback((status: TerminalStatusPayload) => {
    setTerminalState(status.state)
    setTerminalMessage(status.message ?? terminalStateLabel(status.state))
  }, [])

  async function startCardPayment() {
    setFailureReason(null)
    setManualTpeRef('')
    setStep('terminal')
    setTerminalState('connecting')
    setTerminalMessage(terminalStateLabel('connecting'))

    if (effectiveManual) {
      setTerminalState('awaiting_card')
      setTerminalMessage('Saisissez le montant sur le TPE, puis indiquez le résultat')
      return
    }

    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac

    const result =
      cardProvider === 'sumup' && token
        ? await runSumupReaderPayment(amountCents, reference, token, onTerminalStatus, ac.signal)
        : await runNativeTerminalPayment(amountCents, reference, onTerminalStatus, ac.signal)

    if (!result.ok && (result.reason === 'unavailable' || result.reason === 'error')) {
      setManualFallback(true)
      setTerminalState('awaiting_card')
      setTerminalMessage(
        `${result.message ?? 'TPE indisponible'} — passez en saisie manuelle sur le terminal`,
      )
      return
    }

    if (result.ok) {
      setTerminalState('approved')
      setTerminalMessage(result.message ?? 'Paiement accepté')
      await completeCardSuccess(terminalResultToPaymentMeta(amountCents, reference, result))
      return
    }

    setStep('terminal_result')
    setTerminalState(
      result.reason === 'declined'
        ? 'declined'
        : result.reason === 'cancelled'
          ? 'cancelled'
          : 'error'
    )
    reportFailure(result.message ?? 'Paiement non abouti')
  }

  function handleClose() {
    if (submitting || busy) return
    abortRef.current?.abort()
    onClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-0 sm:items-center sm:p-4">
      <div className="flex max-h-[92vh] w-full max-w-md flex-col rounded-t-2xl border border-white/10 bg-[#1A1412] shadow-2xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-2 border-b border-white/10 p-5">
          <div>
            <p className="text-xs uppercase tracking-wide text-cream/40">{title}</p>
            {subtitle && <p className="mt-0.5 text-sm text-cream/55">{subtitle}</p>}
            <p className="mt-2 font-display text-3xl font-bold text-tomato-light">
              {formatEUR(amountCents)}
            </p>
          </div>
          <button type="button" onClick={handleClose} disabled={submitting || busy} className="p-1">
            <X className="h-5 w-5 text-cream/50" />
          </button>
        </div>

        {lines.length > 0 && (
          <ul className="max-h-36 space-y-1 overflow-y-auto border-b border-white/10 px-5 py-3 text-sm">
            {lines.map((line) => (
              <li key={line.id} className="flex justify-between gap-2">
                <span className="text-cream/80">
                  {line.label}
                  {line.detail && (
                    <span className="block text-xs text-cream/40">{line.detail}</span>
                  )}
                </span>
                {line.amountCents != null && (
                  <span className="shrink-0 text-cream/60">{formatEUR(line.amountCents)}</span>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="space-y-3 p-5">
          {step === 'choose' && (
            <>
              <p className="text-sm text-cream/50">Choisissez le mode de paiement</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={submitting || busy}
                  onClick={() => setStep('cash_confirm')}
                  className="flex flex-col items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 py-4 text-sm font-semibold text-emerald-100 hover:bg-emerald-500/20 disabled:opacity-50"
                >
                  <Banknote className="h-7 w-7" />
                  Espèces
                </button>
                <button
                  type="button"
                  disabled={submitting || busy || cardPaymentPending}
                  onClick={() => void startCardPayment()}
                  className="flex flex-col items-center gap-2 rounded-xl border border-blue-500/30 bg-blue-500/10 py-4 text-sm font-semibold text-blue-100 hover:bg-blue-500/20 disabled:opacity-50"
                >
                  {cardPaymentPending ? (
                    <Loader2 className="h-7 w-7 animate-spin" />
                  ) : (
                    <CreditCard className="h-7 w-7" />
                  )}
                  Carte / TPE
                </button>
              </div>
              <p className="text-center text-[11px] text-cream/35">
                TPE :{' '}
                {cardPaymentPending
                  ? 'vérification du lecteur…'
                  : effectiveManual
                    ? 'mode manuel — validez après le terminal'
                    : cardProvider === 'sumup'
                      ? 'SumUp Solo connecté'
                      : `${nativeProviderLabel()} connecté`}
              </p>
            </>
          )}

          {step === 'cash_confirm' && (
            <>
              <p className="text-sm text-cream/60">
                Confirmez avoir reçu <strong>{formatEUR(amountCents)}</strong> en espèces.
              </p>
              <button
                type="button"
                disabled={submitting || busy}
                onClick={() => void completeCash()}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 font-semibold text-white disabled:opacity-50"
              >
                {submitting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-5 w-5" />
                )}
                Espèces reçues — envoyer en cuisine
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => setStep('choose')}
                className="w-full rounded-xl border border-white/15 py-2 text-sm text-cream/60"
              >
                Changer de mode
              </button>
            </>
          )}

          {step === 'terminal' && (
            <>
              <TerminalStatusBlock state={terminalState} message={terminalMessage} />

              {effectiveManual ? (
                <div className="space-y-2">
                  <p className="text-xs text-cream/45">
                    Après le TPE physique : saisissez la référence transaction puis confirmez.
                  </p>
                  <input
                    type="text"
                    value={manualTpeRef}
                    onChange={(e) => setManualTpeRef(e.target.value)}
                    placeholder="N° transaction / autorisation TPE"
                    className="w-full rounded-xl border border-white/15 bg-white/[0.03] px-3 py-2 text-sm text-cream outline-none focus:border-tomato/40"
                  />
                  <button
                    type="button"
                    disabled={submitting || busy || !manualTpeRef.trim()}
                    onClick={() =>
                      void completeCardSuccess(manualCardMeta(amountCents, reference, manualTpeRef))
                    }
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 font-semibold text-white"
                  >
                    <CheckCircle2 className="h-5 w-5" />
                    Paiement accepté
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => {
                      setStep('terminal_result')
                      setTerminalState('declined')
                      reportFailure('Paiement refusé sur le TPE')
                    }}
                    className="w-full rounded-xl border border-red-500/30 bg-red-950/30 py-2.5 text-sm font-medium text-red-200"
                  >
                    Refusé / erreur TPE
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => {
                      setStep('terminal_result')
                      setTerminalState('cancelled')
                      reportFailure('Annulé sur le TPE')
                    }}
                    className="w-full rounded-xl border border-white/15 py-2 text-sm text-cream/55"
                  >
                    Client a annulé
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => {
                    abortRef.current?.abort()
                    setStep('terminal_result')
                    setTerminalState('cancelled')
                    reportFailure('Annulé depuis la caisse')
                  }}
                  className="w-full rounded-xl border border-white/15 py-2 text-sm text-cream/55"
                >
                  Annuler la transaction
                </button>
              )}
            </>
          )}

          {step === 'terminal_result' && (
            <>
              <div
                className={cn(
                  'flex items-start gap-3 rounded-xl border px-4 py-3',
                  terminalState === 'declined'
                    ? 'border-red-500/30 bg-red-950/40'
                    : 'border-amber-500/30 bg-amber-500/10'
                )}
              >
                <AlertCircle
                  className={cn(
                    'mt-0.5 h-5 w-5 shrink-0',
                    terminalState === 'declined' ? 'text-red-300' : 'text-amber-300'
                  )}
                />
                <div>
                  <p className="font-semibold text-cream">{terminalStateLabel(terminalState)}</p>
                  {failureReason && (
                    <p className="mt-1 text-sm text-cream/55">{failureReason}</p>
                  )}
                </div>
              </div>
              <p className="text-sm text-cream/50">Que faire ?</p>
              <button
                type="button"
                disabled={submitting || busy}
                onClick={() => void startCardPayment()}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 font-semibold text-white"
              >
                <RefreshCw className="h-4 w-4" />
                Réessayer (autre carte / Apple Pay)
              </button>
              <button
                type="button"
                disabled={submitting || busy}
                onClick={() => setStep('cash_confirm')}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 py-3 font-semibold text-emerald-100"
              >
                <Banknote className="h-4 w-4" />
                Passer en espèces
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleClose}
                className="w-full rounded-xl border border-white/15 py-2 text-sm text-cream/55"
              >
                Retour au panier (sans encaisser)
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function TerminalStatusBlock({
  state,
  message,
}: {
  state: TerminalPaymentState
  message: string | null
}) {
  const spinning = ['connecting', 'awaiting_card', 'processing'].includes(state)
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-blue-500/25 bg-blue-500/10 px-4 py-6 text-center">
      {state === 'approved' ? (
        <CheckCircle2 className="h-12 w-12 text-emerald-400" />
      ) : spinning ? (
        <Loader2 className="h-12 w-12 animate-spin text-blue-400" />
      ) : state === 'awaiting_card' ? (
        <Smartphone className="h-12 w-12 text-blue-300" />
      ) : (
        <CreditCard className="h-12 w-12 text-blue-300" />
      )}
      <p className="font-semibold text-cream">{terminalStateLabel(state)}</p>
      {message && <p className="text-sm text-cream/55">{message}</p>}
    </div>
  )
}
