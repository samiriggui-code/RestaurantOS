'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  CheckCircle2,
  ChefHat,
  Copy,
  CreditCard,
  ExternalLink,
  FileSpreadsheet,
  Landmark,
  Loader2,
  MonitorSmartphone,
  Plug,
  Printer,
  RefreshCw,
  Scale,
  Wallet,
  XCircle,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { AdminPageHeader, AdminPageShell } from '@/components/admin/AdminSectionTabs'
import { SideSheet } from '@/components/ui/side-sheet'
import { formatEUR } from '@/lib/money'
import { publicSitePath } from '@/lib/ops-apps'
import { isModuleEnabled } from '@/lib/modules'
import { getStaffSession } from '@/lib/staff-auth'
import { staffFetch } from '@/lib/staff-api'
import { cn } from '@/lib/cn'

type ProviderStatus = 'connected' | 'action' | 'disconnected'

type IntegrationsPayload = {
  sumupOnlineConfigured?: boolean
  sumupWebhookUrl?: string | null
  sumup?: {
    configured?: boolean
    source?: 'settings' | 'env' | null
    apiKeyHint?: string | null
    merchantCode?: string | null
    onlineConfigured?: boolean
    webhookUrl?: string | null
  }
  pennylane?: {
    configured?: boolean
    tokenHint?: string | null
    source?: 'settings' | 'env' | null
    invoiceDraft?: boolean
  }
  backups?: { configured?: boolean; managedByHost?: boolean }
}

type IntegrationId =
  | 'sumup-online'
  | 'sumup-csv'
  | 'epson'
  | 'sumup-reader'
  | 'fiscal'
  | 'backups'
  | 'pennylane'

type SheetContent = {
  id: IntegrationId
  subtitle: string
  title: string
  status: ProviderStatus
  summary: string
  steps: string[]
  links: { href: string; label: string; external?: boolean }[]
  webhookUrl?: string | null
}

const fieldClass =
  'mt-1.5 w-full rounded-xl border border-white/15 bg-white/[0.03] px-3 py-2.5 font-mono text-sm text-cream outline-none focus:border-tomato/40'

function StatusBadge({ status }: { status: ProviderStatus }) {
  const map = {
    connected: {
      label: 'Connecté',
      className: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
      Icon: CheckCircle2,
    },
    action: {
      label: 'À configurer',
      className: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
      Icon: ExternalLink,
    },
    disconnected: {
      label: 'Déconnecté',
      className: 'border-red-500/40 bg-red-500/10 text-cream/70',
      Icon: XCircle,
    },
  } as const
  const { label, className, Icon } = map[status]
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium', className)}>
      <Icon className="h-3 w-3" /> {label}
    </span>
  )
}

