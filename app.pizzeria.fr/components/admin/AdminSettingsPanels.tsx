'use client'

import { useState } from 'react'
import { useFeedbackState } from '@/lib/use-feedback-state'
import Link from 'next/link'
import { AlertTriangle, CalendarDays, Loader2, Plus, Save, Scale, Wifi } from 'lucide-react'
import { getStaffSession } from '@/lib/staff-auth'
import { staffFetch } from '@/lib/staff-api'
import { isModuleEnabled } from '@/lib/modules'
import { cn } from '@/lib/cn'

const fieldClass =
  'mt-1 w-full rounded-lg border border-white/15 bg-white/[0.03] px-3 py-1.5 text-sm text-cream outline-none focus:border-tomato/40'

const sectionClass = 'rounded-xl border border-white/10 bg-[#1A1412] p-4'

type PlanningSettings = {
  maxDaysPerWeek?: number
  maxConsecutiveDays?: number
  minRestDaysPerWeek?: number
  kitchenStart?: string
  serviceStart?: string
  closeTime?: string
  fullTimeDriverMaxDays?: number
  partTimeDriverMaxDays?: number
  platformDeliveryNote?: string
  inHouseDriverDays?: number[]
}

type BizSettings = {
  fiscalTrainingMode?: boolean
  fiscalActivationDate?: string
  planning?: PlanningSettings
}

type BusinessRow = {
  id: string
  name?: string
  wifiDuration?: number
  wifiVoucherEnabled?: boolean
  settings?: BizSettings | null
}

function parseSettings(raw: unknown): BizSettings {
  if (!raw || typeof raw !== 'object') return {}
  return raw as BizSettings
}

export function AdminWifiBusinessPanel({
  business,
  onUpdate,
}: {
  business: BusinessRow
  onUpdate: (b: BusinessRow) => void
}) {
  const [saving, setSaving] = useState(false)
  const { error, setError, message, setMessage } = useFeedbackState()

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const session = getStaffSession()
    if (!session) return
    setSaving(true)
    setError(null)
    setMessage(null)
    const form = new FormData(e.currentTarget)
    try {
      const updated = await staffFetch<BusinessRow>('/settings', {
        method: 'PUT',
        token: session.token,
        body: JSON.stringify({
          wifiDuration: Number(form.get('wifiDuration') ?? 120),
          wifiVoucherEnabled: form.get('wifiVoucherEnabled') === 'on',
        }),
      })
      onUpdate(updated)
      setMessage('Paramètres WiFi enregistrés.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={(e) => void handleSave(e)} className="space-y-3">
      {message && (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-sm text-emerald-200">
          {message}
        </p>
      )}
      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-950/40 px-3 py-1.5 text-sm text-red-200">
          {error}
        </p>
      )}
      <section className={sectionClass}>
        <h2 className="mb-1 flex items-center gap-2 font-semibold text-cream">
          <Wifi className="h-4 w-4" />
          Session invité
        </h2>
        <p className="mb-3 text-xs text-cream/45">Durée par défaut des coupons QR — gestion des codes ci-dessous.</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block text-sm text-cream/70">
            Durée session (minutes)
            <input
              name="wifiDuration"
              type="number"
              defaultValue={business.wifiDuration ?? 120}
              className={fieldClass}
            />
          </label>
          <label className="flex cursor-pointer items-end gap-3 pb-2 text-sm text-cream/80">
            <input
              name="wifiVoucherEnabled"
              type="checkbox"
              defaultChecked={business.wifiVoucherEnabled !== false}
              className="h-5 w-5 rounded border-white/20 bg-white/5 text-tomato"
            />
            Coupons WiFi activés
          </label>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-tomato px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </section>
    </form>
  )
}

