'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useFeedbackState } from '@/lib/use-feedback-state'
import Link from 'next/link'
import {
  Bell,
  CheckCircle2,
  ExternalLink,
  Loader2,
  MapPin,
  RefreshCw,
  Smartphone,
  Truck,
  AlertTriangle,
} from 'lucide-react'
import { DeliveryLiveMapLazy } from '@/components/admin/DeliveryLiveMapLazy'
import type { LatLng } from '@/lib/delivery-map-route'
import { getStaffSession } from '@/lib/staff-auth'
import { getKitchenSocket, joinBusinessRoom, releaseKitchenSocket, retainKitchenSocket } from '@/lib/socket'
import {
  fetchPosDeliveryQueue,
  orderAddressLine,
  orderCustomerLine,
  ORDER_STATUS_LABEL,
  deliveryQueueStatusLabel,
  parseDriverTrail,
  type OpsOrder,
} from '@/lib/ops-orders'
import { deliveryIssueLabel } from '@/lib/delivery-handover'
import { publicSitePath } from '@/lib/public-site-url'
import { formatEUR } from '@/lib/money'
import { cn } from '@/lib/cn'

type DeliveryEvent = {
  id: string
  type: 'delivered' | 'issue' | 'en_route'
  orderNumber: number
  detail?: string
  at: number
}

