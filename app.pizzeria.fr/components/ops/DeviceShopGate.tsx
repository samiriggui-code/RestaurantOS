'use client'

import { useCallback, useEffect, useState } from 'react'
import { KeyRound, Link2, Loader2, ShieldAlert, Smartphone, WifiOff } from 'lucide-react'
import {
  fetchDeviceAccessStatus,
  fetchDeviceBindingStatus,
  isLocalDevHost,
  pairDevicePublic,
  requestDeviceEmergencyBypass,
  DEVICE_SLOT_LABELS,
  type DevicesAccessStatus,
} from '@/lib/device-onboarding'
import {
  clearDeviceBinding,
  expectedDeviceSlot,
  getBoundDeviceId,
  saveDeviceBinding,
} from '@/lib/device-binding'
import {
  hasValidDeviceGateBypass,
  saveDeviceGateBypass,
} from '@/lib/device-gate-bypass'
import { getCrmSession } from '@/lib/staff-auth'

type GatePhase = 'loading' | 'network-error' | 'network-blocked' | 'wan-missing' | 'pairing' | 'ready'

export function DeviceShopGate({
  deviceLabel,
  children,
  /** Totem : contrôle IP boutique sans jumelage slot POS/KDS. */
  skipPairing = false,
}: {
  deviceLabel: string
  children: React.ReactNode
  skipPairing?: boolean
}) {
  const [phase, setPhase] = useState<GatePhase>('loading')
  const [status, setStatus] = useState<DevicesAccessStatus | null>(null)
  const [networkError, setNetworkError] = useState<string | null>(null)
  const expectedSlot = expectedDeviceSlot()

  const verify = useCallback(async () => {
    if (isLocalDevHost()) {
      setPhase('ready')
      return
    }

    if (hasValidDeviceGateBypass()) {
      setPhase('ready')
      return
    }

    setNetworkError(null)
    setPhase('loading')

    try {
      const access = await fetchDeviceAccessStatus()
      setStatus(access)

      if (!access.gateSkipped && !access.wanIpConfigured) {
        setPhase('wan-missing')
        return
      }

      if (!access.gateSkipped && !access.ipAllowed) {
        setPhase('network-blocked')
        return
      }

      if (skipPairing) {
        setPhase('ready')
        return
      }

      const boundId = getBoundDeviceId()
      if (boundId) {
        const binding = await fetchDeviceBindingStatus(boundId)
        if (binding.valid && binding.slot === expectedSlot) {
          setPhase('ready')
          return
        }
        clearDeviceBinding()
      }

      // Tablette unique boutique : déjà connectée au backoffice (session CRM) sur ce même
      // appareil → pas besoin de re-jumeler séparément pour le KDS. Le contrôle IP boutique
      // ci-dessus reste appliqué ; seul le code de jumelage à 6 chiffres est sauté.
      if (getCrmSession()) {
        setPhase('ready')
        return
      }

      setPhase('pairing')
    } catch (err) {
      setNetworkError(err instanceof Error ? err.message : 'Connexion impossible')
      setPhase('network-error')
    }
  }, [expectedSlot, skipPairing])

  useEffect(() => {
    void verify()
  }, [verify])

  if (phase === 'loading') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-charcoal text-cream">
        <Loader2 className="h-8 w-8 animate-spin text-tomato-light" />
        <p className="text-sm text-cream/60">Vérification {deviceLabel}…</p>
      </div>
    )
  }

  if (phase === 'network-error') {
    return (
      <BlockedScreen
        icon={<WifiOff className="h-8 w-8 text-amber-400" />}
        title="Connexion impossible"
        message={networkError ?? 'Le terminal ne peut pas joindre le serveur. Activez le Wi‑Fi et réessayez.'}
        status={
          status ?? {
            onboardingComplete: false,
            ipAllowed: false,
            wanIpConfigured: false,
            clientIp: null,
            allowedWanIps: [],
            gateSkipped: false,
            allowed: false,
          }
        }
        onRetry={() => void verify()}
        onEmergencyBypass={() => setPhase('ready')}
      />
    )
  }

  if (phase === 'wan-missing' && status) {
    return (
      <BlockedScreen
        icon={<Smartphone className="h-8 w-8 text-tomato-light" />}
        title="Boutique non configurée"
        message="L’IP du réseau boutique n’est pas encore enregistrée. Réessayez depuis le Wi‑Fi du restaurant, ou demandez au gérant d’utiliser « Utiliser l’IP de ce réseau » dans le CRM (Appareils → Réseau)."
        status={status}
        onRetry={() => void verify()}
        onEmergencyBypass={() => setPhase('ready')}
      />
    )
  }

  if (phase === 'network-blocked' && status) {
    return (
      <BlockedScreen
        icon={<WifiOff className="h-8 w-8 text-amber-400" />}
        title="Réseau non autorisé"
        message="Cet écran n’est accessible que depuis le Wi‑Fi du restaurant (IP boutique enregistrée)."
        status={status}
        onRetry={() => void verify()}
        onEmergencyBypass={() => setPhase('ready')}
      />
    )
  }

  if (phase === 'pairing') {
    return (
      <DevicePairingScreen
        deviceLabel={deviceLabel}
        expectedSlot={expectedSlot}
        onPaired={() => setPhase('ready')}
        onEmergencyBypass={() => setPhase('ready')}
      />
    )
  }

  return <>{children}</>
}

