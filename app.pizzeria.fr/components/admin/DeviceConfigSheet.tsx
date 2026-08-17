'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Copy, Link2, Loader2, RefreshCw, Trash2 } from 'lucide-react'
import { SideSheet } from '@/components/ui/side-sheet'
import { ApkInstallGuide } from '@/components/admin/ApkInstallGuide'
import { DeviceHealthPanel } from '@/components/admin/DeviceHealthPanel'
import { DEVICE_SLOT_LABELS, type DeviceSlot, type PairedDevice } from '@/lib/device-onboarding'
import { cn } from '@/lib/cn'

type SheetTab = 'pairing' | 'health' | 'install'

const SLOT_APK: Record<DeviceSlot, 'pos-sunmi' | 'pos-tablet' | 'kds'> = {
  'pos-sunmi': 'pos-sunmi',
  'pos-tablet': 'pos-tablet',
  kds: 'kds',
}

const SLOT_TEST_HREF: Record<DeviceSlot, string> = {
  'pos-sunmi': '/pos',
  'pos-tablet': '/pos',
  kds: '/kitchen',
}

export function DeviceConfigSheet({
  open,
  onClose,
  slot,
  storeName,
  device,
  pairingCode,
  slotFull,
  busy,
  onGenerateCode,
  onUnpair,
  onReplace,
}: {
  open: boolean
  onClose: () => void
  slot: DeviceSlot | null
  storeName: string
  device: PairedDevice | null
  pairingCode: { code: string; expiresAt: string } | null
  slotFull: boolean
  busy: boolean
  onGenerateCode: () => void
  onUnpair: () => void
  onReplace: () => void
}) {
  const [tab, setTab] = useState<SheetTab>('pairing')
  const [copied, setCopied] = useState(false)

  if (!slot) return null

  const label = DEVICE_SLOT_LABELS[slot]
  const variant = slot === 'kds' ? 'kitchen' : 'pos'

  function copyCode() {
    if (!pairingCode) return
    void navigator.clipboard.writeText(pairingCode.code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const tabs: { id: SheetTab; label: string }[] = [
    { id: 'pairing', label: 'Jumelage' },
    { id: 'health', label: 'Santé' },
    { id: 'install', label: 'APK' },
  ]

  return (
    <SideSheet
      open={open}
      onClose={onClose}
      width="lg"
      subtitle={storeName}
      title={label}
      footer={
        <div className="flex flex-wrap gap-2">
          <Link
            href={SLOT_TEST_HREF[slot]}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 rounded-xl border border-white/15 py-2.5 text-center text-sm hover:bg-white/5"
          >
            Ouvrir sur ce navigateur
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-tomato px-5 py-2.5 text-sm font-semibold text-white hover:bg-tomato-light"
          >
            Fermer
          </button>
        </div>
      }
    >
      <div className="mb-4 flex gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              'flex-1 rounded-lg py-2 text-xs font-medium',
              tab === t.id ? 'bg-tomato/20 text-tomato-light' : 'text-cream/50 hover:text-cream',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'pairing' && (
        <div className="space-y-4">
          {device ? (
            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-4">
              <p className="text-xs uppercase tracking-wider text-emerald-300/80">Appareil actif</p>
              <p className="mt-1 font-display text-lg font-bold text-cream">{device.label}</p>
              <p className="mt-1 text-xs text-cream/45">
                Jumelé le {new Date(device.pairedAt).toLocaleString('fr-FR')}
                {(device.lastIp ?? device.pairedFromIp) && ` · IP ${device.lastIp ?? device.pairedFromIp}`}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={onReplace}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 px-3 py-2 text-xs text-amber-200 hover:bg-amber-500/10"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Remplacer (reset slot)
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={onUnpair}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 px-3 py-2 text-xs text-red-300 hover:bg-red-500/10"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Dissocier
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-white/10 bg-black/20 p-4">
              <div className="flex items-center gap-2 text-cream/60">
                <Link2 className="h-4 w-4" />
                <p className="text-sm">Aucun terminal jumelé pour ce slot</p>
              </div>
              <p className="mt-2 text-xs text-cream/45">
                Générez un code à 6 chiffres, puis saisissez-le sur le terminal à la première ouverture de
                l&apos;app.
              </p>
            </div>
          )}

          {!device && (
            <button
              type="button"
              disabled={busy || slotFull}
              onClick={onGenerateCode}
              className="w-full rounded-xl bg-tomato py-3 text-sm font-semibold text-white hover:bg-tomato-light disabled:opacity-50"
            >
              {busy ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : 'Générer code d’appairage'}
            </button>
          )}

          {pairingCode && (
            <div className="rounded-2xl border border-tomato/30 bg-tomato/10 p-5 text-center">
              <p className="text-xs uppercase tracking-widest text-cream/50">Code boutique</p>
              <p className="mt-2 font-mono text-5xl font-bold tracking-[0.35em] text-cream">{pairingCode.code}</p>
              <p className="mt-2 text-xs text-cream/40">
                Expire {new Date(pairingCode.expiresAt).toLocaleTimeString('fr-FR')}
              </p>
              <button
                type="button"
                onClick={copyCode}
                className="mt-4 inline-flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2 text-xs hover:bg-white/5"
              >
                <Copy className="h-3.5 w-3.5" />
                {copied ? 'Copié' : 'Copier'}
              </button>
            </div>
          )}

          <ol className="space-y-2 text-xs text-cream/50">
            <li>1. Installez l&apos;APK (onglet APK) ou ouvrez l&apos;URL sur le terminal.</li>
            <li>2. Connectez-vous au Wi‑Fi du restaurant.</li>
            <li>3. Saisissez le code — puis le PIN staff (4 chiffres).</li>
          </ol>
        </div>
      )}

      {tab === 'health' && <DeviceHealthPanel variant={variant} pairedDevice={device} />}

      {tab === 'install' && <ApkInstallGuide kind={SLOT_APK[slot]} />}
    </SideSheet>
  )
}