export function AdminFiscalSettingsPanel({
  business,
  onUpdate,
}: {
  business: BusinessRow
  onUpdate: (b: BusinessRow) => void
}) {
  const [saving, setSaving] = useState(false)
  const { error, setError, message, setMessage } = useFeedbackState()
  const settings = parseSettings(business.settings)

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const session = getStaffSession()
    if (!session) return
    setSaving(true)
    setError(null)
    setMessage(null)
    const form = new FormData(e.currentTarget)
    try {
      const activationRaw = String(form.get('fiscalActivationDate') ?? '').trim()
      const updated = await staffFetch<BusinessRow>('/settings', {
        method: 'PUT',
        token: session.token,
        body: JSON.stringify({
          settings: {
            fiscalTrainingMode: form.get('fiscalTrainingMode') === 'on',
            ...(activationRaw ? { fiscalActivationDate: activationRaw } : {}),
          },
        }),
      })
      onUpdate(updated)
      setMessage('Paramètres fiscaux enregistrés.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {message && (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-sm text-emerald-200">
          {message}
        </p>
      )}
      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-950/40 px-3 py-1.5 text-sm text-red-200">
          {error}
        </p>
      )}
      <form onSubmit={(e) => void handleSave(e)} className="space-y-4">
        <section className={cn(sectionClass, 'border-amber-500/20 bg-amber-500/5')}>
          <h2 className="mb-1 flex items-center gap-2 font-semibold text-cream">
            <Scale className="h-4 w-4" />
            Caisse & conformité ISCA
          </h2>
          <p className="mb-3 text-xs text-cream/45">
            Conformité article 286 CGI / BOFiP : chaque vente encaissée produit un ticket fiscal chaîné ;
            la clôture Z journalière fige les totaux de façon irréversible. Consultation complète sur{' '}
            <Link href="/admin/fiscal" className="text-tomato-light hover:underline">
              Fiscal ISCA
            </Link>
            .
          </p>

          <div className="mb-4 space-y-1">
            <label htmlFor="fiscalActivationDate" className="text-sm font-medium text-cream">
              Date de mise en service ISCA
            </label>
            <p className="text-xs text-cream/45">
              Première journée de vente réelle avec cette solution. Les clôtures Z ne sont proposées qu’à partir
              de cette date (jour d’ouverture en production).
            </p>
            <input
              id="fiscalActivationDate"
              name="fiscalActivationDate"
              type="date"
              defaultValue={settings.fiscalActivationDate ?? ''}
              className={fieldClass}
            />
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-amber-500/25 bg-black/20 p-3">
            <input
              name="fiscalTrainingMode"
              type="checkbox"
              defaultChecked={Boolean(settings.fiscalTrainingMode)}
              className="mt-0.5 h-5 w-5 rounded border-white/20 bg-white/5 text-tomato"
            />
            <span className="text-sm text-cream/80">
              <strong className="text-cream">Mode formation</strong> — tickets marqués TRAINING, exclus des
              clôtures Z (article 286 CGI). À désactiver en production.
            </span>
          </label>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-cream/45">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
            Bascule enregistrée dans le journal JET.
          </div>
          <button
            type="submit"
            disabled={saving}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-tomato px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </section>
      </form>
      <section className={sectionClass}>
        <p className="text-sm text-cream/60">
          Consultation tickets, chaîne cryptographique, clôture Z, export archives →{' '}
          <Link href="/admin/fiscal" className="text-tomato-light hover:underline">
            Fiscal ISCA
          </Link>
        </p>
      </section>
    </div>
  )
}

const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

