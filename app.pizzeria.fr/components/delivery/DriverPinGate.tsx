'use client'

import { useCallback, useEffect, useState } from 'react'
import { useFeedbackState } from '@/lib/use-feedback-state'
import { Loader2, Lock, User } from 'lucide-react'
import {
  clearStoredDriverPin,
  fetchDriversOnDuty,
  getStoredDriverPin,
  getStoredDriverUserId,
  setStoredDriverUserId,
  verifyDriverPin,
  type DriverProfile,
} from '@/lib/driver-api'

const PIN_LENGTH = 4

export function DriverPinGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false)
  const [unlocked, setUnlocked] = useState(false)
  const [pin, setPin] = useState('')
  const { error, setError } = useFeedbackState()
  const [submitting, setSubmitting] = useState(false)
  const [drivers, setDrivers] = useState<DriverProfile[]>([])
  const [driversLoading, setDriversLoading] = useState(false)
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null)

  useEffect(() => {
    const storedPin = getStoredDriverPin()
    const storedUser = getStoredDriverUserId()
    if (storedPin && storedUser) {
      setUnlocked(true)
      setSelectedDriverId(storedUser)
    } else if (storedPin) {
      setDriversLoading(true)
      void fetchDriversOnDuty()
        .then((list) => setDrivers(list))
        .catch(() => setDrivers([]))
        .finally(() => setDriversLoading(false))
    }
    setReady(true)
  }, [])

  const submit = useCallback(async (value: string) => {
    if (value.length !== PIN_LENGTH) {
      setError(`PIN à ${PIN_LENGTH} chiffres`)
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const result = await verifyDriverPin(value)
      if (!result.ok) {
        setError('PIN incorrect')
        setPin('')
        return
      }
      if (result.driverUserId) {
        setSelectedDriverId(result.driverUserId)
        setUnlocked(true)
        return
      }
      const existingUser = getStoredDriverUserId()
      if (existingUser) {
        setUnlocked(true)
        return
      }
      setDriversLoading(true)
      const list = await fetchDriversOnDuty()
      setDrivers(list)
      if (list.length === 1) {
        setStoredDriverUserId(list[0]!.id)
        setSelectedDriverId(list[0]!.id)
        setUnlocked(true)
      }
    } catch {
      setError('Connexion impossible')
    } finally {
      setSubmitting(false)
      setDriversLoading(false)
    }
  }, [])

  const confirmDriver = useCallback(() => {
    if (!selectedDriverId) {
      setError('Sélectionnez votre nom')
      return
    }
    setStoredDriverUserId(selectedDriverId)
    setUnlocked(true)
    setError(null)
  }, [selectedDriverId])

  if (!ready) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
      </div>
    )
  }

  if (!unlocked) {
    const pinOk = Boolean(getStoredDriverPin())
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center p-6">
        {!pinOk ? (
          <>
            <div className="text-center">
              <Lock className="mx-auto h-12 w-12 text-violet-400" />
              <h1 className="mt-4 font-display text-2xl font-bold text-cream">Accès livreur</h1>
              <p className="mt-2 text-sm text-cream/50">
                Saisissez votre PIN livreur ou gérant.
              </p>
            </div>
            <input
              type="password"
              inputMode="numeric"
              maxLength={PIN_LENGTH}
              value={pin}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, '').slice(0, PIN_LENGTH)
                setPin(v)
                setError(null)
                if (v.length === PIN_LENGTH) void submit(v)
              }}
              className="mt-8 w-full rounded-xl border border-white/15 bg-charcoal px-4 py-4 text-center text-3xl font-bold tracking-[0.5em] text-cream"
              placeholder="••••"
              autoFocus
            />
          </>
        ) : (
          <>
            <div className="text-center">
              <User className="mx-auto h-12 w-12 text-violet-400" />
              <h1 className="mt-4 font-display text-2xl font-bold text-cream">Qui êtes-vous ?</h1>
              <p className="mt-2 text-sm text-cream/50">
                Une livraison = un seul livreur — choisissez votre profil
              </p>
            </div>
            {driversLoading ? (
              <div className="mt-8 flex justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
              </div>
            ) : drivers.length === 0 ? (
              <p className="mt-6 text-center text-sm text-amber-200">
                Aucun livreur actif — contactez la pizzeria
              </p>
            ) : (
              <ul className="mt-6 space-y-2">
                {drivers.map((d) => (
                  <li key={d.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedDriverId(d.id)}
                      className={`w-full rounded-xl border px-4 py-3 text-left text-sm font-semibold transition ${
                        selectedDriverId === d.id
                          ? 'border-violet-400 bg-violet-500/20 text-violet-100'
                          : 'border-white/10 bg-charcoal text-cream/80 hover:border-white/20'
                      }`}
                    >
                      {d.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              disabled={!selectedDriverId || driversLoading}
              onClick={confirmDriver}
              className="mt-6 w-full rounded-xl bg-violet-600 py-3.5 text-sm font-bold text-white disabled:opacity-40"
            >
              Continuer
            </button>
          </>
        )}
        {error && <p className="mt-3 text-center text-sm text-red-300">{error}</p>}
        {submitting && (
          <p className="mt-3 flex items-center justify-center gap-2 text-sm text-cream/50">
            <Loader2 className="h-4 w-4 animate-spin" />
            Vérification…
          </p>
        )}
      </div>
    )
  }

  return (
    <div>
      <div className="flex justify-end px-4 pt-3">
        <button
          type="button"
          onClick={() => {
            clearStoredDriverPin()
            setUnlocked(false)
            setPin('')
            setSelectedDriverId(null)
            setDrivers([])
          }}
          className="text-xs text-cream/40 underline"
        >
          Verrouiller
        </button>
      </div>
      {children}
    </div>
  )
}
