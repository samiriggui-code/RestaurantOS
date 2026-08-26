'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
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
  ShoppingBag,
  Tablet,
  Wallet,
  XCircle,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { AdminPageHeader, AdminPageShell } from '@/components/admin/AdminSectionTabs'
import { SideSheet } from '@/components/ui/side-sheet'
import { getApiBase } from '@/lib/api-base'
import { opsSitePath, publicSitePath } from '@/lib/ops-apps'
import { getStaffSession } from '@/lib/staff-auth'
import { staffFetch } from '@/lib/staff-api'
import { cn } from '@/lib/cn'

type ProviderStatus = 'connected' | 'action' | 'disconnected'

type MarketplaceRow = {
  id: 'deliveroo' | 'ubereats'
  configured: boolean
  enabled: boolean
  lastWebhookAt: string | null
  lastOrderAt: string | null
  lastError: string | null
  orderCount: number
}

type IntegrationsPayload = {
  sumupOnlineConfigured?: boolean
  sumupWebhookUrl?: string | null
  marketplaces?: MarketplaceRow[]
}

type IntegrationId =
  | 'deliveroo'
  | 'ubereats'
  | 'sumup-online'
  | 'sumup-csv'
  | 'epson'
  | 'sumup-reader'
  | 'totem'
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
  secretHint?: string
  stats?: MarketplaceRow
  samplePayload?: string
}

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

function marketplaceStatus(row: MarketplaceRow | undefined): ProviderStatus {
  if (!row) return 'disconnected'
  if (row.configured && row.orderCount > 0) return 'connected'
  if (row.configured) return 'action'
  return 'disconnected'
}

function formatFr(iso: string | null | undefined): string | null {
  if (!iso) return null
  try {
    return new Date(iso).toLocaleString('fr-FR')
  } catch {
    return null
  }
}

function webhookOrigin(): string {
  return getApiBase().replace(/\/api\/?$/, '')
}

const MARKETPLACE_SAMPLE = `{
  "event": "order.new",
  "externalId": "dro-123",
  "order": {
    "type": "DELIVERY",
    "customerName": "…",
    "customerPhone": "…",
    "addressLine": "…",
    "postalCode": "…",
    "city": "…",
    "lines": [{ "name": "Margherita", "quantity": 1, "unitCents": 1200 }],
    "deliveryFeeCents": 250,
    "totalCents": 1450
  }
}`

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