export function AdminPlanningSettingsPanel({
  business,
  onUpdate,
}: {
  business: BusinessRow
  onUpdate: (b: BusinessRow) => void
}) {
  const [saving, setSaving] = useState(false)
  const { error, setError, message, setMessage } = useFeedbackState()
  const planning = parseSettings(business.settings).planning ?? {}
  const inHouseDays = planning.inHouseDriverDays ?? [4, 5, 6]

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const session = getStaffSession()
    if (!session) return
    setSaving(true)
    setError(null)
    setMessage(null)
    const form = new FormData(e.currentTarget)
    const driverDays: number[] = []
    for (let d = 0; d < 7; d++) {
      if (form.get(`driverDay_${d}`) === 'on') driverDays.push(d)
    }
    try {
      const updated = await staffFetch<BusinessRow>('/settings', {
        method: 'PUT',
        token: session.token,
        body: JSON.stringify({
          settings: {
            planning: {
              maxDaysPerWeek: Number(form.get('maxDaysPerWeek') ?? 6),
              maxConsecutiveDays: Number(form.get('maxConsecutiveDays') ?? 6),
              minRestDaysPerWeek: Number(form.get('minRestDaysPerWeek') ?? 1),
              kitchenStart: String(form.get('kitchenStart') ?? '17:00'),
              serviceStart: String(form.get('serviceStart') ?? '18:00'),
              closeTime: String(form.get('closeTime') ?? '22:30'),
              fullTimeDriverMaxDays: Number(form.get('fullTimeDriverMaxDays') ?? 6),
              partTimeDriverMaxDays: Number(form.get('partTimeDriverMaxDays') ?? 3),
              platformDeliveryNote: String(form.get('platformDeliveryNote') ?? '').trim() || undefined,
              inHouseDriverDays: driverDays,
            },
          },
        }),
      })
      onUpdate(updated)
      setMessage('Règles planning enregistrées.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={(e) => void handleSave(e)} className="space-y-4">
      {message && (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-sm text-emerald-200">
          {message}
        </p>
      )}
      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-950/40 px-3 py-1.5 text-sm text-red-200">
          {error}
        </p>
      )}
      <section className={sectionClass}>
        <h2 className="mb-1 flex items-center gap-2 font-semibold text-cream">
          <CalendarDays className="h-4 w-4" />
          Garde-fous planning équipe
        </h2>
        <p className="mb-3 text-xs text-cream/45">
          Utilisés par la génération IA et les alertes couverture — grille hebdo sur{' '}
          <Link href="/admin/planning" className="text-tomato-light hover:underline">
            Planning équipe
          </Link>
          , modèles de créneaux sur{' '}
          <Link href="/admin/shifts" className="text-tomato-light hover:underline">
            Créneaux équipe
          </Link>
          .
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block text-sm text-cream/70">
            Jours max / semaine
            <input
              name="maxDaysPerWeek"
              type="number"
              min={1}
              max={7}
              defaultValue={planning.maxDaysPerWeek ?? 6}
              className={fieldClass}
            />
          </label>
          <label className="block text-sm text-cream/70">
            Jours consécutifs max
            <input
              name="maxConsecutiveDays"
              type="number"
              min={1}
              max={7}
              defaultValue={planning.maxConsecutiveDays ?? 6}
              className={fieldClass}
            />
          </label>
          <label className="block text-sm text-cream/70">
            Repos min / semaine
            <input
              name="minRestDaysPerWeek"
              type="number"
              min={0}
              max={6}
              defaultValue={planning.minRestDaysPerWeek ?? 1}
              className={fieldClass}
            />
          </label>
          <label className="block text-sm text-cream/70">
            Début cuisine
            <input name="kitchenStart" type="time" defaultValue={planning.kitchenStart ?? '17:00'} className={fieldClass} />
          </label>
          <label className="block text-sm text-cream/70">
            Début service
            <input name="serviceStart" type="time" defaultValue={planning.serviceStart ?? '18:00'} className={fieldClass} />
          </label>
          <label className="block text-sm text-cream/70">
            Fermeture
            <input name="closeTime" type="time" defaultValue={planning.closeTime ?? '22:30'} className={fieldClass} />
          </label>
          <label className="block text-sm text-cream/70">
            Livreur CDI — jours max
            <input
              name="fullTimeDriverMaxDays"
              type="number"
              min={1}
              max={7}
              defaultValue={planning.fullTimeDriverMaxDays ?? 6}
              className={fieldClass}
            />
          </label>
          <label className="block text-sm text-cream/70">
            Livreur temps partiel — jours max
            <input
              name="partTimeDriverMaxDays"
              type="number"
              min={1}
              max={7}
              defaultValue={planning.partTimeDriverMaxDays ?? 3}
              className={fieldClass}
            />
          </label>
          <label className="block text-sm text-cream/70 sm:col-span-2 lg:col-span-3">
            Note livraison plateformes
            <input
              name="platformDeliveryNote"
              defaultValue={planning.platformDeliveryNote ?? ''}
              placeholder="Uber Eats / Deliveroo : leurs livreurs"
              className={fieldClass}
            />
          </label>
        </div>
        <div className="mt-4">
          <span className="text-sm text-cream/70">Jours livreur maison (0=lun … 6=dim)</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {DAY_LABELS.map((label, d) => (
              <label
                key={d}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-cream/75"
              >
                <input
                  name={`driverDay_${d}`}
                  type="checkbox"
                  defaultChecked={inHouseDays.includes(d)}
                  className="h-4 w-4 rounded border-white/20 text-tomato"
                />
                {label}
              </label>
            ))}
          </div>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-tomato px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </section>
    </form>
  )
}

type SecurityPrefs = {
  admin2fa: boolean
  sessionLock15: boolean
  auditJournal: boolean
}

const SECURITY_KEY = 'lz_admin_security_prefs'

function loadSecurityPrefs(): SecurityPrefs {
  if (typeof window === 'undefined') {
    return { admin2fa: false, sessionLock15: true, auditJournal: true }
  }
  try {
    return {
      admin2fa: false,
      sessionLock15: true,
      auditJournal: true,
      ...JSON.parse(localStorage.getItem(SECURITY_KEY) ?? '{}'),
    }
  } catch {
    return { admin2fa: false, sessionLock15: true, auditJournal: true }
  }
}

function saveSecurityPrefs(p: SecurityPrefs) {
  if (typeof window === 'undefined') return
  localStorage.setItem(SECURITY_KEY, JSON.stringify(p))
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: string
  hint?: string
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-[#1A1412] px-4 py-3">
      <div>
        <p className="text-sm font-medium text-cream">{label}</p>
        {hint && <p className="text-xs text-cream/45">{hint}</p>}
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-40',
          checked ? 'bg-tomato' : 'bg-white/15',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-6 w-6 rounded-full bg-white transition',
            checked ? 'left-[22px]' : 'left-0.5',
          )}
        />
      </button>
    </div>
  )
}

