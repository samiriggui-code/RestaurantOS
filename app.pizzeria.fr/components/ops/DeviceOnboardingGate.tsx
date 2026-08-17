'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, Loader2, ShieldAlert, Smartphone } from 'lucide-react'
import {
  fetchDeviceAccessStatus,
  isLocalDevHost,
  type DevicesAccessStatus,
} from '@/lib/device-onboarding'

type GateState = 'loading' | 'allowed' | 'blocked'

export function DeviceOnboardingGate({
  deviceLabel,
  children,
}: {
  deviceLabel: string
  children: React.ReactNode
}) {
  const [state, setState] = useState<GateState>('loading')
  const [status, setStatus] = useState<DevicesAccessStatus | null>(null)

  const check = useCallback(async () => {
    if (isLocalDevHost()) {
      setState('allowed')
      return
    }
    try {
      const access = await fetchDeviceAccessStatus()
      setStatus(access)
      setState(access.allowed ? 'allowed' : 'blocked')
    } catch {
      setState('allowed')
    }
  }, [])

  useEffect(() => {
    void check()
  }, [check])

  if (state === 'loading') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-charcoal text-cream">
        <Loader2 className="h-8 w-8 animate-spin text-tomato-light" />
        <p className="text-sm text-cream/60">Vérification accès {deviceLabel}…</p>
      </div>
    )
  }

  if (state === 'blocked' && status) {
    const needsOnboarding = !status.onboardingComplete
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-charcoal p-6 text-cream">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-tomato/20">
          {needsOnboarding ? (
            <Smartphone className="h-8 w-8 text-tomato-light" />
          ) : (
            <ShieldAlert className="h-8 w-8 text-amber-400" />
          )}
        </div>
        <div className="max-w-md space-y-2 text-center">
          <h1 className="font-display text-2xl font-bold">
            {needsOnboarding ? 'Mise en service requise' : 'Accès réseau refusé'}
          </h1>
          <p className="text-sm text-cream/60">
            {status.message ??
              (needsOnboarding
                ? 'Configurez les appareils dans le CRM avant d’ouvrir la caisse ou le KDS.'
                : 'Cet écran n’est accessible que depuis le Wi‑Fi du restaurant.')}
          </p>
          {status.clientIp && (
            <p className="text-xs text-cream/40">
              Votre IP : {status.clientIp}
              {status.allowedWanIps.length > 0 && (
                <> — autorisées : {status.allowedWanIps.join(', ')}</>
              )}
            </p>
          )}
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href="/admin/devices"
            className="rounded-xl bg-tomato px-5 py-2.5 text-sm font-medium text-white hover:bg-tomato-light"
          >
            Ouvrir configuration appareils
          </Link>
          <button
            type="button"
            onClick={() => void check()}
            className="rounded-xl border border-white/15 px-5 py-2.5 text-sm hover:bg-white/5"
          >
            Réessayer
          </button>
        </div>
        {!needsOnboarding && (
          <p className="flex max-w-sm items-start gap-2 text-xs text-amber-400/80">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            Depuis le CRM sur le Wi‑Fi du shop : « Utiliser l’IP de ce réseau ».
          </p>
        )}
      </div>
    )
  }

  return <>{children}</>
}
