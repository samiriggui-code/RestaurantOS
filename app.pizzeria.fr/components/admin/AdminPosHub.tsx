'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  CreditCard,
  ExternalLink,
  Loader2,
  Monitor,
  Package,
  Settings,
  Smartphone,
  Store,
  Truck,
} from 'lucide-react'
import { AdminPosConfigView } from '@/components/admin/AdminPosConfigView'
import {
  AdminMonitorBanner,
  AdminPageHeader,
  AdminSectionTabs,
} from '@/components/admin/AdminSectionTabs'
import { ADMIN_STAT_GRID, AdminStatCard } from '@/components/admin/AdminStatCard'
import { getStaffSession } from '@/lib/staff-auth'
import {
  fetchOnlineOrdersForPos,
  fetchPosDeliveryQueue,
  fetchPosHandoverQueue,
  type OpsOrder,
} from '@/lib/ops-orders'
import { getKitchenSocket, joinBusinessRoom, releaseKitchenSocket, retainKitchenSocket } from '@/lib/socket'

type HubTab = 'overview' | 'settings'

export function AdminPosHub() {
  const [tab, setTab] = useState<HubTab>('overview')

  const tabs = [
    { id: 'overview' as const, label: 'Vue d\'ensemble', icon: Monitor },
    { id: 'settings' as const, label: 'Paramètres caisse', icon: Settings },
  ]

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] min-h-0 flex-col">
      <div className="shrink-0 border-b border-white/10 px-4 py-4 md:px-6">
        <AdminPageHeader
          title="Suivi caisse"
          description="Le CRM observe les files d'attente ; le terminal SUNMI (/pos) prend les commandes et encaisse."
          actions={
            <AdminSectionTabs tabs={tabs} active={tab} onChange={setTab} />
          }
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === 'overview' ? <PosOverviewPanel /> : <AdminPosConfigView embedded />}
      </div>
    </div>
  )
}

function PosOverviewPanel() {
  const [online, setOnline] = useState<OpsOrder[]>([])
  const [handover, setHandover] = useState<OpsOrder[]>([])
  const [delivery, setDelivery] = useState<OpsOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [connected, setConnected] = useState(false)

  const refresh = useCallback(async () => {
    const session = getStaffSession('crm')
    if (!session) return
    try {
      const [o, h, d] = await Promise.all([
        fetchOnlineOrdersForPos(session.token),
        fetchPosHandoverQueue(session.token),
        fetchPosDeliveryQueue(session.token),
      ])
      setOnline(o)
      setHandover(h)
      setDelivery(d)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
    const session = getStaffSession('crm')
    if (!session) return

    retainKitchenSocket()
    const socket = getKitchenSocket(session.token)
    const onConnect = () => {
      setConnected(true)
      joinBusinessRoom(socket, session.businessId)
    }
    const onDisconnect = () => setConnected(false)
    const onOrder = () => void refresh()

    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    socket.on('order:new', onOrder)
    socket.on('order:statusUpdate', onOrder)
    socket.on('order:cancelled', onOrder)
    if (socket.connected) onConnect()

    return () => {
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      socket.off('order:new', onOrder)
      socket.off('order:statusUpdate', onOrder)
      socket.off('order:cancelled', onOrder)
      releaseKitchenSocket()
    }
  }, [refresh])

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <AdminMonitorBanner
        href="/monitor/pos"
        title="Moniteur caisse temps réel"
        description="Files en ligne, remise client et livraison — fenêtre dédiée pour supervision."
        icon={Store}
      />

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-tomato-light" />
        </div>
      ) : (
        <div className={ADMIN_STAT_GRID}>
          <AdminStatCard
            label="En ligne à encaisser"
            value={online.length}
            sub="Paiement en ligne validé, attente comptoir"
            icon={CreditCard}
            tone="text-amber-300"
          />
          <AdminStatCard
            label="Prêtes à remettre"
            value={handover.length}
            sub="À emporter / sur place"
            icon={Package}
            tone="text-emerald-300"
          />
          <AdminStatCard
            label="Livraisons actives"
            value={delivery.length}
            sub="File dispatch livreur"
            icon={Truck}
            tone="text-blue-300"
          />
          <AdminStatCard
            label="Connexion"
            value={connected ? 'Live' : 'Offline'}
            sub="Sync avec terminal /pos"
            tone={connected ? 'text-emerald-300' : 'text-cream/50'}
          />
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-2">
        <InfoCard
          icon={Smartphone}
          title="Terminal boutique (/pos)"
          body="SUNMI ou tablette : PIN staff, prise de commande comptoir, encaissement TPE / espèces, impression ticket."
          href="/admin/devices"
          linkLabel="Jumeler un appareil"
        />
        <InfoCard
          icon={Store}
          title="Différence CRM vs caisse"
          body="Le moniteur CRM est en lecture/supervision. Seul le terminal jumelé peut créer des commandes comptoir et encaisser."
          href="/monitor/pos"
          linkLabel="Ouvrir le moniteur"
        />
      </section>
    </div>
  )
}

function InfoCard({
  icon: Icon,
  title,
  body,
  href,
  linkLabel,
}: {
  icon: typeof Store
  title: string
  body: string
  href: string
  linkLabel: string
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="mb-2 flex items-center gap-2 text-cream">
        <Icon className="h-4 w-4 text-tomato-light" />
        <h3 className="font-semibold">{title}</h3>
      </div>
      <p className="text-sm text-cream/50">{body}</p>
      <Link
        href={href}
        className="mt-3 inline-flex items-center gap-1 text-sm text-tomato-light hover:underline"
      >
        {linkLabel}
        <ExternalLink className="h-3.5 w-3.5" />
      </Link>
    </div>
  )
}