function ManagerEmergencyBypass({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false)
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit() {
    if (pin.length < 4) {
      setError('PIN gérant requis')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await requestDeviceEmergencyBypass(pin)
      saveDeviceGateBypass(res.expiresAt)
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Accès refusé')
      setPin('')
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 text-xs text-cream/45 underline-offset-2 hover:text-cream/70 hover:underline"
      >
        Accès temporaire gérant (PIN)
      </button>
    )
  }

  return (
    <div className="mt-4 w-full max-w-xs space-y-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
      <p className="flex items-center gap-2 text-xs text-amber-200/90">
        <KeyRound className="h-3.5 w-3.5 shrink-0" />
        Bypass 4 h — PIN admin / gérant
      </p>
      <input
        inputMode="numeric"
        maxLength={8}
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void submit()
        }}
        placeholder="PIN"
        className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-center font-mono tracking-widest"
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
      <button
        type="button"
        disabled={busy || pin.length < 4}
        onClick={() => void submit()}
        className="w-full rounded-lg bg-amber-600 py-2 text-xs font-medium text-white disabled:opacity-50"
      >
        {busy ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : 'Débloquer temporairement'}
      </button>
    </div>
  )
}

function BlockedScreen({
  icon,
  title,
  message,
  status,
  onRetry,
  onEmergencyBypass,
}: {
  icon: React.ReactNode
  title: string
  message: string
  status: DevicesAccessStatus
  onRetry?: () => void
  onEmergencyBypass?: () => void
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-charcoal p-6 text-cream">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-tomato/20">{icon}</div>
      <div className="max-w-md space-y-2 text-center">
        <h1 className="font-display text-2xl font-bold">{title}</h1>
        <p className="text-sm text-cream/60">{message}</p>
        {status.clientIp && (
          <p className="text-xs text-cream/40">
            Votre IP : {status.clientIp}
            {status.allowedWanIps.length > 0 && <> — autorisées : {status.allowedWanIps.join(', ')}</>}
          </p>
        )}
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-xl border border-white/15 px-5 py-2.5 text-sm hover:bg-white/5"
        >
          Réessayer
        </button>
      )}
      {onEmergencyBypass && <ManagerEmergencyBypass onSuccess={onEmergencyBypass} />}
    </div>
  )
}

function DevicePairingScreen({
  deviceLabel,
  expectedSlot,
  onPaired,
  onEmergencyBypass,
}: {
  deviceLabel: string
  expectedSlot: ReturnType<typeof expectedDeviceSlot>
  onPaired: () => void
  onEmergencyBypass: () => void
}) {
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const slotLabel = DEVICE_SLOT_LABELS[expectedSlot]

  async function submit() {
    if (code.length !== 6) {
      setError('Code à 6 chiffres')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const result = await pairDevicePublic(code, expectedSlot)
      saveDeviceBinding(result.device.id, result.device.slot)
      onPaired()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de jumelage')
      setCode('')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-charcoal p-6 text-cream">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-tomato/20">
        <Link2 className="h-8 w-8 text-tomato-light" />
      </div>
      <div className="max-w-sm space-y-2 text-center">
        <h1 className="font-display text-2xl font-bold">Jumeler {deviceLabel}</h1>
        <p className="text-sm text-cream/60">
          Saisissez le code à 6 chiffres généré dans le CRM → Devices &amp; boutiques ({slotLabel}).
        </p>
        <p className="text-xs text-cream/40">
          Le jumelage ne se fait qu’une fois. Pour changer d’appareil, dissociez l’ancien dans le CRM.
        </p>
      </div>
      <div className="w-full max-w-xs space-y-3">
        <input
          inputMode="numeric"
          autoFocus
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && code.length === 6) void submit()
          }}
          placeholder="000000"
          className="w-full rounded-xl border border-white/15 bg-black/30 px-4 py-4 text-center font-mono text-3xl tracking-[0.3em]"
        />
        {error && (
          <p className="flex items-start gap-2 text-sm text-red-400">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </p>
        )}
        <button
          type="button"
          disabled={submitting || code.length !== 6}
          onClick={() => void submit()}
          className="w-full rounded-xl bg-tomato py-3 text-sm font-medium text-white hover:bg-tomato-light disabled:opacity-50"
        >
          {submitting ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : 'Associer cet appareil'}
        </button>
        <ManagerEmergencyBypass onSuccess={onEmergencyBypass} />
      </div>
    </div>
  )
}
