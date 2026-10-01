'use client'

import { useEffect, useMemo, useState } from 'react'
import { useFeedbackState } from '@/lib/use-feedback-state'
import Link from 'next/link'
import {
  Building2,
  CalendarDays,
  Check,
  ChefHat,
  Clock,
  Copy,
  ExternalLink,
  Globe,
  Loader2,
  Save,
  Scale,
  Settings2,
  Shield,
  Smartphone,
  Store,
  Truck,
  User,
  Users,
  Wifi,
} from 'lucide-react'
import { getStaffSession, getStaffUser } from '@/lib/staff-auth'
import { staffFetch } from '@/lib/staff-api'
import { isModuleEnabled, isStaffModuleEnabled } from '@/lib/modules'
import { AdminPageHeader, AdminPageShell, AdminSectionTabs } from '@/components/admin/AdminSectionTabs'
import { AdminSettingsSidebarNav } from '@/components/admin/AdminSettingsSidebarNav'
import { AdminScheduleView } from '@/components/admin/AdminScheduleView'
import { AdminPosConfigView } from '@/components/admin/AdminPosConfigView'
import { AdminKitchenConfigView } from '@/components/admin/AdminKitchenConfigView'
import { AdminDeliveryZonesPanel } from '@/components/admin/AdminDeliveryZonesPanel'
import { AdminDevicesView } from '@/components/admin/AdminDevicesView'
import { AdminWifiView } from '@/components/admin/AdminWifiView'
import {
  AdminFiscalSettingsPanel,
  AdminPlanningSettingsPanel,
  AdminSettingsBoutiquesPanel,
  AdminSettingsSecurityPanel,
  AdminWifiBusinessPanel,
} from '@/components/admin/AdminSettingsPanels'
import { AdminRolesPermissionsPanel } from '@/components/admin/AdminRolesPermissionsPanel'
import { cn } from '@/lib/cn'

type BusinessSettingsJson = {
  address?: string
  phone?: string
  legalName?: string
  siren?: string
  siret?: string
  vatNumber?: string
  nafCode?: string
  nafLabel?: string
  legalForm?: string
  website?: string
  emailDomain?: string
  adminNotificationEmail?: string
  driverAccessPin?: string
  fiscalTrainingMode?: boolean
  planning?: Record<string, unknown>
}

type BusinessSettings = {
  id: string
  name: string
  nameAr?: string | null
  taxRate?: number
  serviceChargeRate?: number
  currency?: string
  wifiDuration?: number
  wifiVoucherEnabled?: boolean
  settings?: BusinessSettingsJson | null
}

type SettingsTab =
  | 'boutiques'
  | 'roles'
  | 'legal'
  | 'security'
  | 'general'
  | 'finance'
  | 'schedule'
  | 'pos'
  | 'kitchen'
  | 'delivery'
  | 'wifi'
  | 'devices'
  | 'fiscal'
  | 'planning'
  | 'links'

const FORM_TABS: SettingsTab[] = ['general', 'legal', 'finance']

const SETTINGS_NAV_GROUPS: { label: string; itemIds: SettingsTab[] }[] = [
  {
    label: 'Boutique & sécurité',
    itemIds: ['boutiques', 'roles', 'legal', 'security'],
  },
  {
    label: 'Opérations',
    itemIds: [
      'general',
      'finance',
      'schedule',
      'pos',
      'kitchen',
      'delivery',
      'wifi',
      'devices',
      'fiscal',
      'planning',
      'links',
    ],
  },
]

function parseBizSettings(raw: unknown): BusinessSettingsJson {
  if (!raw || typeof raw !== 'object') return {}
  return raw as BusinessSettingsJson
}

const fieldClass =
  'mt-1 w-full rounded-lg border border-white/15 bg-white/[0.03] px-3 py-1.5 text-sm text-cream outline-none focus:border-tomato/40'

const sectionClass = 'rounded-xl border border-white/10 bg-[#1A1412] p-4'

function publicSiteUrls() {
  if (typeof window === 'undefined') {
    return { menu: '/menu', order: '/commander' }
  }
  const origin = window.location.origin
  return { menu: `${origin}/menu`, order: `${origin}/commander` }
}

