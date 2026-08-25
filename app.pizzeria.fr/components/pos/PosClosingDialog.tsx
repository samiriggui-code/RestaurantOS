'use client'

import { useState } from 'react'
import { Loader2, Wallet, X } from 'lucide-react'
import { getStaffSession } from '@/lib/staff-auth'
import { closePosSession, type PosSession } from '@/lib/pos-session-api'
import { formatEUR } from '@/lib/money'
import { useAppFeedback } from '@/components/feedback/AppFeedbackProvider'
import { cn } from '@/lib/cn'

type Props = {
  open: boolean
  session: PosSession
  onClose: () => void
  onClosed: (session: PosSession) => void
}

export function PosClosingDialog({ open, session, onClose, onClosed }: Props) {
  const [amount, setAmount] = useState('')
  const [sumupCashAmount, setSumupCashAmount] = useState('')
  const [busy, setBusy] = useState(false)
  const [closed, setClosed] = useState<PosSession | null>(null)
  const { notifyError, notifySuccess, confirm } = useAppFeedback()

  if (!open) return null

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const staffSession = getStaffSession('device')
    if (!staffSession) return
    const cents = Math.round(Number(amount.replace(',', '.')) * 100)
    if (!Number.isFinite(cents) || cents < 0) {
      notifyError('Montant invalide')
      return
    }
    const ok = await confirm({
      title: 'Clôturer la session',
      message: 'Confirmer le comptage — la session ne peut plus être modifiée ensuite.',
      confirmLabel: 'Clôturer',
    })
    if (!ok) return

    let notes: string | undefined
    const sumupCents = Math.round(Number(sumupCashAmount.replace(',', '.')) * 100)
    if (sumupCashAmount.trim() && Number.isFinite(sumupCents) && sumupCents >= 0) {
      notes = `Cash relevé sur la caisse SumUp comptoir (hors suivi RestaurantOS) : ${formatEUR(sumupCents)}`
    }

    setBusy(true)
    try {
      const result = await closePosSession(staffSession.token, session.id, cents, notes)
      notifySuccess('Session clôturée')
      setClosed(result)
    } catch (err) {
      notifyError('Clôture impossible', err instanceof Error ? err.message : undefined)
    } finally {
      setBusy(false)
    }
  }

  const discrepancy = closed?.discrepancy ?? 0

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#1A1412] p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15">
              <Wallet className="h-5 w-5 text-amber-400" />
            </span>
            <div>
              <h3 className="font-semibold text-cream">Fermeture de caisse</h3>
              <p className="mt-0.5 text-xs text-cream/50">
                Ouverte à {formatEUR(session.openingCashAmount)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-cream/40 hover:bg-white/10 hover:text-cream"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {closed ? (
          <div className="mt-5 space-y-3">
            <div className="rounded-xl border border-white/10 bg-charcoal p-4 text-sm">
              <div className="flex justify-between text-cream/60">
                <span>Attendu (encaissements CASH)</span>
                <span className="font-medium text-cream">{formatEUR(closed.expectedCashAmount ?? 0)}</span>
              </div>
              <div className="mt-1 flex justify-between text-cream/60">
                <span>Compté</span>
                <span className="font-medium text-cream">{formatEUR(closed.closingCashAmount ?? 0)}</span>
              </div>
              <div className="mt-2 flex justify-between border-t border-white/10 pt-2">
                <span className="text-cream/60">Écart</span>
                <span
                  className={cn(
                    'font-bold tabular-nums',
                    discrepancy === 0 ? 'text-emerald-300' : discrepancy > 0 ? 'text-sky-300' : 'text-red-300',
                  )}
                >
                  {discrepancy > 0 ? '+' : ''}
                  {formatEUR(discrepancy)}
                </span>
              </div>
              {closed.notes && (
                <p className="mt-3 border-t border-white/10 pt-3 text-xs text-cream/50">
                  {closed.notes}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => onClosed(closed)}
              className="w-full rounded-xl bg-tomato py-2.5 text-sm font-semibold text-white hover:bg-tomato/90"
            >
              Terminer
            </button>
          </div>
        ) : (
          <form onSubmit={(e) => void submit(e)} className="mt-5 space-y-4">
            <label className="block text-sm text-cream/60">
              Espèces comptées (€)
              <input
                type="number"
                step="0.01"
                min="0"
                autoFocus
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="mt-1 w-full rounded-xl border border-white/15 bg-charcoal px-3 py-2 text-lg text-cream"
                placeholder="0.00"
              />
            </label>
            <label className="block text-sm text-cream/60">
              Cash relevé sur la caisse SumUp comptoir (€, optionnel)
              <input
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                value={sumupCashAmount}
                onChange={(e) => setSumupCashAmount(e.target.value)}
                className="mt-1 w-full rounded-xl border border-white/15 bg-charcoal px-3 py-2 text-lg text-cream"
                placeholder="0.00"
              />
              <span className="mt-1 block text-xs text-cream/40">
                Pour info uniquement — n&apos;entre pas dans le calcul de l&apos;écart ci-dessus
                (ce cash n&apos;est pas dans le tiroir suivi par RestaurantOS).
              </span>
            </label>
            <button
              type="submit"
              disabled={busy || !amount}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-600 py-2.5 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-50"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Clôturer la session
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