export function AdminIntegrationsView() {
  const [sumupOnlineConfigured, setSumupOnlineConfigured] = useState(false)
  const [sumupWebhookUrl, setSumupWebhookUrl] = useState<string | null>(null)
  const [marketplaces, setMarketplaces] = useState<MarketplaceRow[]>([])
  const [pennylaneConfigured, setPennylaneConfigured] = useState(false)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState<string | null>(null)
  const [active, setActive] = useState<IntegrationId | null>(null)

  const load = useCallback(async () => {
    const session = getStaffSession()
    if (!session) return
    setLoading(true)
    try {
      const [data, pennylane] = await Promise.all([
        staffFetch<IntegrationsPayload>('/settings/integrations', { token: session.token }),
        staffFetch<{ configured: boolean }>('/invoices/pennylane/status', { token: session.token }).catch(
          () => ({ configured: false }),
        ),
      ])
      setSumupOnlineConfigured(Boolean(data.sumupOnlineConfigured))
      setSumupWebhookUrl(data.sumupWebhookUrl ?? null)
      setMarketplaces(data.marketplaces ?? [])
      setPennylaneConfigured(Boolean(pennylane.configured))
    } catch {
      setSumupOnlineConfigured(false)
      setSumupWebhookUrl(null)
      setMarketplaces([])
      setPennylaneConfigured(false)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const base = useMemo(() => webhookOrigin(), [])
  const webhookBase = `${base}/api/public/webhooks`
  const deliveroo = marketplaces.find((m) => m.id === 'deliveroo')
  const ubereats = marketplaces.find((m) => m.id === 'ubereats')

  const sheets: Record<IntegrationId, SheetContent> = {
    deliveroo: {
      id: 'deliveroo',
      subtitle: 'Marketplace',
      title: 'Deliveroo',
      status: marketplaceStatus(deliveroo),
      summary:
        'Les commandes Deliveroo arrivent dans la même file que le site et le POS (canal DELIVEROO), avec ticket cuisine et suivi KDS.',
      steps: [
        'Sur le serveur, définir la variable DELIVEROO_WEBHOOK_SECRET.',
        'Copier l’URL webhook ci-dessous et la déclarer dans le portail partenaire Deliveroo.',
        'Auth : Authorization Bearer <secret> ou X-Webhook-Signature (HMAC SHA-256).',
        'Envoyer une commande test : le statut passe à Connecté dès la 1ʳᵉ réception.',
        'Contrôler le flux dans Commandes (filtre canal Deliveroo) et sur le KDS.',
      ],
      links: [
        { href: '/admin/orders', label: 'Voir les commandes' },
        { href: '/kitchen', label: 'Ouvrir le KDS', external: true },
        { href: '/admin/devices', label: 'Imprimantes & appareils' },
      ],
      webhookUrl: `${webhookBase}/deliveroo`,
      secretHint: 'DELIVEROO_WEBHOOK_SECRET',
      stats: deliveroo,
      samplePayload: MARKETPLACE_SAMPLE,
    },
    ubereats: {
      id: 'ubereats',
      subtitle: 'Marketplace',
      title: 'Uber Eats',
      status: marketplaceStatus(ubereats),
      summary:
        'Même pipeline unifié que Deliveroo : webhook → commande native → cuisine / impression / caisse du jour.',
      steps: [
        'Définir UBER_EATS_WEBHOOK_SECRET sur le serveur.',
        'Enregistrer l’URL webhook Uber Eats (copier ci-dessous).',
        'Valider l’auth Bearer ou signature HMAC.',
        'Tester une commande ; vérifier le badge canal UBER_EATS.',
        'Suivre préparation sur KDS et archive admin.',
      ],
      links: [
        { href: '/admin/orders', label: 'Voir les commandes' },
        { href: '/kitchen', label: 'Ouvrir le KDS', external: true },
        { href: '/admin/devices', label: 'Imprimantes & appareils' },
      ],
      webhookUrl: `${webhookBase}/ubereats`,
      secretHint: 'UBER_EATS_WEBHOOK_SECRET',
      stats: ubereats,
      samplePayload: MARKETPLACE_SAMPLE,
    },
    'sumup-online': {
      id: 'sumup-online',
      subtitle: 'Paiement web',
      title: 'SumUp — site public',
      status: sumupOnlineConfigured ? 'connected' : 'action',
      summary:
        'Checkout carte sur le site client (pizzeria.fr). Confirmation via webhook Express : PENDING_PAYMENT → CONFIRMED.',
      steps: [
        'Renseigner les clés SumUp et API_PUBLIC_BASE_URL (paramètres serveur / .env).',
        'Vérifier l’URL de retour webhook affichée ici.',
        'Passer une commande test sur le site public.',
        'Contrôler que la commande apparaît en cuisine une fois payée.',
      ],
      links: [
        { href: '/admin/settings', label: 'Paramètres boutique' },
        { href: publicSitePath('/commander'), label: 'Ouvrir le site commander', external: true },
        { href: '/admin/orders', label: 'Commandes web' },
      ],
      webhookUrl: sumupOnlineConfigured ? sumupWebhookUrl : null,
    },
    'sumup-csv': {
      id: 'sumup-csv',
      subtitle: 'Caisse SumUp',
      title: 'Import articles (CSV)',
      status: 'action',
      summary:
        'Pas de sync live avec la caisse SumUp / Tiller. Contournement : importer le « Rapport-articles » pour réconcilier stock et ventes hors RestaurantOS.',
      steps: [
        'Exporter le rapport articles depuis la caisse SumUp.',
        'Aller dans Stock → Import Caisse SumUp.',
        'Importer le CSV pour ajuster l’inventaire.',
        'Les canaux Uber / Deliveroo / site ne sont pas remplacés par cet import.',
      ],
      links: [{ href: '/admin/stock', label: 'Stock → Import Caisse SumUp' }],
    },
    epson: {
      id: 'epson',
      subtitle: 'Matériel',
      title: 'Imprimantes Epson',
      status: 'connected',
      summary: 'Tickets caisse, cuisine et livraison via TCP 9100 sur le réseau boutique.',
      steps: [
        'Brancher les Epson sur le LAN boutique.',
        'Dans Devices & boutiques → Réseau & imprimantes, saisir les IP cuisine / comptoir.',
        'Lancer un test d’impression depuis la fiche appareil (POS ou KDS).',
        'Vérifier qu’une commande CONFIRMED déclenche bien le PrintJob.',
      ],
      links: [
        { href: '/admin/devices', label: 'Devices & boutiques' },
        { href: '/pos', label: 'Ouvrir la caisse', external: true },
      ],
    },
    'sumup-reader': {
      id: 'sumup-reader',
      subtitle: 'Terminal CB',
      title: 'Lecteur SumUp (POS / Totem)',
      status: 'action',
      summary:
        'Paiement carte en boutique : le serveur pilote le lecteur SumUp Solo (Wi‑Fi). Utilisé par la caisse et le totem.',
      steps: [
        'Jumeler le lecteur SumUp dans Devices (ou paramètres caisse).',
        'Vérifier que le lecteur est ONLINE (statut SumUp).',
        'Sur POS ou Totem, choisir Paiement carte → le client présente la carte.',
        'La commande est créée PAID + CONFIRMED et part en cuisine.',
      ],
      links: [
        { href: '/admin/devices', label: 'Configurer le lecteur' },
        { href: '/pos', label: 'Tester sur la caisse', external: true },
        { href: opsSitePath('/kiosk'), label: 'Tester sur le totem', external: true },
      ],
    },
    totem: {
      id: 'totem',
      subtitle: 'Self-service boutique',
      title: 'Totem kiosque',
      status: 'connected',
      summary:
        'Écran client en boutique : panier, tailles pizza, paiement CB/espèces, ticket, envoi KDS (canal KIOSK).',
      steps: [
        'Ouvrir le totem sur une tablette (réseau boutique).',
        'Déverrouiller avec le PIN caisse (session staff).',
        'Le client compose → Payer & envoyer en cuisine.',
        'Paiement SumUp / espèces → commande PAID → ticket + KDS.',
        'Suivre le parc (présence totem) dans Devices → Parc périphériques.',
      ],
      links: [
        { href: opsSitePath('/kiosk'), label: 'Ouvrir le totem', external: true },
        { href: '/admin/devices', label: 'Parc & imprimantes' },
        { href: '/kitchen', label: 'Vérifier le KDS', external: true },
        { href: '/admin/orders', label: 'Commandes totem' },
      ],
    },
    fiscal: {
      id: 'fiscal',
      subtitle: 'Conformité',
      title: 'Module fiscal ISCA',
      status: 'connected',
      summary: 'Chaînage des tickets, clôtures Z, journal et archivage — obligatoire pour les ventes payées.',
      steps: [
        'Contrôler l’intégrité de la chaîne dans Fiscal ISCA.',
        'Effectuer la clôture Z en fin de service (Caisse & Z du jour).',
        'Exporter / archiver selon la procédure labo ou prod.',
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
      status: 'action',
      summary: 'Backups Postgres / exports fiscaux vers MinIO (ou S3) — configuration serveur VPS.',
      steps: [
        'Vérifier MINIO_* dans le .env VPS.',
        'Lancer un backup test via les scripts deploy.',
        'Contrôler le bucket pizzeria-backups.',
      ],
      links: [{ href: '/admin/fiscal', label: 'Exports fiscaux' }],
    },
    pennylane: {
      id: 'pennylane',
      subtitle: 'Comptabilité',
      title: 'Pennylane',
      status: pennylaneConfigured ? 'connected' : 'action',
      summary:
        'Pont comptable : envoie une facture émise (ISSUED) vers Pennylane comme facture client. Poussée en brouillon par défaut — le comptable relit et finalise dans Pennylane avant émission légale.',
      steps: [
        'Générer un token API dans Pennylane → Paramètres → API.',
        'Renseigner PENNYLANE_API_TOKEN côté serveur (variable d’environnement).',
        'Ouvrir une facture émise dans Facturation, puis « Envoyer vers Pennylane ».',
        'Vérifier côté Pennylane : client créé/retrouvé automatiquement, facture en brouillon.',
        'Le comptable relit et finalise — aucune émission automatique sans relecture.',
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
        subtitle="Marketplaces, paiements et matériel boutique — une fiche claire par canal, avec procédure et liens utiles."
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
        Cliquez une carte pour ouvrir le détail : étapes de connexion, webhooks, et raccourcis vers Devices,
        Stock, Fiscal ou les apps (POS, KDS, Totem).
      </p>

      <Section title="Marketplaces">
        <IntegrationCard
          icon={ShoppingBag}
          title="Deliveroo"
          blurb="Webhook → commande unifiée, KDS et tickets."
          status={marketplaceStatus(deliveroo)}
          onOpen={() => setActive('deliveroo')}
        />
        <IntegrationCard
          icon={ShoppingBag}
          title="Uber Eats"
          blurb="Même file cuisine que le site et le comptoir."
          status={marketplaceStatus(ubereats)}
          onOpen={() => setActive('ubereats')}
        />
      </Section>

      <Section title="Paiements">
        <IntegrationCard
          icon={Wallet}
          title="SumUp — site public"
          blurb="Checkout carte en ligne + webhook de confirmation."
          status={sumupOnlineConfigured ? 'connected' : 'action'}
          onOpen={() => setActive('sumup-online')}
        />
        <IntegrationCard
          icon={CreditCard}
          title="Lecteur SumUp boutique"
          blurb="TPE Wi‑Fi pour POS et totem (paiement sur place)."
          status="action"
          onOpen={() => setActive('sumup-reader')}
        />
        <IntegrationCard
          icon={FileSpreadsheet}
          title="Import CSV caisse SumUp"
          blurb="Réconciliation stock des ventes hors RestaurantOS."
          status="action"
          onOpen={() => setActive('sumup-csv')}
        />
      </Section>

      <Section title="Parc boutique">
        <IntegrationCard
          icon={Tablet}
          title="Totem kiosque"
          blurb="Self-service : panier, CB, ticket, envoi cuisine."
          status="connected"
          onOpen={() => setActive('totem')}
        />
        <IntegrationCard
          icon={Printer}
          title="Imprimantes Epson"
          blurb="IP LAN cuisine / comptoir — tests depuis Devices."
          status="connected"
          onOpen={() => setActive('epson')}
        />
        <IntegrationCard
          icon={MonitorSmartphone}
          title="Devices & jumelage"
          blurb="POS, KDS, réseau boutique — hub matériel."
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
          title="Sauvegardes MinIO"
          blurb="Backups Postgres et archives fiscales."
          status="action"
          onOpen={() => setActive('backups')}
        />
      </Section>

      <Section title="Comptabilité">
        <IntegrationCard
          icon={Landmark}
          title="Pennylane"
          blurb="Envoi des factures émises vers le logiciel comptable."
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
              {sheet.secretHint && !sheet.stats?.configured ? (
                <span className="text-[11px] text-amber-300/90">
                  Secret serveur : <code className="text-cream/70">{sheet.secretHint}</code>
                </span>
              ) : null}
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
                <p className="mt-2 text-[10px] text-cream/40">
                  Auth : <code className="text-cream/55">Authorization: Bearer &lt;secret&gt;</code> ou{' '}
                  <code className="text-cream/55">X-Webhook-Signature</code>
                </p>
              </div>
            ) : null}

            {sheet.stats?.configured ? (
              <dl className="grid grid-cols-2 gap-2 rounded-xl border border-white/5 bg-black/25 p-3 text-xs">
                <div>
                  <dt className="text-cream/40">Commandes reçues</dt>
                  <dd className="font-mono text-lg text-cream">{sheet.stats.orderCount}</dd>
                </div>
                <div>
                  <dt className="text-cream/40">Dernière commande</dt>
                  <dd className="text-cream/80">{formatFr(sheet.stats.lastOrderAt) ?? '—'}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-cream/40">Dernier webhook</dt>
                  <dd className="text-cream/80">{formatFr(sheet.stats.lastWebhookAt) ?? 'en attente'}</dd>
                </div>
                {sheet.stats.lastError ? (
                  <div className="col-span-2 text-amber-300">Erreur : {sheet.stats.lastError}</div>
                ) : null}
              </dl>
            ) : null}

            {sheet.samplePayload ? (
              <div>
                <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-cream/40">
                  Exemple de payload (test)
                </h3>
                <pre className="overflow-x-auto rounded-xl border border-white/10 bg-black/40 p-3 font-mono text-[10px] leading-relaxed text-cream/55">
                  {sheet.samplePayload}
                </pre>
              </div>
            ) : null}

            {(sheet.id === 'totem' || sheet.id === 'sumup-reader') && (
              <div className="rounded-xl border border-tomato/25 bg-tomato/5 p-3 text-xs text-cream/70">
                <p className="mb-1 flex items-center gap-1.5 font-semibold text-tomato-light">
                  <ChefHat className="h-3.5 w-3.5" /> Chaîne boutique
                </p>
                Totem / POS → paiement → ticket → KDS. Tout part du même socle commandes (canal KIOSK ou POS).
              </div>
            )}
          </div>
        )}
      </SideSheet>
    </AdminPageShell>
  )
}