export function AdminDeliveryLivePanel() {
  const [orders, setOrders] = useState<OpsOrder[]>([])
  const [loading, setLoading] = useState(true)
  const { error, setError } = useFeedbackState()
  const [events, setEvents] = useState<DeliveryEvent[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [liveTrails, setLiveTrails] = useState<Record<string, LatLng[]>>({})
  const seenRef = useRef<Map<string, string>>(new Map())

  const pushEvent = useCallback((ev: Omit<DeliveryEvent, 'id' | 'at'>) => {
    setEvents((prev) => [
      { ...ev, id: `${ev.orderNumber}-${Date.now()}`, at: Date.now() },
      ...prev,
    ].slice(0, 8))
  }, [])

  const load = useCallback(async () => {
    const session = getStaffSession('crm')
    if (!session) return
    try {
      const data = await fetchPosDeliveryQueue(session.token)
      setOrders(data)
      setLiveTrails((prev) => {
        const next = { ...prev }
        for (const o of data) {
          const trail = parseDriverTrail(o.driverTrail)
          if (trail.length > 0) {
            next[o.id] = trail.map((p) => ({ lat: p.lat, lng: p.lng }))
          }
        }
        return next
      })
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chargement impossible')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const session = getStaffSession('crm')
    if (!session) return

    retainKitchenSocket()
    const socket = getKitchenSocket(session.token)
    const onConnect = () => joinBusinessRoom(socket, session.businessId)
    const onDeliveryUpdate = (order: OpsOrder) => {
      if (order.type !== 'DELIVERY') return
      const prevStatus = seenRef.current.get(order.id)
      seenRef.current.set(order.id, order.status)

      if (order.driverLat != null && order.driverLng != null) {
        setLiveTrails((prev) => {
          const trail = prev[order.id] ?? []
          const last = trail[trail.length - 1]
          if (
            last &&
            Math.abs(last.lat - order.driverLat!) < 0.00015 &&
            Math.abs(last.lng - order.driverLng!) < 0.00015
          ) {
            return prev
          }
          const next = [...trail, { lat: order.driverLat!, lng: order.driverLng! }].slice(-400)
          return { ...prev, [order.id]: next }
        })
      }

      if (order.status === 'DELIVERED') {
        pushEvent({ type: 'delivered', orderNumber: order.orderNumber })
        setOrders((list) => list.filter((o) => o.id !== order.id))
        return
      }
      if (order.status === 'DELIVERY_ISSUE') {
        pushEvent({
          type: 'issue',
          orderNumber: order.orderNumber,
          detail: deliveryIssueLabel(order.deliveryIssueReason),
        })
        setOrders((list) => list.filter((o) => o.id !== order.id))
        return
      }
      if (order.status === 'OUT_FOR_DELIVERY' && prevStatus === 'READY') {
        pushEvent({ type: 'en_route', orderNumber: order.orderNumber })
      }
      if (['READY', 'OUT_FOR_DELIVERY'].includes(order.status) && order.paymentStatus === 'PAID') {
        setOrders((list) => {
          const i = list.findIndex((o) => o.id === order.id)
          if (i >= 0) {
            const next = [...list]
            next[i] = order
            return next
          }
          return [order, ...list]
        })
      }
    }

    socket.on('connect', onConnect)
    socket.on('order:statusUpdate', onDeliveryUpdate)
    socket.on('order:new', onDeliveryUpdate)
    if (socket.connected) onConnect()

    const poll = window.setInterval(() => void load(), 60_000)
    return () => {
      socket.off('connect', onConnect)
      socket.off('order:statusUpdate', onDeliveryUpdate)
      socket.off('order:new', onDeliveryUpdate)
      window.clearInterval(poll)
      releaseKitchenSocket()
    }
  }, [load, pushEvent])

  useEffect(() => {
    if (selectedId) return
    const enRoute = orders.find((o) => o.status === 'OUT_FOR_DELIVERY')
    if (enRoute) setSelectedId(enRoute.id)
    else if (orders[0]) setSelectedId(orders[0].id)
  }, [orders, selectedId])

  const enRoute = orders.filter((o) => o.status === 'OUT_FOR_DELIVERY')

  return (
    <section className="mb-8 rounded-2xl border border-violet-500/25 bg-violet-500/5 p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-cream">
            <Truck className="h-5 w-5 text-violet-300" />
            Livraisons en cours
          </h2>
          <p className="text-xs text-cream/50">
            Temps réel + tournée optimisée — confirmation par le livreur (code client)
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/livreur"
            target="_blank"
            className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-bold text-white"
          >
            <Smartphone className="h-3.5 w-3.5" />
            App livreur
          </Link>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-1.5 text-xs text-cream/70 hover:bg-white/5"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            Actualiser
          </button>
        </div>
      </div>

      {events.length > 0 && (
        <ul className="mb-4 space-y-2">
          {events.map((ev) => (
            <li
              key={ev.id}
              className={cn(
                'flex items-center gap-2 rounded-lg px-3 py-2 text-xs',
                ev.type === 'delivered' && 'bg-emerald-500/15 text-emerald-100',
                ev.type === 'issue' && 'bg-amber-500/15 text-amber-100',
                ev.type === 'en_route' && 'bg-violet-500/15 text-violet-100',
              )}
            >
              {ev.type === 'delivered' && <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />}
              {ev.type === 'issue' && <AlertTriangle className="h-3.5 w-3.5 shrink-0" />}
              {ev.type === 'en_route' && <Bell className="h-3.5 w-3.5 shrink-0" />}
              <span>
                #{ev.orderNumber}
                {ev.type === 'delivered' && ' — livrée (code validé)'}
                {ev.type === 'issue' && ` — retour livreur${ev.detail ? ` : ${ev.detail}` : ''}`}
                {ev.type === 'en_route' && ' — en route'}
              </span>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="mb-3 text-sm text-red-300">{error}</p>}

      <div className="mb-4">
        <DeliveryLiveMapLazy
          orders={orders}
          selectedId={selectedId}
          onSelect={setSelectedId}
          liveTrails={liveTrails}
        />
        <p className="mt-2 text-center text-[11px] text-cream/35">
          {orders.length > 0
            ? 'Position mise à jour quand le livreur active le GPS dans l\'app /livreur'
            : 'Carte prête — les livraisons actives apparaîtront ici avec le suivi GPS'}
        </p>
      </div>

      {loading && orders.length === 0 ? (
        <div className="flex justify-center py-8 text-cream/40">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : orders.length === 0 ? (
        <p className="py-6 text-center text-sm text-cream/40">Aucune livraison active</p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {orders.map((order) => {
            const address = orderAddressLine(order)
            const token = order.trackingToken
            const hasGps = order.driverLat != null && order.driverLng != null
            return (
              <article
                key={order.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedId(order.id)}
                onKeyDown={(e) => e.key === 'Enter' && setSelectedId(order.id)}
                className={cn(
                  'cursor-pointer rounded-xl border bg-charcoal/80 p-4 text-sm transition',
                  selectedId === order.id
                    ? 'border-violet-400/50 ring-1 ring-violet-400/30'
                    : 'border-white/10 hover:border-white/20',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold text-tomato-light">#{order.orderNumber}</p>
                    <p className="text-cream/75">{orderCustomerLine(order)}</p>
                    <p className="text-xs text-cream/45">
                      {ORDER_STATUS_LABEL[order.status] ?? order.status} · {formatEUR(order.total)}
                      {order.driver?.name ? ` · ${order.driver.name}` : ''}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                      order.status === 'OUT_FOR_DELIVERY'
                        ? 'bg-violet-500/20 text-violet-200'
                        : 'bg-emerald-500/20 text-emerald-200',
                    )}
                  >
                    {deliveryQueueStatusLabel(order.status)}
                  </span>
                </div>
                {address ? (
                  <p className="mt-2 flex items-start gap-1 text-xs text-cream/55">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {address}
                  </p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  {token ? (
                    <>
                      <a
                        href={publicSitePath(`/suivi/${token}`)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg border border-white/15 px-2 py-1 text-[10px] text-cream/70 hover:bg-white/5"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Suivi client
                      </a>
                      <a
                        href={publicSitePath(`/livreur/${token}?hub=1`)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg border border-violet-500/30 bg-violet-500/10 px-2 py-1 text-[10px] text-violet-200"
                      >
                        <Smartphone className="h-3 w-3" />
                        Fiche livreur
                      </a>
                    </>
                  ) : null}
                  {hasGps ? (
                    <a
                      href={`https://www.openstreetmap.org/?mlat=${order.driverLat}&mlon=${order.driverLng}#map=17/${order.driverLat}/${order.driverLng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[10px] text-emerald-200"
                    >
                      <MapPin className="h-3 w-3" />
                      GPS livreur
                    </a>
                  ) : null}
                </div>
              </article>
            )
          })}
        </div>
      )}

      {enRoute.length > 0 && (
        <p className="mt-4 text-center text-xs text-cream/40">
          {enRoute.length} en route — clôture automatique quand le livreur saisit le code client
        </p>
      )}
    </section>
  )
}