export function AdminSettingsBoutiquesPanel({
  business,
  onOpenDevicesTab,
}: {
  business: { id: string; name: string; settings?: { address?: string } | null }
  onOpenDevicesTab?: () => void
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-cream/50">Points de vente rattachés au back-office</p>
        {onOpenDevicesTab ? (
          <button
            type="button"
            onClick={onOpenDevicesTab}
            className="inline-flex items-center gap-1.5 rounded-full bg-tomato px-4 py-2 text-sm font-semibold text-white hover:bg-tomato-light"
          >
            <Plus className="h-4 w-4" />
            Gérer appareils
          </button>
        ) : (
          <Link
            href="/admin/devices"
            className="inline-flex items-center gap-1.5 rounded-full bg-tomato px-4 py-2 text-sm font-semibold text-white hover:bg-tomato-light"
          >
            <Plus className="h-4 w-4" />
            Gérer appareils
          </Link>
        )}
      </div>
      <div className="overflow-hidden rounded-xl border border-white/10">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-white/10 bg-white/[0.03] text-[10px] uppercase tracking-widest text-cream/40">
            <tr>
              <th className="px-4 py-3">Nom</th>
              <th className="px-4 py-3">Ville</th>
              <th className="px-4 py-3">Statut</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-white/5">
              <td className="px-4 py-3 font-medium text-cream">{business.name ?? '—'}</td>
              <td className="px-4 py-3 text-cream/60">
                {business.settings?.address ?? 'Adresse dans Infos légales'}
              </td>
              <td className="px-4 py-3">
                <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-semibold text-emerald-300">
                  Actif
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-xs text-cream/40">
        Multi-boutique : chaque caisse / KDS / livreur est jumelé via Appareils. Les IP réseau et codes PIN sont
        isolés par slot.
      </p>
    </section>
  )
}

export function AdminSettingsSecurityPanel({ onOpenDevicesTab }: { onOpenDevicesTab?: () => void }) {
  const [security, setSecurity] = useState<SecurityPrefs>(loadSecurityPrefs)

  const patchSecurity = (partial: Partial<SecurityPrefs>) => {
    const next = { ...security, ...partial }
    setSecurity(next)
    saveSecurityPrefs(next)
  }

  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-3 rounded-xl border border-white/10 bg-[#141010] p-4">
        <h3 className="font-display text-lg text-cream">Sécurité back-office</h3>
        <ToggleRow
          label="Authentification 2FA admin"
          hint="Phase ultérieure — TOTP"
          checked={security.admin2fa}
          onChange={(v) => patchSecurity({ admin2fa: v })}
          disabled
        />
        <ToggleRow
          label="Verrouillage session (15 min)"
          hint={isModuleEnabled('pos') ? 'PIN requis sur POS / KDS après inactivité' : 'PIN requis sur KDS après inactivité'}
          checked={security.sessionLock15}
          onChange={(v) => patchSecurity({ sessionLock15: v })}
        />
        <ToggleRow
          label="Journal d'audit détaillé"
          hint="Traces actions staff (export CRM)"
          checked={security.auditJournal}
          onChange={(v) => patchSecurity({ auditJournal: v })}
        />
      </div>
      <div className="space-y-3 rounded-xl border border-white/10 bg-[#141010] p-4">
        <h3 className="font-display text-lg text-cream">Sauvegarde & conformité</h3>
        <div className="flex justify-between rounded-xl border border-white/10 bg-[#1A1412] px-4 py-3 text-sm">
          <span className="text-cream/70">Backup quotidien automatique</span>
          <span className="font-semibold text-emerald-300">Actif</span>
        </div>
        <div className="flex justify-between rounded-xl border border-white/10 bg-[#1A1412] px-4 py-3 text-sm">
          <span className="text-cream/70">Rétention factures</span>
          <span className="text-cream">10 ans</span>
        </div>
        <div className="flex justify-between rounded-xl border border-white/10 bg-[#1A1412] px-4 py-3 text-sm">
          <span className="text-cream/70">Chiffrement au repos</span>
          <span className="font-semibold text-emerald-300">AES-256</span>
        </div>
        {onOpenDevicesTab ? (
          <button type="button" onClick={onOpenDevicesTab} className="text-xs text-tomato-light underline">
            Filtrage IP par boutique → Appareils → Réseau
          </button>
        ) : (
          <Link href="/admin/devices" className="text-xs text-tomato-light underline">
            Filtrage IP par boutique → Appareils → Réseau
          </Link>
        )}
      </div>
    </section>
  )
}
