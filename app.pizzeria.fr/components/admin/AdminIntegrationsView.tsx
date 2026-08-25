'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
  Plug,
  RefreshCw,
  XCircle,
} from 'lucide-react'
import { AdminPageHeader, AdminPageShell } from '@/components/admin/AdminSectionTabs'
import { getApiBase } from '@/lib/api-base'
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

function StatusBadge({ status }: { status: ProviderStatus }) {
  const map = {
    connected: {
      label: 'Connecté',
      className: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
      Icon: CheckCircle2,
    },
    action: {
      label: 'Action requise',
      className: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
      Icon: ExternalLink,
    },
    disconnected: {
      label: 'Déconnecté',
      className: 'border-red-500/40 bg-red-500/10 text-cream/70',
      Icon: XCircle,
    },
  }
  const { label, className, Icon } = map[status]
  return (
    <span className={cn('flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px]', className)}>
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

type Benefit = { label: string; detail: string }

function BenefitsList({ items }: { items: Benefit[] }) {
  return (
    <ul className="mt-3 space-y-1.5 border-t border-white/5 pt-3">
      {items.map((b) => (
        <li key={b.label} className="text-[11px] leading-snug text-cream/55">
          <span className="font-medium text-cream/75">{b.label}</span>
          <span className="text-cream/40"> — {b.detail}</span>
        </li>
      ))}
    </ul>
  )
}

function LiveStats({ row }: { row: MarketplaceRow | undefined }) {
  if (!row?.configured) return null
  const lastWh = formatFr(row.lastWebhookAt)
  const lastOrd = formatFr(row.lastOrderAt)
  return (
    <dl className="mt-3 grid grid-cols-2 gap-2 rounded-lg border border-white/5 bg-black/25 p-2.5 text-[10px]">
      <div>
        <dt className="text-cream/40">Commandes reçues</dt>
        <dd className="font-mono text-sm text-cream">{row.orderCount}</dd>
      </div>
      <div>
        <dt className="text-cream/40">Dernière commande</dt>
        <dd className="text-cream/80">{lastOrd ?? '—'}</dd>
      </div>
      <div className="col-span-2">
        <dt className="text-cream/40">Dernier webhook</dt>
        <dd className="text-cream/80">{lastWh ?? 'en attente'}</dd>
      </div>
      {row.lastError ? (
        <div className="col-span-2 text-amber-300/90">Dernière erreur : {row.lastError}</div>
      ) : null}
    </dl>
  )
}

export function AdminIntegrationsView() {
  const [sumupOnlineConfigured, setSumupOnlineConfigured] = useState(false)
  const [sumupWebhookUrl, setSumupWebhookUrl] = useState<string | null>(null)
  const [marketplaces, setMarketplaces] = useState<MarketplaceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState<string | null>(null)

  const load = useCallback(async () => {
    const session = getStaffSession()
    if (!session) return
    setLoading(true)
    try {
      const data = await staffFetch<IntegrationsPayload>('/settings/integrations', { token: session.token })
      setSumupOnlineConfigured(Boolean(data.sumupOnlineConfigured))
      setSumupWebhookUrl(data.sumupWebhookUrl ?? null)
      setMarketplaces(data.marketplaces ?? [])
    } catch {
      setSumupOnlineConfigured(false)
      setSumupWebhookUrl(null)
      setMarketplaces([])
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

  const marketplaceBenefits: Benefit[] = [
    {
      label: 'Commande unifiée',
      detail: 'statut CONFIRMED, payée (THIRD_PARTY), badge canal KDS / POS / caisse du jour',
    },
    {
      label: 'Client & livraison',
      detail: 'nom, téléphone, adresse, frais livraison, notes, créneau éventuel',
    },
    {
      label: 'Cuisine',
      detail: 'lignes article + Socket.io + tickets cuisine auto',
    },
    {
      label: 'Suivi intégration',
      detail: 'compteur commandes, horodatage dernier webhook / dernière commande, dernière erreur',
    },
  ]

  function copy(text: string, id: string) {
    void navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 1500)
  }

  function WebhookBlock({ id, url }: { id: string; url: string }) {
    return (
      <div className="mb-1 rounded-lg border border-white/5 bg-black/30 p-2">
        <p className="mb-1 text-[9px] uppercase tracking-widest text-cream/40">Webhook URL</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 truncate font-mono text-[10px] text-tomato-light">{url}</code>
          <button
            type="button"
            onClick={() => copy(url, id)}
            className="rounded bg-white/5 p-1 hover:bg-white/10"
            aria-label="Copier"
          >
            <Copy className="h-3 w-3 text-cream/60" />
          </button>
        </div>
        {copied === id && <p className="mt-1 text-[10px] text-emerald-400">Copié</p>}
        <p className="mt-2 text-[9px] text-cream/35">
          Auth : <code className="text-cream/50">Authorization: Bearer &lt;secret&gt;</code> ou{' '}
          <code className="text-cream/50">X-Webhook-Signature</code> (HMAC SHA-256).
        </p>
      </div>
    )
  }

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Intégrations"
        subtitle="Canaux marketplace, paiement site public, matériel et conformité — alignés sur le socle commandes unifié."
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

      <section className="mb-8">
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-cream/45">
          Marketplaces
        </h2>
        <div className="grid gap-4 lg:grid-cols-2">
          {(
            [
              {
                id: 'deliveroo' as const,
                name: 'Deliveroo',
                channel: 'DELIVEROO',
                row: deliveroo,
                secretHint: 'DELIVEROO_WEBHOOK_SECRET',
                webhook: `${webhookBase}/deliveroo`,
              },
              {
                id: 'ubereats' as const,
                name: 'Uber Eats',
                channel: 'UBER_EATS',
                row: ubereats,
                secretHint: 'UBER_EATS_WEBHOOK_SECRET',
                webhook: `${webhookBase}/ubereats`,
              },
            ] as const
          ).map((p) => (
            <div key={p.id} className="rounded-xl border border-white/10 bg-[#1A1412] p-5">
              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-cream/40">Marketplace</p>
                  <p className="font-display text-lg text-cream">{p.name}</p>
                  <p className="mt-0.5 font-mono text-[10px] text-cream/40">canal {p.channel}</p>
                </div>
                <StatusBadge status={marketplaceStatus(p.row)} />
              </div>
              <p className="mb-2 text-xs text-cream/55">
                Webhook partenaire → commande native RestaurantOS (même file cuisine / POS que le site et le
                comptoir).
              </p>
              {!p.row?.configured ? (
                <p className="mb-3 text-[11px] text-amber-300/90">
                  Définir <code className="text-cream/70">{p.secretHint}</code> sur le serveur, puis déclarer
                  l’URL webhook chez le partenaire.
                </p>
              ) : p.row.orderCount === 0 ? (
                <p className="mb-3 text-[11px] text-emerald-300/80">
                  Secret OK — en attente du premier webhook partenaire.
                </p>
              ) : null}
              <WebhookBlock id={p.id} url={p.webhook} />
              <LiveStats row={p.row} />
              <BenefitsList items={marketplaceBenefits} />
            </div>
          ))}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-cream/45">
          Paiement
        </h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-[#1A1412] p-5">
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-cream/40">Paiement</p>
                <p className="font-display text-lg text-cream">SumUp (site public)</p>
              </div>
              <StatusBadge status={sumupOnlineConfigured ? 'connected' : 'action'} />
            </div>
            <p className="mb-2 text-xs text-cream/55">
              Checkout carte sur pizzeria.fr — pas la caisse SumUp / Tiller. Confirmation via webhook Express.
            </p>
            <p className="mb-3 text-[11px] text-cream/50">
              {sumupOnlineConfigured
                ? 'Clés + API_PUBLIC_BASE_URL OK'
                : 'Clés SumUp ou API_PUBLIC_BASE_URL manquants (réglages serveur / admin)'}
            </p>
            {sumupOnlineConfigured && sumupWebhookUrl ? (
              <WebhookBlock id="sumup-online" url={sumupWebhookUrl} />
            ) : null}
            <BenefitsList
              items={[
                {
                  label: 'Commande web',
                  detail: 'PENDING_PAYMENT → payée / CONFIRMED après webhook checkout',
                },
                {
                  label: 'Retour client',
                  detail: 'return_url + suivi commande (trackingToken)',
                },
                {
                  label: 'Ops boutique',
                  detail: 'même file KDS / impression que les autres canaux une fois confirmée',
                },
              ]}
            />
            <Link
              href="/admin/settings"
              className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-tomato-light hover:underline"
            >
              <Plug className="h-3 w-3" /> Configurer
            </Link>
          </div>

          <div className="rounded-xl border border-white/10 bg-[#1A1412] p-5">
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-cream/40">Caisse SumUp</p>
                <p className="font-display text-lg text-cream">Import articles (CSV)</p>
              </div>
              <StatusBadge status="action" />
            </div>
            <p className="mb-2 text-xs text-cream/55">
              Pas de webhook live vers POS Pro / Tiller. Contournement : import « Rapport-articles » pour
              synchroniser stock / ventes invisibles au comptoir SumUp.
            </p>
            <BenefitsList
              items={[
                {
                  label: 'Stock',
                  detail: 'lignes vendues hors RestaurantOS → ajustement inventaire',
                },
                {
                  label: 'Cohérence',
                  detail: 'complète le canal SumUp site (ci-contre), sans remplacer Uber / Deliveroo',
                },
              ]}
            />
            <Link
              href="/admin/stock"
              className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-tomato-light hover:underline"
            >
              <Plug className="h-3 w-3" /> Stock → Import Caisse SumUp
            </Link>
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-cream/45">
          Boutique & conformité
        </h2>
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-[#1A1412] p-5">
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-cream/40">Matériel</p>
                <p className="font-display text-lg text-cream">Imprimantes Epson</p>
              </div>
              <StatusBadge status="connected" />
            </div>
            <p className="text-xs text-cream/55">Tickets caisse, cuisine, livraison — TCP 9100 LAN.</p>
            <Link
              href="/admin/devices"
              className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-tomato-light hover:underline"
            >
              <Plug className="h-3 w-3" /> Appareils
            </Link>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#1A1412] p-5">
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-cream/40">Conformité</p>
                <p className="font-display text-lg text-cream">Module fiscal ISCA</p>
              </div>
              <StatusBadge status="connected" />
            </div>
            <p className="text-xs text-cream/55">Chaînage tickets, clôtures Z, journal, archivage.</p>
            <Link
              href="/admin/fiscal"
              className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-tomato-light hover:underline"
            >
              <Plug className="h-3 w-3" /> Fiscal
            </Link>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#1A1412] p-5">
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-cream/40">Stockage</p>
                <p className="font-display text-lg text-cream">Archivage sauvegardes</p>
              </div>
              <StatusBadge status="action" />
            </div>
            <p className="text-xs text-cream/55">Exports fiscaux / backups VPS (MinIO · S3) — config serveur.</p>
          </div>
        </div>
      </section>

      <div className="mt-8 rounded-xl border border-white/10 bg-black/20 p-4 text-xs text-cream/50">
        <p className="mb-2 font-medium text-cream/70">Payload marketplace (test)</p>
        <code className="block overflow-x-auto whitespace-pre text-[10px] text-cream/55">{`{
  "event": "order.new",
  "externalId": "dro-123",
  "order": {
    "type": "DELIVERY",
    "customerName": "…",
    "customerPhone": "…",
    "addressLine": "…", "postalCode": "…", "city": "…",
    "lines": [{ "name": "…", "quantity": 1, "unitCents": 1200 }],
    "deliveryFeeCents": 250,
    "totalCents": 1450,
    "notes": "…"
  }
}`}</code>
        <p className="mt-3 leading-relaxed">
          Une fois connectés, Uber / Deliveroo alimentent la même commande que le site : badge canal, file
          cuisine, impression, caisse du jour. SumUp site confirme le paiement en ligne ; l’import CSV SumUp
          (Stock) couvre les ventes caisse hors app.
        </p>
      </div>
    </AdminPageShell>
  )
}
