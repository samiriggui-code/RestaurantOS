'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Package, Truck, X } from 'lucide-react'
import { getStaffSession } from '@/lib/staff-auth'
import {
  ORDER_TYPE_LABEL,
  POS_DISTRIBUTION_SECTIONS,
  fetchPosDistributionDoneToday,
  fetchPosDistributionQueue,
  getPosDistributionPhase,
  orderAddressLine,
  orderChannelBadgeClass,
  orderChannelLabel,
  orderCustomerLine,
  ordersForDistributionSection,
  posDistributionBadge,
  settlePosOrder,
  type OpsOrder,
  type PosDistributionSectionId,
} from '@/lib/ops-orders'
import { OrderItemLines } from '@/components/ops/OrderItemLines'
import { formatEUR } from '@/lib/money'
import { cn } from '@/lib/cn'
import { getKitchenSocket, joinBusinessRoom, retainKitchenSocket } from '@/lib/socket'

const SECTION_ACCENT: Record<PosDistributionSectionId, string> = {
  preparing: 'border-amber-500/30 bg-amber-500/5',
  handover: 'border-emerald-500/30 bg-emerald-500/5',
  await_driver: 'border-violet-500/30 bg-violet-500/5',
  delivering: 'border-blue-500/30 bg-blue-500/5',
  done: 'border-white/10 bg-white/[0.02]',
}

function DistributionOrderCard({
  order,
  onHandover,
}: {
  order: OpsOrder
  onHandover?: (order: OpsOrder) => void
}) {
  const badge = posDistributionBadge(order)
  const phase = getPosDistributionPhase(order)
  const address = order.type === 'DELIVERY' ? orderAddressLine(order) : null

  return (
    <article className="rounded-xl border border-white/10 bg-[#141010] p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-display text-xl font-bold leading-none text-tomato-light">
            #{order.orderNumber}
          </p>
          {orderCustomerLine(order) ? (
            <p className="mt-1 truncate text-xs text-cream/65">{orderCustomerLine(order)}</p>
          ) : null}
        </div>
        <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase', badge.className)}>
          {badge.label}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-[9px] font-semibold',
            orderChannelBadgeClass(order),
          )}
        >
          {orderChannelLabel(order)}
        </span>
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[9px] text-cream/55">
          {ORDER_TYPE_LABEL[order.type] ?? order.type}
        </span>
      </div>

      <ul className="mt-2 space-y-0.5 text-xs text-cream/70">
        {order.items?.slice(0, 4).map((item) => (
          <li key={item.id} className="truncate">
            {item.quantity}× {item.menuItem?.name ?? 'Article'}
          </li>
        ))}
        {(order.items?.length ?? 0) > 4 ? (
          <li className="text-cream/35">+{(order.items?.length ?? 0) - 4} article(s)</li>
        ) : null}
      </ul>

      {address ? (
        <p className="mt-2 truncate text-[10px] text-cream/45">{address}</p>
      ) : null}

      {phase === 'await_driver' && order.driver?.name ? (
        <p className="mt-2 text-[10px] text-violet-200/80">Livreur assigné : {order.driver.name}</p>
      ) : null}

      {phase === 'delivering' && order.driver?.name ? (
        <p className="mt-2 flex items-center gap-1 text-[10px] text-violet-200/90">
          <Truck className="h-3 w-3 shrink-0" />
          {order.driver.name}
        </p>
      ) : null}

      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="font-mono text-base font-bold text-cream">{formatEUR(order.total)}</p>
        {phase === 'handover' && onHandover ? (
          <button
            type="button"
            onClick={() => onHandover(order)}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[10px] font-bold text-white hover:bg-emerald-500"
          >
            Confirmer remise
          </button>
        ) : null}
      </div>
    </article>
  )
}

