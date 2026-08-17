'use client'

import { useCallback, useEffect, useState } from 'react'
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
  stripeMode?: 'test' | 'live' | 'off'
  marketplaces?: MarketplaceRow[]
}

type Provider = {
  id: string
  name: string
  category: string
  status: ProviderStatus
  desc: string
  webhook?: string
  meta?: string
  settingsHref?: string
}

function StatusBadge({ status }: { status: ProviderStatus }) {
  const map = {
    connected: { label: 'Connecté', className: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300', Icon: CheckCircle2 },
    action: { label: 'Action requise', className: 'border-amber-500/40 bg-amber-500/10 text-amber-300', Icon: ExternalLink },
    disconnected: { label: 'Déconnecté', className: 'border-red-500/40 bg-red-500/10 text-red-300', Icon: XCircle },
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

function marketplaceMeta(row: MarketplaceRow | undefined): string {
  if (!row) return 'Non configuré'
  if (!row.configured) {
    return 'Définir DELIVEROO_WEBHOOK_SECRET ou UBER_EATS_WEBHOOK_SECRET sur le serveur'
  }
  if (row.lastError) return `Dernière erreur : ${row.lastError}`
  if (row.lastOrderAt) {
    return `${row.orderCount} commande(s) — dernière le ${new Date(row.lastOrderAt).toLocaleString('fr-FR')}`
  }
  return 'Secret configuré — en attente du premier webhook partenaire'
}

export function AdminIntegrationsView() {
  const [stripeMode, setStripeMode] = useState<'test' | 'live' | 'off'>('off')
  const [marketplaces, setMarketplaces] = useState<MarketplaceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState<string | null>(null)

  const load = useCallback(async () => {
    const session = getStaffSession()
    if (!session) return
    setLoading(true)
    try {
      const data = await staffFetch<IntegrationsPayload>('/settings/integrations', { token: session.token })
      const mode = data.stripeMode
      setStripeMode(mode === 'live' ? 'live' : mode === 'test' ? 'test' : 'off')
      setMarketplaces(data.marketplaces ?? [])
    } catch {
      setStripeMode('off')
      setMarketplaces([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const origin = typeof window !== 'undefined' ? window.location.origin.replace('app.', 'api.') : 'https://api.pizzeria.fr'
  const webhookBase = `${origin}/api/public/webhooks`
  const deliveroo = marketplaces.find((m) => m.id === 'deliveroo')
  const ubereats = marketplaces.find((m) => m.id === 'ubereats')

  const providers: Provider[] = [
    {
      id: 'deliveroo',
      name: 'Deliveroo',
      category: 'Marketplace',
      status: marketplaceStatus(deliveroo),
      desc: 'Réception commandes via webhook — canal DELIVEROO, impression cuisine auto.',
      webhook: `${webhookBase}/deliveroo`,
      meta: marketplaceMeta(deliveroo),
    },
    {
      id: 'ubereats',
      name: 'Uber Eats',
      category: 'Marketplace',
      status: marketplaceStatus(ubereats),
      desc: 'Réception commandes via webhook — canal UBER_EATS, file cuisine multi-canal.',
      webhook: `${webhookBase}/ubereats`,
      meta: marketplaceMeta(ubereats),
    },
    {
      id: 'stripe',
      name: 'Stripe (paiement en ligne)',
      category: 'Paiement',
      status: stripeMode === 'live' ? 'connected' : stripeMode === 'test' ? 'connected' : 'action',
      desc: 'Payment Element site public + webhooks commandes confirmées.',
      meta: stripeMode === 'live' ? 'Mode LIVE actif' : stripeMode === 'test' ? 'Mode TEST actif' : 'Clés non configurées',
      settingsHref: '/admin/settings',
    },
    {
      id: 'escpos',
      name: 'Imprimantes Epson (LAN)',
      category: 'Matériel',
      status: 'connected',
      desc: 'Tickets caisse, cuisine et livraison via réseau local TCP 9100.',
      meta: 'Configuration dans Appareils & jumelage',
      settingsHref: '/admin/devices',
    },
    {
      id: 'fiscal',
      name: 'Module fiscal ISCA',
      category: 'Conformité',
      status: 'connected',
      desc: 'Chaînage tickets, clôtures Z, journal événements, archivage.',
      meta: 'Actif sur ce tenant',
      settingsHref: '/admin/fiscal',
    },
    {
      id: 'minio',
      name: 'Archivage sauvegardes',
      category: 'Stockage',
      status: 'action',
      desc: 'Export archives fiscales et backups VPS (MinIO / S3).',
      meta: 'Configurer sur le serveur de production',
    },
  ]

  function copy(text: string, id: string) {
    void navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 1500)
  }

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Intégrations"
        subtitle="Marketplaces, paiement, matériel boutique et conformité."
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

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {providers.map((p) => (
          <div key={p.id} className="rounded-xl border border-white/10 bg-[#1A1412] p-5">
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-cream/40">{p.category}</p>
                <p className="font-display text-lg text-cream">{p.name}</p>
              </div>
              <StatusBadge status={p.status} />
            </div>
            <p className="mb-3 text-xs text-cream/55">{p.desc}</p>
            {p.meta && <p className="mb-3 text-[11px] text-emerald-300/80">{p.meta}</p>}
            {p.webhook && (
              <div className="mb-3 rounded-lg border border-white/5 bg-black/30 p-2">
                <p className="mb-1 text-[9px] uppercase tracking-widest text-cream/40">Webhook URL</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 truncate font-mono text-[10px] text-tomato-light">{p.webhook}</code>
                  <button
                    type="button"
                    onClick={() => copy(p.webhook!, p.id)}
                    className="rounded bg-white/5 p-1 hover:bg-white/10"
                    aria-label="Copier"
                  >
                    <Copy className="h-3 w-3 text-cream/60" />
                  </button>
                </div>
                {copied === p.id && <p className="mt-1 text-[10px] text-emerald-400">Copié</p>}
                <p className="mt-2 text-[9px] text-cream/35">
                  Auth : <code className="text-cream/50">Authorization: Bearer &lt;secret&gt;</code> ou header{' '}
                  <code className="text-cream/50">X-Webhook-Signature</code> (HMAC SHA-256 du corps JSON).
                </p>
              </div>
            )}
            {p.settingsHref && (
              <Link
                href={p.settingsHref}
                className="inline-flex items-center gap-1 text-xs font-semibold text-tomato-light hover:underline"
              >
                <Plug className="h-3 w-3" /> Configurer
              </Link>
            )}
          </div>
        ))}
      </div>

      <p className="mt-6 text-xs text-cream/40">
        Payload webhook normalisé (test) :{' '}
        <code className="text-cream/55">{`{ "event": "order.new", "externalId": "dro-123", "order": { ... } }`}</code>
        . Les commandes arrivent en <strong className="text-cream/60">CONFIRMED</strong> avec badge canal dans
        cuisine, POS et caisse du jour.
      </p>
    </AdminPageShell>
  )
}
