'use client'

import { useState } from 'react'
import { useFeedbackState } from '@/lib/use-feedback-state'
import { Link2, Loader2, X } from 'lucide-react'
import { getStaffSession } from '@/lib/staff-auth'
import { pairDevice } from '@/lib/device-onboarding'

export function DevicePairingDialog({
  open,
  onClose,
  onPaired,
}: {
  open: boolean
  onClose: () => void
  onPaired?: () => void
}) {
  const [code, setCode] = useState('')
  const { error, setError } = useFeedbackState()
  const [submitting, setSubmitting] = useState(false)

  if (!open) return null

  async function submit() {
    const session = getStaffSession()
    if (!session) {
      setError('Connectez-vous avec le PIN staff')
      return
    }
    if (code.length !== 6) {
      setError('Code à 6 chiffres')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await pairDevice(session.token, code)
      setCode('')
      onPaired?.()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-charcoal p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-medium text-cream">
            <Link2 className="h-4 w-4" />
            Jumeler cet appareil
          </h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 hover:bg-white/10">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mb-4 text-sm text-cream/50">
          Saisissez le code affiché dans le CRM → Appareils.
        </p>
        <input
          inputMode="numeric"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="000000"
          className="w-full rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-center font-mono text-2xl tracking-widest"
        />
        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
        <button
          type="button"
          disabled={submitting || code.length !== 6}
          onClick={() => void submit()}
          className="mt-4 w-full rounded-xl bg-tomato py-2.5 text-sm font-medium text-white hover:bg-tomato-light disabled:opacity-50"
        >
          {submitting ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : 'Associer'}
        </button>
      </div>
    </div>
  )
}
