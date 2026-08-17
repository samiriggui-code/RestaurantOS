'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import Link from 'next/link'
import { useFeedbackState } from '@/lib/use-feedback-state'
import { ArrowLeft, Delete, Loader2 } from 'lucide-react'
import { apiUrl } from '@/lib/api'
import { fetchWithRetry } from '@/lib/api-fetch'
import {
  isDeviceUnlocked,
  lockDevice,
  setDeviceUnlocked,
  type DeviceKind,
} from '@/lib/device-lock'
import { STAFF_PIN_LENGTH } from '@/lib/pin'
import { canAccessKitchen, canAccessPos } from '@/lib/roles'
import { getStaffSession, getStaffUser, saveDeviceSession } from '@/lib/staff-auth'
import { cn } from '@/lib/cn'

type DeviceLockContextValue = {
  lock: () => void
  operatorName: string | null
}

const DeviceLockContext = createContext<DeviceLockContextValue | null>(null)

export function useDeviceLock(): DeviceLockContextValue {
  const ctx = useContext(DeviceLockContext)
  if (!ctx) throw new Error('useDeviceLock must be used within DevicePinGate')
  return ctx
}

const DEVICE_BRAND: Record<DeviceKind, string> = {
  pos: 'POS',
  kitchen: 'KDS',
}

function canUseDevice(device: DeviceKind, role: string): boolean {
  return device === 'pos' ? canAccessPos(role) : canAccessKitchen(role)
}

export function DevicePinGate({
  device,
  children,
}: {
  device: DeviceKind
  children: React.ReactNode
}) {
  const [ready, setReady] = useState(false)
  const [unlocked, setUnlocked] = useState(false)
  const [pin, setPin] = useState('')
  const { error, setError } = useFeedbackState()
  const [submitting, setSubmitting] = useState(false)
  const [operatorName, setOperatorName] = useState<string | null>(null)

  const brandLabel = process.env.NEXT_PUBLIC_BRAND_NAME ?? 'LA Z PIZZA'

  useEffect(() => {
    const session = getStaffSession('device')
    const user = getStaffUser('device')
    if (session && user && isDeviceUnlocked(device) && canUseDevice(device, user.role)) {
      setOperatorName(user.name)
      setUnlocked(true)
    }
    setReady(true)
  }, [device])

  const handleLock = useCallback(() => {
    lockDevice(device)
    setUnlocked(false)
    setPin('')
    setOperatorName(null)
    setError(null)
  }, [device, setError])

  const submitPin = useCallback(
    async (value: string) => {
      if (value.length !== STAFF_PIN_LENGTH) {
        setError(`PIN à ${STAFF_PIN_LENGTH} chiffres`)
        return
      }
      setSubmitting(true)
      setError(null)
      try {
        const businessId =
          process.env.NEXT_PUBLIC_BUSINESS_ID ?? '00000000-0000-0000-0000-000000000001'
        const res = await fetchWithRetry(
          apiUrl('/auth/pin'),
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pin: value, businessId, device }),
          },
          { retries: 1, timeoutMs: 12_000 },
        )
        const data = (await res.json().catch(() => ({}))) as {
          error?: string
          accessToken?: string
          refreshToken?: string
          business?: Parameters<typeof saveDeviceSession>[0]['business']
          user?: Parameters<typeof saveDeviceSession>[0]['user']
        }
        if (!res.ok) throw new Error(data.error ?? `PIN refusé (${res.status})`)
        if (!data.accessToken || !data.refreshToken || !data.business || !data.user) {
          throw new Error('Réponse serveur incomplète')
        }

        saveDeviceSession({
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          business: data.business,
          user: data.user,
        })
        setDeviceUnlocked(device)
        setOperatorName(data.user.name)
        setUnlocked(true)
        setPin('')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur')
        setPin('')
      } finally {
        setSubmitting(false)
      }
    },
    [device, setError],
  )

  function appendDigit(d: string) {
    if (submitting || pin.length >= STAFF_PIN_LENGTH) return
    const next = pin + d
    setPin(next)
    setError(null)
    if (next.length === STAFF_PIN_LENGTH) {
      void submitPin(next)
    }
  }

  function backspace() {
    if (submitting) return
    setPin((p) => p.slice(0, -1))
    setError(null)
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-charcoal">
        <Loader2 className="h-10 w-10 animate-spin text-tomato-light" />
      </div>
    )
  }

  if (!unlocked) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-charcoal px-4 text-cream">
        <div className="mb-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-tomato-light">
            {brandLabel} · {DEVICE_BRAND[device]}
          </p>
          <h1 className="mt-3 font-display text-3xl font-bold text-cream">Connexion staff</h1>
          <p className="mt-2 text-sm text-cream/50">
            Veuillez entrer votre code PIN à {STAFF_PIN_LENGTH} chiffres
          </p>
        </div>

        <div className="w-full max-w-xs rounded-2xl border border-white/10 bg-[#1A1412] p-5 shadow-xl">
          <div className="mb-5 flex justify-center gap-3" aria-label="PIN saisi">
            {Array.from({ length: STAFF_PIN_LENGTH }).map((_, i) => (
              <span
                key={i}
                className={cn(
                  'h-2.5 w-2.5 rounded-full transition-colors',
                  i < pin.length ? 'bg-tomato-light' : 'bg-white/15',
                )}
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
                className="rounded-xl border border-white/10 bg-white/[0.03] py-4 text-xl font-bold text-cream hover:bg-white/5 active:bg-white/10 disabled:opacity-50"
              >
                {d}
              </button>
            ))}
            <button
              type="button"
              disabled={submitting}
              onClick={() => {
                setPin('')
                setError(null)
              }}
              className="rounded-xl border border-white/10 bg-white/[0.03] py-4 text-sm font-semibold text-cream/60 hover:bg-white/5"
            >
              C
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => appendDigit('0')}
              className="rounded-xl border border-white/10 bg-white/[0.03] py-4 text-xl font-bold text-cream hover:bg-white/5 disabled:opacity-50"
            >
              0
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={backspace}
              className="flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] py-4 text-cream/70 hover:bg-white/5 disabled:opacity-50"
              aria-label="Effacer le dernier chiffre"
            >
              <Delete className="h-5 w-5" />
            </button>
          </div>

          {submitting && (
            <div className="mt-3 flex justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-tomato-light" />
            </div>
          )}
        </div>

        <Link
          href="/admin"
          className="mt-8 inline-flex items-center gap-1.5 text-sm text-cream/40 transition-colors hover:text-cream/70"
        >
          <ArrowLeft className="h-4 w-4" />
          retour back-office
        </Link>
      </div>
    )
  }

  return (
    <DeviceLockContext.Provider value={{ lock: handleLock, operatorName }}>
      {children}
    </DeviceLockContext.Provider>
  )
}
