'use client'

import { useEffect, useState } from 'react'
import { Loader2, Lock } from 'lucide-react'
import { STAFF_PIN_LENGTH } from '@/lib/pin'
import { cn } from '@/lib/cn'

type Props = {
  open: boolean
  employeeName: string
  actionLabel: string
  submitting?: boolean
  error?: string | null
  onClose: () => void
  onSubmit: (pin: string) => void
}

export function StaffPinDialog({
  open,
  employeeName,
  actionLabel,
  submitting = false,
  error = null,
  onClose,
  onSubmit,
}: Props) {
  const [pin, setPin] = useState('')

  useEffect(() => {
    if (open) setPin('')
  }, [open, employeeName])

  if (!open) return null

  function appendDigit(d: string) {
    if (submitting || pin.length >= STAFF_PIN_LENGTH) return
    const next = pin + d
    setPin(next)
    if (next.length === STAFF_PIN_LENGTH) onSubmit(next)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#1A1412] p-6 shadow-2xl">
        <div className="mb-5 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-tomato/15">
            <Lock className="h-6 w-6 text-tomato-light" />
          </div>
          <h2 className="font-display text-lg font-bold text-cream">{employeeName}</h2>
          <p className="mt-1 text-sm text-cream/55">{actionLabel}</p>
          <p className="mt-2 text-xs text-cream/40">Saisissez votre PIN à {STAFF_PIN_LENGTH} chiffres</p>
        </div>

        <div className="mb-4 flex justify-center gap-3" aria-label="PIN saisi">
          {Array.from({ length: STAFF_PIN_LENGTH }).map((_, i) => (
            <span
              key={i}
              className={cn('h-3.5 w-3.5 rounded-full', i < pin.length ? 'bg-tomato-light' : 'bg-white/15')}
            />
          ))}
        </div>

        {error && (
          <p className="mb-4 rounded-xl border border-red-500/30 bg-red-950/40 px-3 py-2 text-center text-sm text-red-200">
            {error}
          </p>
        )}

        <div className="grid grid-cols-3 gap-2">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
            <button
              key={d}
              type="button"
              disabled={submitting}
              onClick={() => appendDigit(d)}
              className="rounded-xl border border-white/10 py-3.5 text-lg font-semibold text-cream hover:bg-white/5 disabled:opacity-50"
            >
              {d}
            </button>
          ))}
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="rounded-xl border border-white/10 py-3.5 text-sm text-cream/60 hover:bg-white/5"
          >
            Annuler
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => appendDigit('0')}
            className="rounded-xl border border-white/10 py-3.5 text-lg font-semibold text-cream hover:bg-white/5 disabled:opacity-50"
          >
            0
          </button>
          <button
            type="button"
            disabled={submitting || pin.length !== STAFF_PIN_LENGTH}
            onClick={() => onSubmit(pin)}
            className="rounded-xl bg-tomato py-3.5 text-sm font-bold text-white hover:bg-tomato-dark disabled:opacity-40"
          >
            {submitting ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : 'OK'}
          </button>
        </div>
      </div>
    </div>
  )
}