export function PosKitchenQueueTab() {
  const [activeOrders, setActiveOrders] = useState<OpsOrder[]>([])
  const [doneOrders, setDoneOrders] = useState<OpsOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [handoverOrder, setHandoverOrder] = useState<OpsOrder | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const allOrders = useMemo(() => [...activeOrders, ...doneOrders], [activeOrders, doneOrders])

  const load = useCallback(async () => {
    const session = getStaffSession('device')
    if (!session) return
    setLoading(true)
    try {
      const [active, done] = await Promise.all([
        fetchPosDistributionQueue(session.token),
        fetchPosDistributionDoneToday(session.token),
      ])
      setActiveOrders(active)
      setDoneOrders(done)
      setError(null)
    } catch {
      setActiveOrders([])
      setDoneOrders([])
      setError('Impossible de charger la file')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const id = window.setInterval(() => void load(), 15_000)
    return () => window.clearInterval(id)
  }, [load])

  useEffect(() => {
    const session = getStaffSession('device')
    if (!session) return

    retainKitchenSocket()
    const socket = getKitchenSocket(session.token)
    joinBusinessRoom(socket, session.businessId)

    function upsertActive(list: OpsOrder[], order: OpsOrder): OpsOrder[] {
      if (['COMPLETED', 'DELIVERED', 'CANCELLED'].includes(order.status)) {
        return list.filter((o) => o.id !== order.id)
      }
      if (order.paymentStatus !== 'PAID') return list.filter((o) => o.id !== order.id)
      if (list.some((o) => o.id === order.id)) {
        return list.map((o) => (o.id === order.id ? order : o))
      }
      return [order, ...list]
    }

    function upsertDone(list: OpsOrder[], order: OpsOrder): OpsOrder[] {
      if (!['COMPLETED', 'DELIVERED'].includes(order.status)) {
        return list.filter((o) => o.id !== order.id)
      }
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      if (new Date(order.createdAt) < today) return list
      if (list.some((o) => o.id === order.id)) {
        return list.map((o) => (o.id === order.id ? order : o))
      }
      return [order, ...list].slice(0, 60)
    }

    const onOrderEvent = (order: OpsOrder) => {
      setActiveOrders((prev) => upsertActive(prev, order))
      setDoneOrders((prev) => upsertDone(prev, order))
    }

    socket.on('order:new', onOrderEvent)
    socket.on('order:statusUpdate', onOrderEvent)
    socket.on('order:paymentUpdate', onOrderEvent)
    socket.on('order:cancelled', (order: OpsOrder) => {
      setActiveOrders((prev) => prev.filter((o) => o.id !== order.id))
      setDoneOrders((prev) => prev.filter((o) => o.id !== order.id))
    })

    return () => {
      socket.off('order:new', onOrderEvent)
      socket.off('order:statusUpdate', onOrderEvent)
      socket.off('order:paymentUpdate', onOrderEvent)
      socket.off('order:cancelled')
    }
  }, [])

  async function confirmHandover() {
    if (!handoverOrder) return
    const session = getStaffSession('device')
    if (!session) return
    setSubmitting(true)
    setError(null)
    try {
      const updated = await settlePosOrder(handoverOrder.id, session.token, { action: 'handover' })
      setHandoverOrder(null)
      setActiveOrders((prev) => prev.filter((o) => o.id !== updated.id))
      setDoneOrders((prev) => [updated, ...prev.filter((o) => o.id !== updated.id)].slice(0, 60))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Remise impossible')
    } finally {
      setSubmitting(false)
    }
  }

  const summary = useMemo(() => {
    const handover = ordersForDistributionSection(allOrders, 'handover').length
    const awaitDriver = ordersForDistributionSection(allOrders, 'await_driver').length
    const delivering = ordersForDistributionSection(allOrders, 'delivering').length
    const preparing = ordersForDistributionSection(allOrders, 'preparing').length
    return { handover, awaitDriver, delivering, preparing }
  }, [allOrders])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-charcoal">
        <Loader2 className="h-8 w-8 animate-spin text-tomato-light" />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-charcoal text-cream">
      <header className="shrink-0 border-b border-white/10 px-4 py-3 sm:px-5">
        <h1 className="font-display text-xl font-bold">File cuisine & remise</h1>
        <p className="text-xs text-cream/45">
          POS · Web · Deliveroo · Uber — préparation, remise client et livraisons
        </p>
        <div className="mt-2 flex flex-wrap gap-2 text-[10px]">
          {summary.preparing > 0 && (
            <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-amber-200">
              {summary.preparing} en prépa
            </span>
          )}
          {summary.handover > 0 && (
            <span className="rounded-full bg-emerald-500/25 px-2 py-0.5 font-semibold text-emerald-100 ring-1 ring-emerald-400/40">
              {summary.handover} à remettre
            </span>
          )}
          {summary.awaitDriver > 0 && (
            <span className="rounded-full bg-violet-500/25 px-2 py-0.5 text-violet-100">
              {summary.awaitDriver} attente livreur
            </span>
          )}
          {summary.delivering > 0 && (
            <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-blue-200">
              {summary.delivering} en livraison
            </span>
          )}
        </div>
        {error ? <p className="mt-2 text-xs text-red-400">{error}</p> : null}
      </header>

      <div className="grid min-h-0 flex-1 gap-2 overflow-x-auto p-3 md:grid-cols-2 xl:grid-cols-5 xl:overflow-hidden">
        {POS_DISTRIBUTION_SECTIONS.map((section) => {
          const sectionOrders = ordersForDistributionSection(allOrders, section.id)
          return (
            <section
              key={section.id}
              className={cn(
                'flex min-h-[200px] min-w-[240px] flex-col rounded-2xl border xl:min-w-0',
                SECTION_ACCENT[section.id],
              )}
            >
              <div className="flex items-center justify-between border-b border-white/5 px-3 py-2">
                <h2 className="text-xs font-semibold text-cream/80">{section.label}</h2>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold tabular-nums">
                  {sectionOrders.length}
                </span>
              </div>
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
                {sectionOrders.length === 0 ? (
                  <p className="py-6 text-center text-[11px] text-cream/30">{section.empty}</p>
                ) : (
                  sectionOrders.map((order) => (
                    <DistributionOrderCard
                      key={order.id}
                      order={order}
                      onHandover={section.id === 'handover' ? setHandoverOrder : undefined}
                    />
                  ))
                )}
              </div>
            </section>
          )
        })}
      </div>

      {handoverOrder ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#1A1412] p-6 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-2">
              <div>
                <p className="text-xs uppercase tracking-wide text-cream/40">Remise au client</p>
                <h3 className="font-display text-2xl font-bold text-tomato-light">
                  #{handoverOrder.orderNumber}
                </h3>
                <p className="text-sm text-cream/60">
                  {orderCustomerLine(handoverOrder)}{' '}
                  <span
                    className={cn(
                      'ml-1 rounded-full px-2 py-0.5 text-[10px] font-semibold',
                      orderChannelBadgeClass(handoverOrder),
                    )}
                  >
                    {orderChannelLabel(handoverOrder)}
                  </span>
                </p>
              </div>
              <button type="button" onClick={() => setHandoverOrder(null)} disabled={submitting}>
                <X className="h-5 w-5 text-cream/50" />
              </button>
            </div>

            <ul className="mb-4 max-h-32 space-y-1 overflow-y-auto rounded-xl bg-white/[0.03] p-3 text-sm">
              {handoverOrder.items.map((item) => (
                <li key={item.id}>
                  <OrderItemLines item={item} />
                </li>
              ))}
            </ul>

            <p className="mb-4 text-center text-2xl font-bold text-cream">
              {formatEUR(handoverOrder.total)} · déjà payé
            </p>

            <button
              type="button"
              disabled={submitting}
              onClick={() => void confirmHandover()}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Package className="h-5 w-5" />
              )}
              Commande remise au client
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