function IntegrationCard({
  icon: Icon,
  title,
  blurb,
  status,
  onOpen,
}: {
  icon: LucideIcon
  title: string
  blurb: string
  status: ProviderStatus
  onOpen: () => void
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex flex-col rounded-2xl border border-white/10 bg-[#1A1412] p-4 text-left transition hover:border-tomato/35 hover:bg-[#1f1714]"
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-cream/80 group-hover:bg-tomato/15 group-hover:text-tomato-light">
          <Icon className="h-5 w-5" />
        </div>
        <StatusBadge status={status} />
      </div>
      <p className="font-display text-lg font-semibold text-cream">{title}</p>
      <p className="mt-1 line-clamp-2 flex-1 text-xs leading-relaxed text-cream/50">{blurb}</p>
      <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-tomato-light">
        Configurer <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
      </span>
    </button>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-cream/45">{title}</h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{children}</div>
    </section>
  )
}

function ConfigBox({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-4 rounded-xl border border-white/10 bg-black/30 p-4">
      <h3 className="text-[11px] font-semibold uppercase tracking-widest text-cream/40">{title}</h3>
      {children}
    </div>
  )
}

export function AdminIntegrationsView() {
  const [sumupConfigured, setSumupConfigured] = useState(false)
  const [sumupOnlineConfigured, setSumupOnlineConfigured] = useState(false)
  const [sumupWebhookUrl, setSumupWebhookUrl] = useState<string | null>(null)
  const [sumupKeyHint, setSumupKeyHint] = useState<string | null>(null)
  const [sumupMerchant, setSumupMerchant] = useState<string | null>(null)
  const [sumupApiKeyInput, setSumupApiKeyInput] = useState('')
  const [sumupMerchantInput, setSumupMerchantInput] = useState('')
  const [sumupSaving, setSumupSaving] = useState(false)
  const [sumupMsg, setSumupMsg] = useState<string | null>(null)

  const [pennylaneConfigured, setPennylaneConfigured] = useState(false)
  const [pennylaneHint, setPennylaneHint] = useState<string | null>(null)
  const [pennylaneDraft, setPennylaneDraft] = useState(true)
  const [pennylaneTokenInput, setPennylaneTokenInput] = useState('')
  const [pennylaneSaving, setPennylaneSaving] = useState(false)
  const [pennylaneMsg, setPennylaneMsg] = useState<string | null>(null)
  const [pennylaneExpenseSyncing, setPennylaneExpenseSyncing] = useState(false)
  const [pennylaneExpenseMsg, setPennylaneExpenseMsg] = useState<string | null>(null)
  const [unpaidSupplierInvoices, setUnpaidSupplierInvoices] = useState<
    { id: string; label: string | null; invoiceNumber: string | null; amountCents: number; date: string | null }[]
  >([])

  const [sumupTxnSyncing, setSumupTxnSyncing] = useState(false)
  const [sumupTxnMsg, setSumupTxnMsg] = useState<string | null>(null)


  const [backupsOk, setBackupsOk] = useState(false)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState<string | null>(null)
  const [active, setActive] = useState<IntegrationId | null>(null)

  const load = useCallback(async () => {
    const session = getStaffSession()
    if (!session) return
    setLoading(true)
    try {
      const data = await staffFetch<IntegrationsPayload>('/settings/integrations', {
        token: session.token,
      })
      const su = data.sumup
      setSumupConfigured(Boolean(su?.configured ?? data.sumupOnlineConfigured))
      setSumupOnlineConfigured(Boolean(su?.onlineConfigured ?? data.sumupOnlineConfigured))
      setSumupWebhookUrl(su?.webhookUrl ?? data.sumupWebhookUrl ?? null)
      setSumupKeyHint(su?.apiKeyHint ?? null)
      setSumupMerchant(su?.merchantCode ?? null)
      const pl = data.pennylane
      setPennylaneConfigured(Boolean(pl?.configured))
      setPennylaneHint(pl?.tokenHint ?? null)
      setPennylaneDraft(pl?.invoiceDraft !== false)
      setBackupsOk(Boolean(data.backups?.configured))
    } catch {
      setSumupConfigured(false)
      setSumupOnlineConfigured(false)
      setPennylaneConfigured(false)
      setBackupsOk(false)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    setSumupMsg(null)
    setPennylaneMsg(null)
  }, [active])

  async function saveSumup(opts?: { clear?: boolean }) {
    const session = getStaffSession()
    if (!session) return
    setSumupSaving(true)
    setSumupMsg(null)
    try {
      const body: { apiKey?: string; merchantCode?: string; clear?: boolean } = {}
      if (opts?.clear) body.clear = true
      else {
        if (sumupApiKeyInput.trim()) body.apiKey = sumupApiKeyInput.trim()
        if (sumupMerchantInput.trim()) body.merchantCode = sumupMerchantInput.trim()
        if (!body.apiKey && !body.merchantCode && !sumupConfigured) {
          setSumupMsg('Renseigne la clé API et le code marchand SumUp.')
          setSumupSaving(false)
          return
        }
      }
      const res = await staffFetch<{
        configured: boolean
        apiKeyHint: string | null
        merchantCode: string | null
        onlineConfigured: boolean
        webhookUrl: string | null
      }>('/settings/integrations/sumup', {
        token: session.token,
        method: 'PUT',
        body: JSON.stringify(body),
      })
      setSumupConfigured(Boolean(res.configured))
      setSumupOnlineConfigured(Boolean(res.onlineConfigured))
      setSumupWebhookUrl(res.webhookUrl)
      setSumupKeyHint(res.apiKeyHint)
      setSumupMerchant(res.merchantCode)
      setSumupApiKeyInput('')
      setSumupMerchantInput('')
      setSumupMsg(opts?.clear ? 'Clés SumUp supprimées.' : 'SumUp enregistré.')
    } catch (e) {
      setSumupMsg(e instanceof Error ? e.message : 'Enregistrement impossible')
    } finally {
      setSumupSaving(false)
    }
  }

  async function savePennylane(opts?: { clear?: boolean }) {
    const session = getStaffSession()
    if (!session) return
    setPennylaneSaving(true)
    setPennylaneMsg(null)
    try {
      const body: { apiToken?: string; clearToken?: boolean; invoiceDraft: boolean } = {
        invoiceDraft: pennylaneDraft,
      }
      if (opts?.clear) body.clearToken = true
      else if (pennylaneTokenInput.trim()) body.apiToken = pennylaneTokenInput.trim()

      const res = await staffFetch<{
        configured: boolean
        tokenHint: string | null
        invoiceDraft: boolean
      }>('/invoices/pennylane/config', {
        token: session.token,
        method: 'PUT',
        body: JSON.stringify(body),
      })
      setPennylaneConfigured(Boolean(res.configured))
      setPennylaneHint(res.tokenHint)
      setPennylaneDraft(res.invoiceDraft !== false)
      setPennylaneTokenInput('')
      setPennylaneMsg(opts?.clear ? 'Token supprimé.' : 'Configuration enregistrée.')
    } catch (e) {
      setPennylaneMsg(e instanceof Error ? e.message : 'Enregistrement impossible')
    } finally {
      setPennylaneSaving(false)
    }
  }

  const loadUnpaidSupplierInvoices = useCallback(async () => {
    const session = getStaffSession()
    if (!session) return
    try {
      const res = await staffFetch<{
        invoices: { id: string; label: string | null; invoiceNumber: string | null; amountCents: number; date: string | null }[]
      }>('/pennylane/supplier-invoices?paid=unpaid&limit=5', { token: session.token })
      setUnpaidSupplierInvoices(res.invoices)
    } catch {
      setUnpaidSupplierInvoices([])
    }
  }, [])

  useEffect(() => {
    if (active === 'pennylane' && pennylaneConfigured) void loadUnpaidSupplierInvoices()
  }, [active, pennylaneConfigured, loadUnpaidSupplierInvoices])

  async function syncPennylaneExpenses() {
    const session = getStaffSession()
    if (!session) return
    setPennylaneExpenseSyncing(true)
    setPennylaneExpenseMsg(null)
    try {
      const res = await staffFetch<{ synced: number }>('/pennylane/supplier-invoices/sync', {
        token: session.token,
        method: 'POST',
      })
      setPennylaneExpenseMsg(`${res.synced} facture(s) fournisseur synchronisée(s).`)
      await loadUnpaidSupplierInvoices()
    } catch (e) {
      setPennylaneExpenseMsg(e instanceof Error ? e.message : 'Synchro dépenses impossible')
    } finally {
      setPennylaneExpenseSyncing(false)
    }
  }

  async function syncSumupTransactionsFromIntegrations() {
    const session = getStaffSession()
    if (!session) return
    setSumupTxnSyncing(true)
    setSumupTxnMsg(null)
    try {
      const res = await staffFetch<{ synced: number }>('/payments/sumup/transactions/sync', {
        token: session.token,
        method: 'POST',
      })
      setSumupTxnMsg(`${res.synced} transaction(s) synchronisée(s) — voir Facturation pour émettre une facture.`)
    } catch (e) {
      setSumupTxnMsg(e instanceof Error ? e.message : 'Synchro impossible')
    } finally {
      setSumupTxnSyncing(false)
    }
  }

  const sheets: Record<IntegrationId, SheetContent> = {
    'sumup-online': {
      id: 'sumup-online',
      subtitle: 'Paiement web',
      title: 'SumUp — site public',
      status: sumupOnlineConfigured ? 'connected' : sumupConfigured ? 'action' : 'action',
      summary:
        'Paiement carte sur le site client. Colle tes clés SumUp ici (espace SumUp → Développeurs). Le même compte sert aussi au lecteur boutique.',
      steps: [
        'Dans SumUp, récupère la clé API et le code marchand.',
        'Colle-les ci-dessous et enregistre.',
        'Passe une commande test sur le site.',
        'Vérifie que la commande part en cuisine une fois payée.',
      ],
      links: [
        { href: publicSitePath('/commander'), label: 'Ouvrir le site commander', external: true },
        { href: '/admin/orders', label: 'Commandes web' },
      ],
      webhookUrl: sumupWebhookUrl,
    },
    'sumup-csv': {
      id: 'sumup-csv',
      subtitle: 'Caisse SumUp',
      title: 'Import articles (CSV)',
      status: 'action',
      summary:
        'Pour réconcilier le stock avec des ventes faites hors RestaurantOS (ancienne caisse SumUp).',
      steps: [
        'Exporte le rapport articles depuis la caisse SumUp.',
        'Va dans Stock → Import Caisse SumUp.',
        'Importe le CSV pour ajuster l’inventaire.',
      ],
      links: [{ href: '/admin/stock', label: 'Stock → Import Caisse SumUp' }],
    },
    epson: {
      id: 'epson',
      subtitle: 'Matériel',
      title: 'Imprimantes Epson',
      status: 'connected',
      summary: 'Tickets caisse, cuisine et livraison sur le réseau boutique.',
      steps: [
        'Branche les Epson sur le Wi‑Fi / LAN boutique.',
        'Dans Devices, saisis les IP cuisine / comptoir.',
        'Lance un test d’impression depuis la fiche appareil.',
      ],
      links: [
        { href: '/admin/devices', label: 'Devices & boutiques' },
      ],
    },
    'sumup-reader': {
      id: 'sumup-reader',
      subtitle: 'Terminal CB',
      title: 'Lecteur SumUp (terminal boutique)',
      status: sumupConfigured ? 'action' : 'action',
      summary:
        'Lecteur SumUp Solo Wi‑Fi pour l’encaissement en boutique. D’abord les clés SumUp (carte ci-dessus), puis jumelage dans Devices.',
      steps: [
        'Enregistre les clés SumUp dans « SumUp — site public » (même compte).',
        'Dans Devices, jumelle le lecteur SumUp.',
        'À l’encaissement : Paiement carte → le client présente la carte.',
      ],
      links: [
        { href: '/admin/devices', label: 'Jumeler le lecteur' },
      ],
    },
    fiscal: {
      id: 'fiscal',
      subtitle: 'Conformité',
      title: 'Module fiscal ISCA',
      status: 'connected',
      summary: 'Chaînage des tickets, clôtures Z, journal — obligatoire pour les ventes payées.',
      steps: [
        'Contrôle l’intégrité dans Fiscal ISCA.',
        'Clôture Z en fin de service (Caisse & Z du jour).',
        'Exports / archives depuis l’écran Fiscal.',
      ],
      links: [
        { href: '/admin/fiscal', label: 'Ouvrir Fiscal ISCA' },
        { href: '/admin/caisse', label: 'Caisse & Z du jour' },
      ],
    },
    backups: {
      id: 'backups',
      subtitle: 'Stockage',
      title: 'Archivage & sauvegardes',
      status: backupsOk ? 'connected' : 'action',
      summary:
        'Sauvegardes automatiques de la base et archives fiscales. Géré avec l’hébergement — rien à configurer ici pour le restaurateur.',
      steps: [
        'Les sauvegardes tournent automatiquement côté infrastructure.',
        'Les exports fiscaux restent accessibles dans Fiscal ISCA.',
        'En cas de doute, contacte le support technique (pas de réglage serveur à faire toi-même).',
      ],
      links: [{ href: '/admin/fiscal', label: 'Exports fiscaux' }],
    },
    pennylane: {
      id: 'pennylane',
      subtitle: 'Comptabilité',
      title: 'Pennylane',
      status: pennylaneConfigured ? 'connected' : 'action',
      summary:
        'Envoie une facture émise vers Pennylane. Tu colles le token ici — pas besoin d’accéder au serveur.',
      steps: [
        'Dans Pennylane → Paramètres → API, génère un token.',
        'Colle-le ci-dessous et enregistre.',
        'Dans Facturation : « Pennylane » sur une facture émise.',
        'Le comptable finalise le brouillon dans Pennylane.',
      ],
      links: [{ href: '/admin/invoices', label: 'Ouvrir Facturation' }],
    },
  }

  const sheet = active ? sheets[active] : null

  function copy(text: string, id: string) {
    void navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 1500)
  }


  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Intégrations"
        subtitle="Tout se configure ici dans le backoffice — secrets, clés API, liens. Aucun accès serveur requis."
        actions={
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm text-cream/70 hover:bg-white/5"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Rafraîchir
          </button>
        }
      />

      <p className="mb-6 max-w-3xl text-sm text-cream/50">
        Clique une carte : tu colles ton token / secret, tu copies l’URL si besoin, et tu suis les étapes.
        Matériel (imprimantes, lecteur) se jumelle dans Devices.
      </p>

      <Section title="Paiements">
        <IntegrationCard
          icon={Wallet}
          title="SumUp — clés API"
          blurb="Clé + code marchand pour le site et le lecteur."
          status={sumupConfigured ? 'connected' : 'action'}
          onOpen={() => setActive('sumup-online')}
        />
        <IntegrationCard
          icon={CreditCard}
          title="Lecteur SumUp boutique"
          blurb="Jumelage TPE dans Devices (après les clés)."
          status={sumupConfigured ? 'connected' : 'action'}
          onOpen={() => setActive('sumup-reader')}
        />
        <IntegrationCard
          icon={FileSpreadsheet}
          title="Import CSV caisse SumUp"
          blurb="Réconciliation stock des ventes hors app."
          status="action"
          onOpen={() => setActive('sumup-csv')}
        />
      </Section>

      <Section title="Parc boutique">
        <IntegrationCard
          icon={Printer}
          title="Imprimantes Epson"
          blurb="IP LAN cuisine / comptoir dans Devices."
          status="connected"
          onOpen={() => setActive('epson')}
        />
        <IntegrationCard
          icon={MonitorSmartphone}
          title="Devices & jumelage"
          blurb={
            isModuleEnabled('pos')
              ? 'POS, KDS, réseau boutique — hub matériel.'
              : 'KDS, réseau boutique — hub matériel.'
          }
          status="connected"
          onOpen={() => {
            window.location.href = '/admin/devices'
          }}
        />
      </Section>

      <Section title="Conformité">
        <IntegrationCard
          icon={Scale}
          title="Fiscal ISCA"
          blurb="Chaînage tickets, clôtures Z, journal."
          status="connected"
          onOpen={() => setActive('fiscal')}
        />
        <IntegrationCard
          icon={Plug}
          title="Sauvegardes"
          blurb="Automatiques — gérées avec l’hébergement."
          status={backupsOk ? 'connected' : 'action'}
          onOpen={() => setActive('backups')}
        />
      </Section>

      <Section title="Comptabilité">
        <IntegrationCard
          icon={Landmark}
          title="Pennylane"
          blurb="Token API + envoi des factures émises."
          status={pennylaneConfigured ? 'connected' : 'action'}
          onOpen={() => setActive('pennylane')}
        />
      </Section>

      <SideSheet
        open={sheet != null}
        onClose={() => setActive(null)}
        subtitle={sheet?.subtitle}
        title={sheet?.title ?? ''}
        width="lg"
        footer={
          sheet ? (
            <div className="flex flex-wrap gap-2">
              {sheet.links.map((l) =>
                l.external ? (
                  <a
                    key={l.href + l.label}
                    href={l.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-tomato px-4 py-2.5 text-sm font-semibold text-white hover:bg-tomato-light"
                  >
                    {l.label} <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ) : (
                  <Link
                    key={l.href + l.label}
                    href={l.href}
                    onClick={() => setActive(null)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 px-4 py-2.5 text-sm font-medium text-cream hover:bg-white/5"
                  >
                    {l.label} <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                ),
              )}
            </div>
          ) : null
        }
      >
        {sheet && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={sheet.status} />
            </div>

            <p className="text-sm leading-relaxed text-cream/65">{sheet.summary}</p>

            <div>
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-cream/40">
                Procédure
              </h3>
              <ol className="space-y-2">
                {sheet.steps.map((step, i) => (
                  <li
                    key={step}
                    className="flex gap-3 rounded-xl border border-white/5 bg-black/25 px-3 py-2.5 text-sm text-cream/75"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-tomato/20 text-xs font-bold text-tomato-light">
                      {i + 1}
                    </span>
                    <span className="leading-snug">{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            {sheet.webhookUrl ? (
              <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                <p className="mb-1.5 text-[10px] uppercase tracking-widest text-cream/40">URL webhook</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 truncate font-mono text-[11px] text-tomato-light">
                    {sheet.webhookUrl}
                  </code>
                  <button
                    type="button"
                    onClick={() => copy(sheet.webhookUrl!, sheet.id)}
                    className="rounded-lg bg-white/5 p-2 hover:bg-white/10"
                    aria-label="Copier l’URL"
                  >
                    <Copy className="h-4 w-4 text-cream/60" />
                  </button>
                </div>
                {copied === sheet.id && <p className="mt-1 text-[10px] text-emerald-400">Copié</p>}
              </div>
            ) : null}

            {sheet.id === 'sumup-online' && (
              <ConfigBox title="Clés SumUp (backoffice)">
                {sumupConfigured ? (
                  <p className="text-sm text-emerald-300/90">
                    Clé : <code className="font-mono text-cream">{sumupKeyHint}</code>
                    {sumupMerchant ? (
                      <>
                        {' '}
                        · Marchand : <code className="font-mono text-cream">{sumupMerchant}</code>
                      </>
                    ) : null}
                  </p>
                ) : (
                  <p className="text-sm text-amber-200/90">Aucune clé — récupère-les dans ton espace SumUp.</p>
                )}
                <label className="block text-xs text-cream/50">
                  Clé API
                  <input
                    type="password"
                    autoComplete="off"
                    value={sumupApiKeyInput}
                    onChange={(e) => setSumupApiKeyInput(e.target.value)}
                    placeholder={sumupConfigured ? 'Nouvelle clé (optionnel)' : 'Colle la clé API'}
                    className={fieldClass}
                  />
                </label>
                <label className="block text-xs text-cream/50">
                  Code marchand
                  <input
                    type="text"
                    autoComplete="off"
                    value={sumupMerchantInput}
                    onChange={(e) => setSumupMerchantInput(e.target.value)}
                    placeholder={sumupMerchant ?? 'Ex. MXXXXXX'}
                    className={fieldClass}
                  />
                </label>
                {sumupMsg && (
                  <p className={sumupMsg.includes('impossible') || sumupMsg.includes('Renseigne') ? 'text-sm text-red-300' : 'text-sm text-emerald-300'}>
                    {sumupMsg}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={
                      sumupSaving ||
                      (!sumupConfigured && (!sumupApiKeyInput.trim() || !sumupMerchantInput.trim()))
                    }
                    onClick={() => void saveSumup()}
                    className="rounded-xl bg-tomato px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
                  >
                    {sumupSaving ? 'Enregistrement…' : 'Enregistrer'}
                  </button>
                  {sumupConfigured && (
                    <button
                      type="button"
                      disabled={sumupSaving}
                      onClick={() => void saveSumup({ clear: true })}
                      className="rounded-xl border border-white/15 px-4 py-2.5 text-sm text-cream/70"
                    >
                      Supprimer les clés
                    </button>
                  )}
                </div>
              </ConfigBox>
            )}

            {sheet.id === 'pennylane' && (
              <ConfigBox title="Connexion Pennylane (backoffice)">
                {pennylaneConfigured && pennylaneHint ? (
                  <p className="text-sm text-emerald-300/90">
                    Token : <code className="font-mono text-cream">{pennylaneHint}</code>
                  </p>
                ) : (
                  <p className="text-sm text-amber-200/90">Aucun token — colle celui de Pennylane.</p>
                )}
                <label className="block text-xs text-cream/50">
                  Token API
                  <input
                    type="password"
                    autoComplete="off"
                    value={pennylaneTokenInput}
                    onChange={(e) => setPennylaneTokenInput(e.target.value)}
                    placeholder={pennylaneConfigured ? 'Nouveau token (optionnel)' : 'Colle le token'}
                    className={fieldClass}
                  />
                </label>
                <label className="flex items-start gap-2 text-sm text-cream/70">
                  <input
                    type="checkbox"
                    checked={pennylaneDraft}
                    onChange={(e) => setPennylaneDraft(e.target.checked)}
                    className="mt-1"
                  />
                  <span>
                    Pousser en <strong className="text-cream">brouillon</strong> (le comptable finalise)
                  </span>
                </label>
                {pennylaneMsg && (
                  <p
                    className={
                      pennylaneMsg.includes('impossible') ? 'text-sm text-red-300' : 'text-sm text-emerald-300'
                    }
                  >
                    {pennylaneMsg}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={pennylaneSaving || (!pennylaneConfigured && !pennylaneTokenInput.trim())}
                    onClick={() => void savePennylane()}
                    className="rounded-xl bg-tomato px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
                  >
                    {pennylaneSaving ? 'Enregistrement…' : 'Enregistrer'}
                  </button>
                  {pennylaneConfigured && (
                    <button
                      type="button"
                      disabled={pennylaneSaving}
                      onClick={() => void savePennylane({ clear: true })}
                      className="rounded-xl border border-white/15 px-4 py-2.5 text-sm text-cream/70"
                    >
                      Supprimer le token
                    </button>
                  )}
                </div>
              </ConfigBox>
            )}

            {sheet.id === 'pennylane' && pennylaneConfigured && (
              <ConfigBox title="Dépenses fournisseurs (lecture Pennylane)">
                <p className="text-sm text-cream/60">
                  Récupère les factures fournisseurs Pennylane — alimente le futur tableau de bord ventes vs
                  dépenses.
                </p>
                {pennylaneExpenseMsg && (
                  <p
                    className={
                      pennylaneExpenseMsg.includes('impossible')
                        ? 'text-sm text-red-300'
                        : 'text-sm text-emerald-300'
                    }
                  >
                    {pennylaneExpenseMsg}
                  </p>
                )}
                <button
                  type="button"
                  disabled={pennylaneExpenseSyncing}
                  onClick={() => void syncPennylaneExpenses()}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-sm text-cream hover:bg-white/5 disabled:opacity-50"
                >
                  {pennylaneExpenseSyncing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  Synchroniser les dépenses
                </button>
                {unpaidSupplierInvoices.length > 0 && (
                  <ul className="space-y-1.5">
                    {unpaidSupplierInvoices.map((inv) => (
                      <li
                        key={inv.id}
                        className="flex items-center justify-between rounded-lg border border-white/5 bg-black/25 px-3 py-2 text-xs"
                      >
                        <span className="text-cream/70">
                          {inv.label ?? inv.invoiceNumber ?? 'Facture fournisseur'}
                          {inv.date ? ` · ${new Date(inv.date).toLocaleDateString('fr-FR')}` : ''}
                        </span>
                        <span className="font-mono text-cream">{formatEUR(inv.amountCents)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </ConfigBox>
            )}

            {sheet.id === 'sumup-reader' && sumupConfigured && (
              <ConfigBox title="Ventes comptoir (lecture SumUp)">
                <p className="text-sm text-cream/60">
                  Récupère l’historique des ventes comptoir (CB / espèces) — nécessaire pour émettre une
                  facture à la demande depuis <span className="text-cream">Facturation</span>.
                </p>
                {sumupTxnMsg && (
                  <p
                    className={sumupTxnMsg.includes('impossible') ? 'text-sm text-red-300' : 'text-sm text-emerald-300'}
                  >
                    {sumupTxnMsg}
                  </p>
                )}
                <button
                  type="button"
                  disabled={sumupTxnSyncing}
                  onClick={() => void syncSumupTransactionsFromIntegrations()}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-sm text-cream hover:bg-white/5 disabled:opacity-50"
                >
                  {sumupTxnSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Synchroniser les ventes comptoir
                </button>
              </ConfigBox>
            )}

            {sheet.id === 'sumup-reader' && (
              <div className="rounded-xl border border-tomato/25 bg-tomato/5 p-3 text-xs text-cream/70">
                <p className="mb-1 flex items-center gap-1.5 font-semibold text-tomato-light">
                  <ChefHat className="h-3.5 w-3.5" /> Chaîne boutique
                </p>
                Lecteur SumUp → paiement → ticket → cuisine.
              </div>
            )}
          </div>
        )}
      </SideSheet>
    </AdminPageShell>
  )
}
