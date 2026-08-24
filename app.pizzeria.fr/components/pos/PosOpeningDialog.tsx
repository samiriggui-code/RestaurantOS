'use client'

import { useState } from 'react'
import { Loader2, Wallet, X } from 'lucide-react'
import { getStaffSession } from '@/lib/staff-auth'
import { openPosSession, type PosSession } from '@/lib/pos-session-api'
import { useAppFeedback } from '@/components/feedback/AppFeedbackProvider'

type Props = {
  open: boolean
  onClose: () => void
  onOpened: (session: PosSession) => void
}

export function PosOpeningDialog({ open, onClose, onOpened }: Props) {
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)
  const { notifyError, notifySuccess } = useAppFeedback()

  if (!open) return null

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const session = getStaffSession('device')
    if (!session) return
    const cents = Math.round(Number(amount.replace(',', '.')) * 100)
    if (!Number.isFinite(cents) || cents < 0) {
      notifyError('Montant invalide')
      return
    }
    setBusy(true)
    try {
      const opened = await openPosSession(session.token, cents)
      notifySuccess('Session de caisse ouverte')
      onOpened(opened)
    } catch (err) {
      notifyError('Ouverture impossible', err instanceof Error ? err.message : undefined)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#1A1412] p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15">
              <Wallet className="h-5 w-5 text-emerald-400" />
            </span>
            <div>
              <h3 className="font-semibold text-cream">Ouverture de caisse</h3>
              <p className="mt-0.5 text-xs text-cream/50">Fond de caisse déclaré en début de service</p>
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

        <form onSubmit={(e) => void submit(e)} className="mt-5 space-y-4">
          <label className="block text-sm text-cream/60">
            Montant en espèces (€)
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
          <button
            type="submit"
            disabled={busy || !amount}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Ouvrir la session
          </button>
        </form>
      </div>
    </div>
  )
}
