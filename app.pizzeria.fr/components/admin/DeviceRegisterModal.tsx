'use client'

import { useEffect, useState } from 'react'
import { ChefHat, Copy, Loader2, Store, Tablet, X } from 'lucide-react'
import type { DeviceSlot, SlotCapacityRow } from '@/lib/device-onboarding'
import { DEVICE_SLOT_LABELS } from '@/lib/device-onboarding'
import { cn } from '@/lib/cn'

type RegisterKind = DeviceSlot

const KIND_OPTIONS: { value: RegisterKind; label: string; hint: string; Icon: typeof Store }[] = [
  { value: 'pos-sunmi', label: 'Caisse (POS SUNMI)', hint: 'Terminal SUNMI V2 — comptoir principal', Icon: Store },
  { value: 'pos-tablet', label: 'Caisse (tablette)', hint: 'iPad / tablette Android en paysage', Icon: Tablet },
  { value: 'kds', label: 'Écran cuisine (KDS)', hint: 'Tablette murale — tickets en temps réel', Icon: ChefHat },
]

export function DeviceRegisterModal({
  open,
  onClose,
  storeName,
  slotCapacity,
  busy,
  onCreate,
}: {
  open: boolean
  onClose: () => void
  storeName: string
  slotCapacity: SlotCapacityRow[]
  busy: boolean
  onCreate: (slot: DeviceSlot, label: string) => Promise<{ code: string; expiresAt: string }>
}) {
  const [kind, setKind] = useState<RegisterKind>('pos-sunmi')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<{ code: string; expiresAt: string; slot: DeviceSlot; label: string } | null>(
    null,
  )
  const [copied, setCopied] = useState(false)

  const capacity = slotCapacity.find((s) => s.slot === kind)
  const slotFull = capacity ? capacity.available <= 0 : false

  useEffect(() => {
    if (!open) return
    setKind('pos-sunmi')
    setName('')
    setError(null)
    setSuccess(null)
    setCopied(false)
  }, [open])

  if (!open) return null

  async function handleCreate() {
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Donnez un nom au terminal (ex. POS Comptoir, KDS Four).')
      return
    }
    if (slotFull) {
      setError('Ce type de terminal est déjà occupé — dissociez l’appareil existant avant d’en ajouter un autre.')
      return
    }
    setError(null)
    try {
      const res = await onCreate(kind, trimmed)
      setSuccess({ ...res, slot: kind, label: trimmed })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de créer le device')
    }
  }

  function copyCode() {
    if (!success) return
    void navigator.clipboard.writeText(success.code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#14100e] p-6 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-bold text-cream">
              {success ? 'Code d’appairage' : 'Enregistrer un device'}
            </h2>
            <p className="mt-1 text-sm text-cream/50">
              {success
                ? `Saisissez ce code sur le terminal pour l’associer à ${storeName}.`
                : `Boutique : ${storeName}`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-cream/50 hover:bg-white/10 hover:text-cream"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {success ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-tomato/30 bg-tomato/10 p-6 text-center">
              <p className="text-xs uppercase tracking-wider text-cream/50">{success.label}</p>
              <p className="mt-1 text-sm text-cream/60">{DEVICE_SLOT_LABELS[success.slot]}</p>
              <p className="mt-4 font-mono text-5xl font-bold tracking-[0.35em] text-cream">{success.code}</p>
              <p className="mt-3 text-xs text-cream/40">
                Valide jusqu’à {new Date(success.expiresAt).toLocaleTimeString('fr-FR')}
              </p>
            </div>
            <ol className="space-y-2 text-sm text-cream/55">
              <li>1. Ouvrez l’application sur le terminal (POS, KDS…).</li>
              <li>2. À la première connexion, saisissez le code à 6 chiffres.</li>
              <li>3. Le terminal restera lié à cette boutique.</li>
            </ol>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={copyCode}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/15 py-2.5 text-sm hover:bg-white/5"
              >
                <Copy className="h-4 w-4" />
                {copied ? 'Copié' : 'Copier le code'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-xl bg-tomato py-2.5 text-sm font-semibold text-white hover:bg-tomato-light"
              >
                Terminé
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <label className="block text-sm">
              <span className="text-cream/60">Type</span>
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as RegisterKind)}
                className="mt-1.5 w-full rounded-xl border border-white/15 bg-charcoal px-3 py-2.5 text-sm text-cream focus:border-tomato/40 focus:outline-none"
              >
                {KIND_OPTIONS.map((opt) => {
                  const cap = slotCapacity.find((s) => s.slot === opt.value)
                  const full = cap ? cap.available <= 0 : false
                  return (
                    <option key={opt.value} value={opt.value} disabled={full}>
                      {opt.label}
                      {full ? ' — occupé' : ''}
                    </option>
                  )
                })}
              </select>
            </label>

            <label className="block text-sm">
              <span className="text-cream/60">Nom</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex : POS Comptoir, KDS Four"
                className="mt-1.5 w-full rounded-xl border border-white/15 bg-charcoal px-3 py-2.5 text-sm text-cream placeholder:text-cream/30 focus:border-tomato/40 focus:outline-none"
              />
            </label>

            <p className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-xs leading-relaxed text-cream/45">
              Un code d&apos;appairage à 6 chiffres sera généré. À saisir depuis le device pour l&apos;associer à la
              boutique <strong className="text-cream/70">{storeName}</strong>.
            </p>

            {slotFull && (
              <p className="text-xs text-amber-300">
                Slot plein — dissociez l&apos;appareil actuel dans la liste avant d&apos;en enregistrer un nouveau.
              </p>
            )}

            {error && (
              <p className="rounded-xl border border-red-500/30 bg-red-950/40 px-3 py-2 text-sm text-red-200">{error}</p>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-xl border border-white/15 py-2.5 text-sm text-cream/70 hover:bg-white/5"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={busy || slotFull}
                onClick={() => void handleCreate()}
                className={cn(
                  'flex flex-1 items-center justify-center gap-2 rounded-xl bg-tomato py-2.5 text-sm font-semibold text-white hover:bg-tomato-light disabled:opacity-50',
                )}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Créer'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
