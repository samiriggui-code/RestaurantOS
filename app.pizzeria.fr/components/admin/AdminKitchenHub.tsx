'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ChefHat,
  ExternalLink,
  Loader2,
  Monitor,
  Settings,
  Smartphone,
  Users,
} from 'lucide-react'
import { AdminKitchenConfigView } from '@/components/admin/AdminKitchenConfigView'
import {
  AdminMonitorBanner,
  AdminPageHeader,
  AdminSectionTabs,
} from '@/components/admin/AdminSectionTabs'
import { ADMIN_STAT_GRID, AdminStatCard } from '@/components/admin/AdminStatCard'
import { getStaffSession } from '@/lib/staff-auth'
import {
  fetchKitchenOrders,
  isKitchenVisibleOrder,
  kanbanColumnForStatus,
  ORDER_KANBAN_COLUMNS,
  type OpsOrder,
} from '@/lib/ops-orders'
import { getKitchenSocket, joinBusinessRoom, releaseKitchenSocket, retainKitchenSocket } from '@/lib/socket'

type HubTab = 'overview' | 'settings'

export function AdminKitchenHub() {
  const [tab, setTab] = useState<HubTab>('overview')

  const tabs = [
    { id: 'overview' as const, label: 'Vue d\'ensemble', icon: Monitor },
    { id: 'settings' as const, label: 'Paramètres KDS', icon: Settings },
  ]

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] min-h-0 flex-col">
      <div className="shrink-0 border-b border-white/10 px-4 py-4 md:px-6">
        <AdminPageHeader
          title="Suivi cuisine"
          description="Le CRM pilote et observe ; le KDS boutique (/kitchen) exécute en salle avec PIN équipe."
          actions={
            <AdminSectionTabs tabs={tabs} active={tab} onChange={setTab} />
          }
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === 'overview' ? <KitchenOverviewPanel /> : <AdminKitchenConfigView embedded />}
      </div>
    </div>
  )
}

function KitchenOverviewPanel() {
  const [orders, setOrders] = useState<OpsOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [connected, setConnected] = useState(false)

  const refresh = useCallback(async () => {
    const session = getStaffSession('crm')
    if (!session) return
    try {
      const data = await fetchKitchenOrders(session.token)
      setOrders(data.filter(isKitchenVisibleOrder))
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

  const byColumn = useMemo(() => {
    const map: Record<string, number> = {}
    for (const col of ORDER_KANBAN_COLUMNS) map[col.id] = 0
    for (const o of orders) {
      const col = kanbanColumnForStatus(o.status).id
      map[col] = (map[col] ?? 0) + 1
    }
    return map
  }, [orders])

  const prepCount = (byColumn.todo ?? 0) + (byColumn.prep ?? 0)

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <AdminMonitorBanner
        href="/monitor/kitchen"
        title="Moniteur cuisine temps réel"
        description="Kanban plein écran — s'ouvre dans une fenêtre dédiée (pas un onglet)."
        icon={ChefHat}
      />

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-tomato-light" />
        </div>
      ) : (
        <>
          <div className={ADMIN_STAT_GRID}>
            <AdminStatCard
              label="En cuisine"
              value={orders.length}
              sub={connected ? 'Socket connecté' : 'Reconnexion…'}
              icon={ChefHat}
              tone="text-tomato-light"
            />
            <AdminStatCard
              label="À préparer"
              value={prepCount}
              sub="Nouvelles + en préparation"
              tone="text-amber-300"
            />
            <AdminStatCard
              label="Prêtes"
              value={byColumn.ready ?? 0}
              sub="En attente retrait / service"
              tone="text-emerald-300"
            />
            <AdminStatCard
              label="Connexion"
              value={connected ? 'Live' : 'Offline'}
              sub="Même flux que la tablette KDS"
              tone={connected ? 'text-emerald-300' : 'text-cream/50'}
            />
          </div>

          {orders.length > 0 && (
            <section className="rounded-2xl border border-white/10 bg-[#1A1412] p-5">
              <h2 className="mb-3 text-sm font-semibold text-cream">Dernières commandes actives</h2>
              <ul className="divide-y divide-white/10 text-sm">
                {orders.slice(0, 5).map((o) => (
                  <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <span className="font-medium text-cream">#{o.orderNumber}</span>
                    <span className="text-cream/45">{o.status}</span>
                    <span className="text-xs text-cream/35">
                      {o.items?.length ?? 0} ligne{(o.items?.length ?? 0) > 1 ? 's' : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      <section className="grid gap-4 md:grid-cols-2">
        <InfoCard
          icon={Smartphone}
          title="Tablette boutique (/kitchen)"
          body="Écran tactile en cuisine : PIN staff, jumelage CRM, pointage équipe, changement de statuts et impression tickets."
          href="/admin/devices"
          linkLabel="Configurer appareils"
        />
        <InfoCard
          icon={Users}
          title="Planning & équipe"
          body="Le pointage et l'équipe du jour se gèrent dans le planning — pas dans le moniteur CRM."
          href="/admin/planning"
          linkLabel="Planning équipe"
        />
      </section>

      <p className="text-xs text-cream/35">
        Relation : commande confirmée (webhook SumUp ou comptoir) → Socket.io → KDS + moniteur CRM.
        Les statuts modifiés sur la tablette se reflètent ici en temps réel.
      </p>
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
  icon: typeof ChefHat
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