export function AdminSettingsView() {
  const [business, setBusiness] = useState<BusinessSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const { error, setError, message, setMessage } = useFeedbackState()
  const [copied, setCopied] = useState<string | null>(null)
  const [urls, setUrls] = useState({ menu: '/menu', order: '/commander' })
  const [tab, setTab] = useState<SettingsTab>('boutiques')

  const user = getStaffUser()
  const wifiModule = isModuleEnabled('wifi')
  const planningModule = isStaffModuleEnabled('shifts')

  const openDevicesTab = () => setTab('devices')

  const tabs = useMemo(() => {
    const items = [
      { id: 'boutiques' as const, label: 'Boutiques', icon: Store },
      { id: 'roles' as const, label: 'Rôles & permissions', icon: Users },
      { id: 'legal' as const, label: 'Infos légales', icon: Building2 },
      { id: 'security' as const, label: 'Sécurité', icon: Shield },
      { id: 'general' as const, label: 'Établissement', icon: Settings2 },
      { id: 'finance' as const, label: 'Finances', icon: Scale },
      { id: 'schedule' as const, label: 'Horaires', icon: Clock },
      { id: 'pos' as const, label: 'Caisse', icon: Store },
      { id: 'kitchen' as const, label: 'Cuisine', icon: ChefHat },
      { id: 'delivery' as const, label: 'Livraison', icon: Truck },
      ...(wifiModule ? [{ id: 'wifi' as const, label: 'WiFi', icon: Wifi }] : []),
      { id: 'devices' as const, label: 'Appareils', icon: Smartphone },
      { id: 'fiscal' as const, label: 'Fiscal', icon: Scale },
      ...(planningModule
        ? [{ id: 'planning' as const, label: 'Planning', icon: CalendarDays }]
        : []),
      { id: 'links' as const, label: 'Liens', icon: Globe },
    ]
    return items
  }, [wifiModule, planningModule])

  const settingsNavGroups = useMemo(() => {
    const visibleIds = new Set(tabs.map((t) => t.id))
    return SETTINGS_NAV_GROUPS.map((g) => ({
      label: g.label,
      itemIds: g.itemIds.filter((id) => visibleIds.has(id)),
    })).filter((g) => g.itemIds.length > 0)
  }, [tabs])

  useEffect(() => {
    setUrls(publicSiteUrls())
    const session = getStaffSession()
    if (!session) return
    staffFetch<BusinessSettings>('/settings', { token: session.token })
      .then(setBusiness)
      .catch((err) => setError(err instanceof Error ? err.message : 'Erreur'))
      .finally(() => setLoading(false))
  }, [setError])

  async function copyText(label: string, text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(label)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      /* ignore */
    }
  }

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const session = getStaffSession()
    if (!session || !business) return
    setSaving(true)
    setMessage(null)
    setError(null)
    const form = new FormData(e.currentTarget)
    const prev = parseBizSettings(business.settings)
    try {
      const updated = await staffFetch<BusinessSettings>('/settings', {
        method: 'PUT',
        token: session.token,
        body: JSON.stringify({
          name: String(form.get('name') ?? '').trim(),
          nameAr: String(form.get('nameAr') ?? '').trim() || undefined,
          taxRate: Number(form.get('taxRate') ?? 10),
          serviceChargeRate: Number(form.get('serviceChargeRate') ?? 0),
          currency: String(form.get('currency') ?? 'EUR'),
          settings: {
            ...prev,
            legalName: String(form.get('legalName') ?? '').trim() || undefined,
            siren: String(form.get('siren') ?? '').trim() || undefined,
            siret: String(form.get('siret') ?? '').trim() || undefined,
            vatNumber: String(form.get('vatNumber') ?? '').trim() || undefined,
            nafCode: String(form.get('nafCode') ?? '').trim() || undefined,
            nafLabel: String(form.get('nafLabel') ?? '').trim() || undefined,
            legalForm: String(form.get('legalForm') ?? '').trim() || undefined,
            website: String(form.get('website') ?? '').trim() || undefined,
            address: String(form.get('address') ?? '').trim() || undefined,
            phone: String(form.get('phone') ?? '').trim() || undefined,
            emailDomain: String(form.get('emailDomain') ?? '').trim() || undefined,
            adminNotificationEmail: String(form.get('adminNotificationEmail') ?? '').trim() || undefined,
            driverAccessPin: String(form.get('driverAccessPin') ?? '').trim() || undefined,
          },
        }),
      })
      setBusiness(updated)
      setMessage('Paramètres enregistrés.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  if (loading || !business) {
    return (
      <AdminPageShell>
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-tomato-light" />
        </div>
      </AdminPageShell>
    )
  }

  const legal = parseBizSettings(business.settings)
  const showFormSave = FORM_TABS.includes(tab)

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Paramètres"
        description="Configuration centralisée — boutique, rôles, conformité et opérations."
      />

      {message && FORM_TABS.includes(tab) && (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-sm text-emerald-200">
          {message}
        </p>
      )}
      {error && FORM_TABS.includes(tab) && (
        <p className="rounded-lg border border-red-500/30 bg-red-950/40 px-3 py-1.5 text-sm text-red-200">
          {error}
        </p>
      )}

      <div className="lg:hidden">
        <AdminSectionTabs tabs={tabs} active={tab} onChange={setTab} />
      </div>

      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:gap-8">
        <AdminSettingsSidebarNav
          tabs={tabs}
          groups={settingsNavGroups}
          active={tab}
          onChange={setTab}
        />

        <div className="min-w-0 flex-1 space-y-4">
      {tab === 'boutiques' && (
        <AdminSettingsBoutiquesPanel business={business} onOpenDevicesTab={openDevicesTab} />
      )}

      {tab === 'roles' && <AdminRolesPermissionsPanel />}

      {tab === 'security' && <AdminSettingsSecurityPanel onOpenDevicesTab={openDevicesTab} />}

      {tab === 'schedule' && <AdminScheduleView />}

      {tab === 'pos' && <AdminPosConfigView embedded />}

      {tab === 'kitchen' && <AdminKitchenConfigView embedded />}

      {tab === 'delivery' && <AdminDeliveryZonesPanel />}

      {tab === 'wifi' && wifiModule && (
        <div className="space-y-4">
          <AdminWifiBusinessPanel
            business={business}
            onUpdate={(b) => setBusiness((prev) => ({ ...prev!, ...b }))}
          />
          <AdminWifiView embedded />
        </div>
      )}

      {tab === 'devices' && <AdminDevicesView embedded />}

      {tab === 'fiscal' && (
        <AdminFiscalSettingsPanel
          business={business}
          onUpdate={(b) =>
            setBusiness((prev) => ({
              ...prev!,
              ...b,
              settings: {
                ...parseBizSettings(prev?.settings),
                ...parseBizSettings(b.settings),
              },
            }))
          }
        />
      )}

      {tab === 'planning' && planningModule && (
        <AdminPlanningSettingsPanel
          business={business}
          onUpdate={(b) =>
            setBusiness((prev) => ({
              ...prev!,
              ...b,
              settings: {
                ...parseBizSettings(prev?.settings),
                ...parseBizSettings(b.settings),
              },
            }))
          }
        />
      )}

      {FORM_TABS.includes(tab) && (
        <form onSubmit={(e) => void handleSave(e)} className="space-y-4">
          <section className={cn(sectionClass, tab !== 'general' && 'hidden')}>
            <h2 className="mb-3 font-semibold text-cream">Identité établissement</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <label className="block text-sm text-cream/70">
                Nom affiché
                <input name="name" defaultValue={business.name ?? ''} className={fieldClass} required />
              </label>
              <label className="block text-sm text-cream/70">
                Nom secondaire (optionnel)
                <input name="nameAr" defaultValue={business.nameAr ?? ''} className={fieldClass} />
              </label>
            </div>
          </section>

          <section
            className={cn(
              sectionClass,
              'border-tomato/25 bg-tomato/[0.04]',
              tab !== 'legal' && 'hidden',
            )}
          >
            <h2 className="mb-1 font-semibold text-cream">Infos légales & facturation</h2>
            <p className="mb-3 text-xs text-cream/45">
              Affichées sur factures, reçus et emails. Obligatoires pour la facturation électronique
              (réception 2026 / émission PME 2027).
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <label className="block text-sm text-cream/70 sm:col-span-2 lg:col-span-3">
                Raison sociale (RNE)
                <input
                  name="legalName"
                  defaultValue={legal.legalName ?? ''}
                  placeholder="LA Z PIZZA"
                  className={fieldClass}
                />
              </label>
              <label className="block text-sm text-cream/70">
                SIREN
                <input name="siren" defaultValue={legal.siren ?? ''} placeholder="981 700 842" className={fieldClass} />
              </label>
              <label className="block text-sm text-cream/70">
                Forme juridique
                <input name="legalForm" defaultValue={legal.legalForm ?? ''} placeholder="SARL" className={fieldClass} />
              </label>
              <label className="block text-sm text-cream/70">
                Code NAF / APE
                <input name="nafCode" defaultValue={legal.nafCode ?? ''} placeholder="56.10C" className={fieldClass} />
              </label>
              <label className="block text-sm text-cream/70">
                Activité NAF
                <input
                  name="nafLabel"
                  defaultValue={legal.nafLabel ?? ''}
                  placeholder="Restauration de type rapide"
                  className={fieldClass}
                />
              </label>
              <label className="block text-sm text-cream/70 sm:col-span-2 lg:col-span-3">
                Site web public
                <input
                  name="website"
                  type="url"
                  defaultValue={legal.website ?? 'https://lazpizza.fr'}
                  className={fieldClass}
                />
              </label>
              <label className="block text-sm text-cream/70 sm:col-span-2 lg:col-span-3">
                Domaine emails staff (prenom.nom@…)
                <input
                  name="emailDomain"
                  defaultValue={legal.emailDomain ?? 'lazpizza.fr'}
                  placeholder="lazpizza.fr"
                  className={fieldClass}
                />
              </label>
              <label className="block text-sm text-cream/70 sm:col-span-2 lg:col-span-3">
                Adresse de l&apos;établissement
                <input
                  name="address"
                  defaultValue={legal.address ?? ''}
                  placeholder="12 route de Bordeaux, 33370 Fargues-Saint-Hilaire"
                  className={fieldClass}
                />
              </label>
              <label className="block text-sm text-cream/70">
                Téléphone
                <input
                  name="phone"
                  type="tel"
                  defaultValue={legal.phone ?? ''}
                  placeholder="05 56 00 00 00"
                  className={fieldClass}
                />
              </label>
              <label className="block text-sm text-cream/70">
                SIRET *
                <input
                  name="siret"
                  defaultValue={legal.siret ?? ''}
                  placeholder="123 456 789 00012"
                  pattern="[0-9\s]{9,17}"
                  className={fieldClass}
                />
              </label>
              <label className="block text-sm text-cream/70">
                N° TVA intracommunautaire
                <input
                  name="vatNumber"
                  defaultValue={legal.vatNumber ?? ''}
                  placeholder="FR12 345678901"
                  className={fieldClass}
                />
              </label>
              <label className="block text-sm text-cream/70 sm:col-span-2 lg:col-span-3">
                Email alertes (stock, incidents)
                <input
                  name="adminNotificationEmail"
                  type="email"
                  defaultValue={legal.adminNotificationEmail ?? ''}
                  placeholder="atmane.chennit@lazpizza.fr"
                  className={fieldClass}
                />
                <span className="mt-1 block text-xs text-cream/40">
                  Laissez vide pour utiliser l&apos;email du compte administrateur.
                </span>
              </label>
            </div>
            <p className="mt-3 text-xs text-cream/40">
              Factures clients →{' '}
              <Link href="/admin/invoices" className="text-tomato-light hover:underline">
                Facturation
              </Link>
            </p>
          </section>

          <div className={cn('space-y-4', tab !== 'finance' && 'hidden')}>
            <section className={cn(sectionClass, 'border-tomato/25 bg-tomato/[0.04]')}>
              <h2 className="mb-1 font-semibold text-cream">Multi-TVA (France)</h2>
              <p className="mb-3 text-xs text-cream/45">
                Taux par produit sur chaque article du menu :{' '}
                <strong className="text-cream/70">5,5 %</strong> (à emporter),{' '}
                <strong className="text-cream/70">10 %</strong> (restauration sur place),{' '}
                <strong className="text-cream/70">20 %</strong> (alcool). Ventilation automatique sur
                tickets fiscaux et commandes caisse.
              </p>
              <Link href="/admin/menu" className="text-sm text-tomato-light hover:underline">
                Modifier les taux TVA par produit → Menu
              </Link>
            </section>

            <section className={sectionClass}>
              <h2 className="mb-3 font-semibold text-cream">Finances</h2>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="block text-sm text-cream/70">
                  TVA par défaut (%)
                  <input
                    name="taxRate"
                    type="number"
                    step="0.1"
                    defaultValue={business.taxRate ?? 10}
                    className={fieldClass}
                  />
                  <span className="mt-1 block text-xs text-cream/40">
                    Repli si un produit n&apos;a pas de taux en menu (10 % restauration).
                  </span>
                </label>
                <label className="block text-sm text-cream/70">
                  Service (%)
                  <input
                    name="serviceChargeRate"
                    type="number"
                    step="0.1"
                    defaultValue={business.serviceChargeRate ?? 0}
                    className={fieldClass}
                  />
                </label>
                <label className="block text-sm text-cream/70">
                  Devise
                  <select name="currency" defaultValue={business.currency ?? 'EUR'} className={fieldClass}>
                    <option value="EUR">Euro (€)</option>
                  </select>
                </label>
              </div>
            </section>

            <section className={cn(sectionClass, 'border-violet-500/20 bg-violet-500/5')}>
              <h2 className="mb-1 font-semibold text-cream">Livreur</h2>
              <p className="mb-3 text-xs text-cream/45">
                PIN d&apos;accès à l&apos;espace livreur (<code className="text-cream/60">/livreur</code>).
              </p>
              <label className="block max-w-md text-sm text-cream/70">
                PIN livreur (4 chiffres)
                <input
                  name="driverAccessPin"
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]{4,8}"
                  autoComplete="off"
                  defaultValue={legal.driverAccessPin ?? ''}
                  placeholder="Laisser vide = env / défaut"
                  className={fieldClass}
                />
              </label>
            </section>
          </div>

          {showFormSave && (
            <div className="sticky bottom-0 border-t border-white/10 bg-charcoal/95 py-2.5 backdrop-blur">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-tomato px-4 py-2 text-sm font-semibold text-white hover:bg-tomato-dark disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          )}
        </form>
      )}

      {tab === 'links' && (
        <div className="space-y-4">
          <section className={sectionClass}>
            <h2 className="mb-1 font-semibold text-cream">Site client (public)</h2>
            <p className="mb-3 text-xs text-cream/45">Liens à partager — carte et tunnel de commande.</p>
            <div className="space-y-3">
              {[
                { label: 'Carte / menu', url: urls.menu, key: 'menu' },
                { label: 'Commander en ligne', url: urls.order, key: 'order' },
              ].map(({ label, url, key }) => (
                <div key={key}>
                  <span className="text-xs text-cream/40">{label}</span>
                  <div className="mt-1 flex gap-2">
                    <input readOnly value={url} className={cn(fieldClass, 'flex-1 font-mono text-xs')} />
                    <button
                      type="button"
                      onClick={() => void copyText(key, url)}
                      className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-white/15 px-3 py-2 text-xs text-cream/80 hover:bg-white/5"
                    >
                      {copied === key ? (
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                      Copier
                    </button>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex shrink-0 items-center rounded-xl border border-white/15 px-3 py-2 text-cream/80 hover:bg-white/5"
                      aria-label={`Ouvrir ${label}`}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className={sectionClass}>
            <h2 className="mb-3 font-semibold text-cream">Pages ops (staff)</h2>
            <ul className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
              {[
                { href: '/admin/kitchen', label: 'Suivi cuisine (KDS)' },
                { href: '/admin/pos', label: 'Suivi caisse' },
                { href: '/admin/delivery', label: 'Livraison live' },
                { href: '/admin/fiscal', label: 'Fiscal ISCA' },
                { href: '/admin/users', label: 'Utilisateurs staff' },
                { href: '/livreur', label: 'Espace livreur' },
              ].map(({ href, label }) => (
                <li key={href}>
                  <Link href={href} className="text-tomato-light hover:underline">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section className={sectionClass}>
            <h2 className="mb-3 flex items-center gap-2 font-semibold text-cream">
              <User className="h-4 w-4" />
              Administrateur
            </h2>
            {user ? (
              <p className="text-sm text-cream/70">
                Gérant : <span className="text-cream">{user.name}</span>{' '}
                <span className="text-cream/45">({user.email})</span>
              </p>
            ) : (
              <p className="text-sm text-cream/45">Session non chargée</p>
            )}
            <div className="mt-3">
              <span className="text-xs text-cream/40">ID établissement</span>
              <div className="mt-1 flex gap-2">
                <code className="flex-1 rounded-xl border border-white/10 bg-black/20 px-3 py-2 font-mono text-xs text-cream/70">
                  {business.id}
                </code>
                <button
                  type="button"
                  onClick={() => void copyText('bid', business.id)}
                  className="inline-flex items-center gap-1 rounded-xl border border-white/15 px-3 py-2 text-xs text-cream/80 hover:bg-white/5"
                >
                  {copied === 'bid' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  Copier
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
        </div>
      </div>
    </AdminPageShell>
  )
}
