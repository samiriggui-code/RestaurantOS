'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useFeedbackState } from '@/lib/use-feedback-state'
import Link from 'next/link'
import {
  Archive,
  Ban,
  ChefHat,
  Loader2,
  Lock,
  MapPin,
  Phone,
  Printer,
  RefreshCw,
  Tag,
  Truck,
  Users,
  UtensilsCrossed,
  X,
} from 'lucide-react'
import { AppModuleBrand } from '@/components/brand/AppModuleBrand'
import { DevicePinGate, useDeviceLock } from '@/components/ops/DevicePinGate'
import { DeviceShopGate } from '@/components/ops/DeviceShopGate'
import { ApkOtaUpdater } from '@/components/ops/ApkOtaUpdater'
import { DeviceFullscreenButton } from '@/components/ops/DeviceFullscreenButton'
import { DeviceOrientationButton } from '@/components/ops/DeviceOrientationButton'
import { KitchenTeamBoard } from '@/components/kitchen/KitchenTeamBoard'
import { KitchenDriverAssignSheet } from '@/components/kitchen/KitchenDriverAssignSheet'
import { getCrmSession, getDeviceSession, getStaffSession, getStaffUser, type AuthScope } from '@/lib/staff-auth'
import { authScopeForOpsMode, type OpsViewMode } from '@/lib/ops-view-mode'
import { canAccessAdmin } from '@/lib/roles'
import { getKitchenSocket, joinBusinessRoom, releaseKitchenSocket, retainKitchenSocket } from '@/lib/socket'
import { OrderItemLines } from '@/components/ops/OrderItemLines'
import { OrderChannelBadge } from '@/components/ops/OrderChannelBadge'
import {
  cancelOrder,
  fetchKitchenArchive,
  fetchKitchenOrders,
  getKitchenStatusTransitions,
  isAwaitingPrep,
  isKitchenVisibleOrder,
  ITEM_STATUS_LABEL,
  kanbanColumnForStatus,
  ORDER_CANCEL_REASONS,
  ORDER_KANBAN_COLUMNS,
  orderAddressLine,
  orderCustomerLine,
  ORDER_STATUS_LABEL,
  orderStatusBadgeClass,
  orderTypeLabel,
  requestOrderPrint,
  assignDeliveryDriver,
  updateItemStatus,
  updateOrderStatus,
  type OpsOrder,
  type OrderCancelReason,
} from '@/lib/ops-orders'
import { useKitchenPrintListener } from '@/lib/print/use-kitchen-print-listener'
import { useDeviceDiagnosticListener } from '@/lib/print/use-device-diagnostic-listener'
import { handleKitchenPrintJob } from '@/lib/print/print-job-handler'
import { deliveryIssueLabel } from '@/lib/delivery-handover'
import { formatEUR } from '@/lib/money'
import { cn } from '@/lib/cn'

type KitchenTab = 'live' | 'archive' | 'team'

function ChannelBadge({ order }: { order: OpsOrder }) {
  return <OrderChannelBadge order={order} />
}

function TypeBadge({ type }: { type: string }) {
  const Icon = type === 'DELIVERY' ? Truck : type === 'TAKEAWAY' ? UtensilsCrossed : ChefHat
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-cream/80">
      <Icon className="h-3.5 w-3.5" />
      {orderTypeLabel(type)}
    </span>
  )
}

/** Boutons impression — contrastes élevés pour écran cuisine (fond sombre). */
function PrintTicketButtons({
  orderId,
  printingId,
  onPrint,
  compact = false,
}: {
  orderId: string
  printingId: string | null
  onPrint: (orderId: string, type: 'KITCHEN' | 'BAG_LABEL') => void
  compact?: boolean
}) {
  return (
    <div className={cn('grid gap-2', compact ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2')}>
      <button
        type="button"
        disabled={printingId === `${orderId}-KITCHEN`}
        onClick={() => void onPrint(orderId, 'KITCHEN')}
        className={cn(
          'flex w-full flex-col items-center justify-center rounded-xl border-2 border-blue-300/50 bg-blue-600 px-3 font-bold text-white shadow-lg hover:bg-blue-500 disabled:opacity-50',
          compact ? 'py-2 text-[11px]' : 'py-3 text-sm'
        )}
      >
        <span className="flex items-center gap-2">
          <Printer className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
          Ticket cuisine
        </span>
        {!compact && <span className="mt-0.5 text-[10px] font-normal text-blue-100">Bon de préparation</span>}
      </button>
      <button
        type="button"
        disabled={printingId === `${orderId}-BAG_LABEL`}
        onClick={() => void onPrint(orderId, 'BAG_LABEL')}
        className={cn(
          'flex w-full flex-col items-center justify-center rounded-xl border-2 border-amber-200/50 bg-amber-500 px-3 font-bold text-charcoal shadow-lg hover:bg-amber-400 disabled:opacity-50',
          compact ? 'py-2 text-[11px]' : 'py-3 text-sm'
        )}
      >
        <span className="flex items-center gap-2">
          <Tag className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
          Étiquette colis
        </span>
        {!compact && (
          <span className="mt-0.5 text-[10px] font-normal text-charcoal/80">
            N°, client, tél.{', adresse si livraison'}
          </span>
        )}
      </button>
    </div>
  )
}

function columnForStatus(status: string) {
  return kanbanColumnForStatus(status)
}

export function KitchenDisplay({
  mode = 'device',
  monitor = false,
}: {
  mode?: OpsViewMode
  /** Plein écran CRM (/monitor/kitchen) — sans onglet équipe. */
  monitor?: boolean
}) {
  if (mode === 'admin') {
    return (
      <KitchenScreen
        mode="admin"
        monitor={monitor}
        lock={() => {}}
        operatorName={getStaffUser('crm')?.name ?? null}
      />
    )
  }
  return (
    <DeviceShopGate deviceLabel="écran cuisine">
      <DevicePinGate device="kitchen">
        <ApkOtaUpdater />
        <KitchenScreenDevice />
      </DevicePinGate>
    </DeviceShopGate>
  )
}

function KitchenScreenDevice() {
  const { lock, operatorName } = useDeviceLock()
  return <KitchenScreen mode="device" lock={lock} operatorName={operatorName} />
}

function KitchenScreen({
  mode,
  monitor = false,
  lock,
  operatorName,
}: {
  mode: OpsViewMode
  monitor?: boolean
  lock: () => void
  operatorName: string | null
}) {
  const isAdminPreview = mode === 'admin'
  const showTeamTab = !isAdminPreview
  const authScope: AuthScope = authScopeForOpsMode(mode)
  const isAdmin = canAccessAdmin(getStaffUser(authScope)?.role ?? '')
  const [tab, setTab] = useState<KitchenTab>('live')
  const [orders, setOrders] = useState<OpsOrder[]>([])
  const [archive, setArchive] = useState<OpsOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [archiveLoading, setArchiveLoading] = useState(false)
  const { error, setError } = useFeedbackState()
  const [connected, setConnected] = useState(false)
  const [printingId, setPrintingId] = useState<string | null>(null)
  const [cancelTarget, setCancelTarget] = useState<OpsOrder | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [assignTarget, setAssignTarget] = useState<OpsOrder | null>(null)
  const [assigning, setAssigning] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useKitchenPrintListener(!isAdminPreview)
  useDeviceDiagnosticListener(!isAdminPreview)

  const loadOrders = useCallback(async (token: string) => {
    const data = await fetchKitchenOrders(token)
    setOrders(data.filter(isKitchenVisibleOrder))
    setError(null)
  }, [])

  const loadArchive = useCallback(async (token: string) => {
    const data = await fetchKitchenArchive(token)
    setArchive(data)
  }, [])

  useEffect(() => {
    audioRef.current = new Audio(
      'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACAf39/f4B/f3+AgH9/f3+Af39/gIB/f3+AgH9/f4CAf39/gH9/f4CAf3+Af39/gICAf39/gH9/f4B/f39/gH9/f4B/f3+Af39/gH9/f4CAf39/gH9/f4B/f39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4CAf39/gH9/f4CAf39/gH9/f4B/f39/gH9/f4CAf39/gH9/f4B/f3+Af39/gH9/f4CAf39/gH9/f4B/f39/gH9/f4CAf39/gH9/f4CAf39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4CAf39/gH9/f4CAf39/gH9/f4B/f39/gH9/f4CAf39/gH9/f4B/f3+Af39/gH9/f4B/f39/gH9/f4CAf39/gH9/f4B/f39/gH9/f4CAf3+Af39/gH9/f4CAf39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f39/gH9/f4B/f39/gH9/f4B/f3+Af39/gH9/f4B/f39/gH9/f4CAf39/gH9/f4B/f39/gH9/f4CAf39/gH9/f4CAf39/gH9/f4CAf3+Af39/gIB/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f39/gH9/f4B/f39/gH9/f4B/f3+Af39/gH9/f4CAf39/gH9/f4CAf39/gH9/f4B/f39/gH9/f4B/f3+Af39/gH9/f4B/f39/gH9/f4B/f39/gH9/f4B/f3+Af39/gH9/f4CAf39/gH9/f4B/f39/gH9/f4CAf39/gH9/f4CAf39/gH9/f4B/f3+Af39/gH9/f4B/f39/gH9/f4CAf3+Af39/gIB/f3+Af39/gH9/f4CAf39/gH9/f4B/f39/gH9/f4B/f39/gH9/f4B/f3+Af39/gH9/f4B/f39/gH9/f4B/f3+Af39/gIB/f3+Af39/gH9/f4B/f39/gH9/f4CAf39/gH9/f4B/f39/gH9/f4B/f3+Af39/gH9/f4CAf39/gH9/f4B/f39/gH9/f4B/f39/gH9/f4CAf39/gH9/f4B/f39/gH9/f4CAf39/gH9/f4CAf39/gH9/f4CAf39/gH9/f4B/f39/gH9/f4B/f39/gH9/f4B/f39/gH9/f4CAf39/gH9/f4B/f39/gH9/f4CAf39/gH9/f4CAf39/gH9/f4B/f39/'
    )

    const session = authScope === 'crm' ? getCrmSession() : authScope === 'device' ? getDeviceSession() : getStaffSession()
    if (!session) return

    const { token, businessId } = session
    retainKitchenSocket()
    const socket = getKitchenSocket(token)

    const onConnect = () => {
      setConnected(true)
      joinBusinessRoom(socket, businessId)
    }
    const onDisconnect = () => setConnected(false)

    const onNewOrder = (order: OpsOrder) => {
      if (!isKitchenVisibleOrder(order)) return
      setOrders((prev) => {
        if (prev.some((o) => o.id === order.id)) return prev
        return [order, ...prev]
      })
      void audioRef.current?.play().catch(() => {})
    }

    const onOrderUpdate = (order: OpsOrder) => {
      setOrders((prev) => {
        if (!isKitchenVisibleOrder(order)) {
          return prev.filter((o) => o.id !== order.id)
        }
        if (prev.some((o) => o.id === order.id)) {
          return prev.map((o) => (o.id === order.id ? order : o))
        }
        return [order, ...prev]
      })
    }

    const onItemPatch = (payload: {
      orderId: string
      order?: OpsOrder
      itemId?: string
      status?: string
    }) => {
      if (payload.order) {
        onOrderUpdate(payload.order)
        return
      }
      if (!payload.itemId || !payload.status) return
      setOrders((prev) =>
        prev.map((order) =>
          order.id !== payload.orderId
            ? order
            : {
                ...order,
                items: order.items.map((item) =>
                  item.id === payload.itemId ? { ...item, status: payload.status! } : item
                ),
              }
        )
      )
    }

    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    socket.on('connect_error', onDisconnect)
    socket.on('order:new', onNewOrder)
    socket.on('order:statusUpdate', onOrderUpdate)
    socket.on('order:cancelled', onOrderUpdate)
    socket.on('order:itemStatusUpdate', onItemPatch)
    socket.on('kitchen:itemUpdated', onItemPatch)
    socket.on('kitchen:itemsAdded', (payload: { order?: OpsOrder }) => {
      if (payload.order) onOrderUpdate(payload.order)
    })

    if (socket.connected) onConnect()

    loadOrders(token)
      .catch((err) => setError(err instanceof Error ? err.message : 'Chargement impossible'))
      .finally(() => setLoading(false))

    const poll = window.setInterval(() => {
      if (!socket.connected) void loadOrders(token).catch(() => {})
    }, 20_000)

    return () => {
      window.clearInterval(poll)
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      socket.off('connect_error', onDisconnect)
      socket.off('order:new', onNewOrder)
      socket.off('order:statusUpdate', onOrderUpdate)
      socket.off('order:cancelled', onOrderUpdate)
      socket.off('order:itemStatusUpdate', onItemPatch)
      socket.off('kitchen:itemUpdated', onItemPatch)
      socket.off('kitchen:itemsAdded')
      releaseKitchenSocket()
    }
  }, [loadOrders, authScope])

  useEffect(() => {
    if (tab !== 'archive') return
    const session = authScope === 'crm' ? getCrmSession() : authScope === 'device' ? getDeviceSession() : getStaffSession()
    if (!session) return
    setArchiveLoading(true)
    loadArchive(session.token)
      .catch((err) => setError(err instanceof Error ? err.message : 'Archive indisponible'))
      .finally(() => setArchiveLoading(false))
  }, [tab, loadArchive, authScope])

  const ordersByColumn = useMemo(() => {
    const map: Record<string, OpsOrder[]> = { todo: [], prep: [], ready: [] }
    for (const order of orders.filter(isKitchenVisibleOrder)) {
      const col = columnForStatus(order.status)
      map[col.id].push(order)
    }
    for (const key of Object.keys(map)) {
      map[key].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      )
    }
    return map
  }, [orders])

  async function refresh() {
    const session = authScope === 'crm' ? getCrmSession() : authScope === 'device' ? getDeviceSession() : getStaffSession()
    if (!session) return
    setLoading(true)
    try {
      if (tab === 'live') await loadOrders(session.token)
      else await loadArchive(session.token)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setLoading(false)
    }
  }

  async function setOrderStatus(orderId: string, status: string) {
    const session = authScope === 'crm' ? getCrmSession() : authScope === 'device' ? getDeviceSession() : getStaffSession()
    if (!session) return
    try {
      const updated = await updateOrderStatus(orderId, status, session.token)
      setOrders((prev) =>
        !isKitchenVisibleOrder(updated)
          ? prev.filter((o) => o.id !== orderId)
          : prev.map((o) => (o.id === orderId ? updated : o))
      )
      if (status === 'READY' && updated.type === 'DELIVERY' && !updated.driverId) {
        setAssignTarget(updated)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Mise à jour impossible')
    }
  }

  async function assignDriver(orderId: string, driverId: string) {
    const session = authScope === 'crm' ? getCrmSession() : authScope === 'device' ? getDeviceSession() : getStaffSession()
    if (!session) return
    setAssigning(true)
    try {
      const updated = await assignDeliveryDriver(orderId, driverId, session.token)
      setOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)))
      setAssignTarget(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Attribution impossible')
    } finally {
      setAssigning(false)
    }
  }

  async function confirmCancel(reason: OrderCancelReason, note?: string) {
    const session = getStaffSession(authScope)
    if (!session || !cancelTarget) return
    setCancelling(true)
    try {
      const updated = await cancelOrder(cancelTarget.id, session.token, {
        reason,
        note,
        source: 'KITCHEN',
        refund: true,
      })
      setOrders((prev) => prev.filter((o) => o.id !== updated.id))
      setCancelTarget(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Annulation impossible')
    } finally {
      setCancelling(false)
    }
  }

  async function handlePrint(orderId: string, type: 'KITCHEN' | 'BAG_LABEL') {
    const session = authScope === 'crm' ? getCrmSession() : authScope === 'device' ? getDeviceSession() : getStaffSession()
    if (!session) return
    setPrintingId(`${orderId}-${type}`)
    try {
      const { printJob, content } = await requestOrderPrint(orderId, type, session.token)
      const result = await handleKitchenPrintJob(
        {
          id: printJob.id,
          type,
          status: 'PENDING',
          payload: { text: content },
          orderId,
        },
        session.token,
      )
      if (!result.ok) {
        setError(
          'Imprimante cuisine absente — relais caisse SUNMI (~2 s). Gardez la caisse POS ouverte et connectée.',
        )
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impression impossible')
    } finally {
      setPrintingId(null)
    }
  }

  return (
    <div className="pos-touch flex h-full min-h-0 flex-col text-cream">
      <header className="sticky top-0 z-10 shrink-0 border-b border-white/10 bg-charcoal/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-4 px-4 py-3">
          <div>
            {!monitor && !isAdminPreview ? (
              <>
                <AppModuleBrand variant="kds" subtitle={operatorName ?? undefined} />
                <p className="mt-2 text-xs text-cream/65">
                  {tab === 'team'
                    ? 'Planning équipe & pointage'
                    : `${connected ? '● En direct' : '○ Reconnexion…'} — ${orders.length} en cours`}
                </p>
              </>
            ) : (
              <>
                <h1 className="font-display text-xl font-bold text-cream">
                  {monitor ? 'Moniteur cuisine' : isAdminPreview ? 'Suivi cuisine (CRM)' : 'Écran cuisine'}
                </h1>
                <p className="text-xs text-cream/65">
                  {tab === 'team'
                    ? 'Planning équipe & pointage'
                    : `${connected ? '● En direct' : '○ Reconnexion…'} — ${orders.length} en cours`}
                  {operatorName ? ` — ${operatorName}` : ''}
                </p>
              </>
            )}
            {isAdminPreview && !monitor && (
              <p className="text-[11px] text-blue-300/80">
                Ouvrez le moniteur en fenêtre dédiée depuis le hub CRM.
              </p>
            )}
            {monitor && (
              <p className="text-[11px] text-emerald-300/80">
                Flux identique à la tablette boutique /kitchen — lecture seule côté statuts si non connecté en PIN.
              </p>
            )}
            {isAdmin && !isAdminPreview && tab !== 'team' && (
              <p className="text-[11px] text-cream/55">
                Paramètres →{' '}
                <Link href="/admin/kitchen" className="text-tomato-light hover:underline">
                  admin / écran cuisine
                </Link>
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!isAdminPreview && (
              <>
                <DeviceOrientationButton forceShow />
                <DeviceFullscreenButton />
              </>
            )}
            {tab !== 'team' && (
              <button
                type="button"
                onClick={() => void refresh()}
                className="rounded-xl border border-white/15 px-4 py-2 text-sm font-medium text-cream hover:bg-white/10"
              >
                <RefreshCw className={cn('mr-2 inline h-4 w-4', loading && 'animate-spin')} />
                Actualiser
              </button>
            )}
            {!isAdminPreview && (
              <button
                type="button"
                onClick={lock}
                className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-100 hover:bg-amber-500/20"
              >
                <Lock className="mr-2 inline h-4 w-4" />
                Verrouiller
              </button>
            )}
          </div>
        </div>

        <div className="mx-auto flex max-w-[1600px] gap-1 px-4 pb-3">
          <button
            type="button"
            onClick={() => setTab('live')}
            className={cn(
              'rounded-xl px-4 py-2 text-sm font-semibold transition',
              tab === 'live' ? 'bg-tomato text-white' : 'bg-white/5 text-cream/60 hover:bg-white/10'
            )}
          >
            <ChefHat className="mr-2 inline h-4 w-4" />
            En cours ({orders.length})
          </button>
          {showTeamTab && (
            <button
              type="button"
              onClick={() => setTab('team')}
              className={cn(
                'rounded-xl px-4 py-2 text-sm font-semibold transition',
                tab === 'team' ? 'bg-tomato text-white' : 'bg-white/5 text-cream/60 hover:bg-white/10'
              )}
            >
              <Users className="mr-2 inline h-4 w-4" />
              Équipe & pointage
            </button>
          )}
          <button
            type="button"
            onClick={() => setTab('archive')}
            className={cn(
              'rounded-xl px-4 py-2 text-sm font-semibold transition',
              tab === 'archive' ? 'bg-tomato text-white' : 'bg-white/5 text-cream/60 hover:bg-white/10'
            )}
          >
            <Archive className="mr-2 inline h-4 w-4" />
            Archive 30 jours
          </button>
        </div>

        {error && tab !== 'team' && (
          <p className="border-t border-red-500/30 bg-red-950/40 px-4 py-2 text-center text-sm text-red-200">
            {error}
          </p>
        )}
      </header>

      {tab === 'team' ? (
        <KitchenTeamBoard variant="kitchen" className="min-h-0 flex-1" />
      ) : loading && tab === 'live' && orders.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-tomato-light" />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {tab === 'archive' ? (
            <ArchivePanel orders={archive} loading={archiveLoading} authScope={authScope} />
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-4 py-24 text-cream/60">
              <p className="text-xl font-medium text-cream">Rien en cuisine pour l&apos;instant</p>
              <p className="mt-2 text-center text-sm text-cream/70">
                Les commandes payées ou validées comptoir s&apos;affichent ici automatiquement.
              </p>
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden p-4">
              <div className="mx-auto flex h-full min-w-[960px] max-w-[1600px] gap-4">
                {ORDER_KANBAN_COLUMNS.map((column) => (
                  <KanbanColumnView
                    key={column.id}
                    column={column}
                    orders={ordersByColumn[column.id]}
                    printingId={printingId}
                    onPrint={handlePrint}
                    onSetStatus={setOrderStatus}
                    onRequestCancel={setCancelTarget}
                    onRequestAssignDriver={setAssignTarget}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {assignTarget && (
        <KitchenDriverAssignSheet
          order={assignTarget}
          loading={assigning}
          onClose={() => setAssignTarget(null)}
          onConfirm={(driverId) => assignDriver(assignTarget.id, driverId)}
        />
      )}
      {cancelTarget && (
        <KitchenCancelSheet
          order={cancelTarget}
          loading={cancelling}
          onClose={() => setCancelTarget(null)}
          onConfirm={confirmCancel}
        />
      )}
    </div>
  )
}

function KanbanColumnView({
  column,
  orders,
  printingId,
  onPrint,
  onSetStatus,
  onRequestCancel,
  onRequestAssignDriver,
}: {
  column: (typeof ORDER_KANBAN_COLUMNS)[number]
  orders: OpsOrder[]
  printingId: string | null
  onPrint: (orderId: string, type: 'KITCHEN' | 'BAG_LABEL') => void
  onSetStatus: (orderId: string, status: string) => void
  onRequestCancel: (order: OpsOrder) => void
  onRequestAssignDriver: (order: OpsOrder) => void
}) {
  return (
    <section
      className={cn(
        'flex min-h-0 min-w-0 flex-1 flex-col rounded-2xl border bg-[#141010]/80',
        column.accent
      )}
    >
      <header className="border-b border-white/10 px-4 py-3">
        <h2 className="font-display text-sm font-bold uppercase tracking-wide text-cream/80">
          {column.title}
        </h2>
        <p className="text-xs text-cream/55">{orders.length} commande(s)</p>
      </header>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {orders.length === 0 ? (
          <p className="py-8 text-center text-xs text-cream/50">Aucune commande</p>
        ) : (
          orders.map((order) => (
            <OrderKanbanCard
              key={order.id}
              order={order}
              printingId={printingId}
              onPrint={onPrint}
              onSetStatus={onSetStatus}
              onRequestCancel={onRequestCancel}
              onRequestAssignDriver={onRequestAssignDriver}
            />
          ))
        )}
      </div>
    </section>
  )
}

function OrderKanbanCard({
  order,
  printingId,
  onPrint,
  onSetStatus,
  onRequestCancel,
  onRequestAssignDriver,
}: {
  order: OpsOrder
  printingId: string | null
  onPrint: (orderId: string, type: 'KITCHEN' | 'BAG_LABEL') => void
  onSetStatus: (orderId: string, status: string) => void
  onRequestCancel: (order: OpsOrder) => void
  onRequestAssignDriver: (order: OpsOrder) => void
}) {
  const address = orderAddressLine(order)
  const session = getStaffSession('auto')

  return (
    <article className="rounded-xl border border-white/10 bg-[#1A1412] p-3 shadow-lg">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <p className="font-display text-2xl font-bold text-tomato-light">#{order.orderNumber}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <TypeBadge type={order.type} />
            <ChannelBadge order={order} />
            <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', orderStatusBadgeClass(order.status))}>
              {ORDER_STATUS_LABEL[order.status] ?? order.status}
            </span>
          </div>
        </div>
        <p className="text-sm font-bold text-cream">{formatEUR(order.total)}</p>
      </div>

      <div className="mb-2 space-y-0.5 rounded-lg bg-white/[0.03] px-2 py-1.5 text-xs">
        <p className="font-semibold text-cream">{orderCustomerLine(order)}</p>
        {order.customerPhone && (
          <p className="flex items-center gap-1 text-cream/55">
            <Phone className="h-3 w-3" />
            {order.customerPhone}
          </p>
        )}
        {address && (
          <p className="flex items-start gap-1 text-cream/55">
            <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
            {address}
          </p>
        )}
        <p className="text-cream/55">
          {new Date(order.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>

      <ul className="mb-2 space-y-2 border-t border-white/10 pt-2">
        {order.items.map((item) => (
          <li key={item.id} className="text-xs">
            <div className="flex items-start justify-between gap-1">
              <OrderItemLines item={item} />
              <span className="shrink-0 text-[10px] text-cream/45">
                {ITEM_STATUS_LABEL[item.status] ?? item.status}
              </span>
            </div>
            {session && (
              <div className="mt-1 flex flex-wrap gap-1">
                {isAwaitingPrep(item.status) && (
                  <button
                    type="button"
                    onClick={() => void updateItemStatus(order.id, item.id, 'PREPARING', session.token)}
                    className="rounded bg-blue-600/80 px-2 py-0.5 text-[10px] font-semibold text-white"
                  >
                    Préparer
                  </button>
                )}
                {item.status === 'PREPARING' && (
                  <button
                    type="button"
                    onClick={() => void updateItemStatus(order.id, item.id, 'READY', session.token)}
                    className="rounded bg-emerald-600/80 px-2 py-0.5 text-[10px] font-semibold text-white"
                  >
                    Prêt
                  </button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>

      {order.notes && (
        <p className="mb-2 rounded-lg border border-amber-500/25 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-100">
          {order.notes}
        </p>
      )}

      {order.type === 'DELIVERY' && order.trackingToken && ['READY', 'OUT_FOR_DELIVERY'].includes(order.status) && (
        <a
          href={`/livreur/${order.trackingToken}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mb-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-violet-500/40 bg-violet-500/10 py-2 text-xs font-semibold text-violet-200 hover:bg-violet-500/20"
        >
          <Truck className="h-3.5 w-3.5" />
          Ouvrir app livreur
        </a>
      )}

      <div className="border-t border-white/10 pt-2">
        <PrintTicketButtons
          orderId={order.id}
          printingId={printingId}
          onPrint={onPrint}
          compact
        />
      </div>

      <div className="mt-2 grid gap-1.5">
        {isAwaitingPrep(order.status) && (
          <button
            type="button"
            onClick={() => void onSetStatus(order.id, 'PREPARING')}
            className="w-full rounded-lg bg-blue-600 py-2 text-xs font-bold text-white hover:bg-blue-500"
          >
            Démarrer la préparation
          </button>
        )}
        {order.status === 'PREPARING' && (
          <button
            type="button"
            onClick={() => void onSetStatus(order.id, 'READY')}
            className="w-full rounded-lg bg-emerald-600 py-2 text-xs font-bold text-white hover:bg-emerald-500"
          >
            Commande prête
          </button>
        )}
        {order.status === 'READY' && order.type === 'DELIVERY' && (
          <>
            {order.driver?.name && (
              <p className="mb-1.5 rounded-lg border border-violet-500/25 bg-violet-500/10 px-2 py-1.5 text-[11px] text-violet-100">
                Livreur : <strong>{order.driver.name}</strong>
              </p>
            )}
            <button
              type="button"
              onClick={() => onRequestAssignDriver(order)}
              className="w-full rounded-lg bg-violet-600 py-2 text-xs font-bold text-white hover:bg-violet-500"
            >
              <Truck className="mr-1 inline h-3.5 w-3.5" />
              {order.driver?.name ? 'Changer de livreur' : 'Mettre en livraison'}
            </button>
          </>
        )}
        {order.status === 'OUT_FOR_DELIVERY' && order.type === 'DELIVERY' && (
          <p className="rounded-lg border border-violet-500/30 bg-violet-500/10 px-2 py-1.5 text-[11px] text-violet-100">
            {order.driver?.name ? (
              <>
                En route — <strong>{order.driver.name}</strong>
              </>
            ) : (
              <>En route — en attente confirmation code client (app livreur).</>
            )}
          </p>
        )}
        {order.status === 'DELIVERY_ISSUE' && order.type === 'DELIVERY' && (
          <>
            <p className="rounded-lg border border-red-500/35 bg-red-950/40 px-2 py-1.5 text-[11px] text-red-100">
              Retour livreur : {deliveryIssueLabel(order.deliveryIssueReason)}
              {order.deliveryIssueNote ? ` — ${order.deliveryIssueNote}` : ''}
            </p>
            <button
              type="button"
              onClick={() => void onSetStatus(order.id, 'PREPARING')}
              className="w-full rounded-lg bg-amber-600 py-2 text-xs font-bold text-white hover:bg-amber-500"
            >
              Reprendre en cuisine
            </button>
            <button
              type="button"
              onClick={() => void onSetStatus(order.id, 'READY')}
              className="w-full rounded-lg bg-emerald-600 py-2 text-xs font-bold text-white hover:bg-emerald-500"
            >
              Corrigée — prête à repartir
            </button>
          </>
        )}
        <button
          type="button"
          onClick={() => onRequestCancel(order)}
          className="mt-1.5 flex w-full items-center justify-center gap-1.5 rounded-lg border border-red-500/40 bg-red-950/30 py-2 text-xs font-semibold text-red-200 hover:bg-red-900/40"
        >
          <Ban className="h-3.5 w-3.5" />
          Annuler la commande
        </button>
      </div>
    </article>
  )
}

function KitchenCancelSheet({
  order,
  loading,
  onClose,
  onConfirm,
}: {
  order: OpsOrder
  loading: boolean
  onClose: () => void
  onConfirm: (reason: OrderCancelReason, note?: string) => void
}) {
  const [reason, setReason] = useState<OrderCancelReason>('OUT_OF_STOCK')
  const [note, setNote] = useState('')

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#1A1412] p-5 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold text-cream">Annuler #{order.orderNumber}</h2>
            <p className="text-xs text-cream/50">
              La caisse et l&apos;historique seront mis à jour. Stock remis si lié au menu.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-cream/50 hover:bg-white/10"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <label className="mb-1 block text-xs font-medium text-cream/60">Motif</label>
        <select
          value={reason}
          onChange={(e) => setReason(e.target.value as OrderCancelReason)}
          className="mb-3 w-full rounded-xl border border-white/10 bg-charcoal px-3 py-2.5 text-sm text-cream"
        >
          {ORDER_CANCEL_REASONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>

        <label className="mb-1 block text-xs font-medium text-cream/60">Précision (optionnel)</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="Ex. plus de Coca 33 cl…"
          className="mb-4 w-full rounded-xl border border-white/10 bg-charcoal px-3 py-2 text-sm text-cream"
        />

        {order.paymentStatus === 'PAID' && order.sumupCheckoutId && (
          <p className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
            Paiement CB en ligne — remboursement SumUp automatique sur la carte du client.
          </p>
        )}
        {order.paymentStatus === 'PAID' && !order.sumupCheckoutId && (
          <p className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
            Commande déjà payée — rembourser le client au comptoir si nécessaire.
          </p>
        )}

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-xl border border-white/15 py-3 text-sm font-medium text-cream/70"
          >
            Retour
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => void onConfirm(reason, note.trim() || undefined)}
            className="rounded-xl bg-red-600 py-3 text-sm font-bold text-white hover:bg-red-500 disabled:opacity-50"
          >
            {loading ? 'Annulation…' : 'Confirmer l\'annulation'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ArchivePanel({
  orders,
  loading,
  authScope,
}: {
  orders: OpsOrder[]
  loading: boolean
  authScope: AuthScope
}) {
  const [printingId, setPrintingId] = useState<string | null>(null)

  async function handlePrint(orderId: string, type: 'KITCHEN' | 'BAG_LABEL') {
    const session = authScope === 'crm' ? getCrmSession() : authScope === 'device' ? getDeviceSession() : getStaffSession()
    if (!session) return
    setPrintingId(`${orderId}-${type}`)
    try {
      const { printJob, content } = await requestOrderPrint(orderId, type, session.token)
      const result = await handleKitchenPrintJob(
        {
          id: printJob.id,
          type,
          status: 'PENDING',
          payload: { text: content },
          orderId,
        },
        session.token,
      )
      if (!result.ok) {
        console.warn('[KDS print] Epson KO — relais caisse', result.error)
      }
    } finally {
      setPrintingId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-tomato-light" />
      </div>
    )
  }

  if (orders.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center text-cream/60">
        <Archive className="mb-3 h-10 w-10" />
        <p className="text-cream/80">Aucune commande archivée sur les 30 derniers jours</p>
      </div>
    )
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4">
      <div className="mx-auto grid max-w-[1600px] grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {orders.map((order) => (
          <ArchiveOrderCard
            key={order.id}
            order={order}
            printingId={printingId}
            onPrint={handlePrint}
          />
        ))}
      </div>
    </div>
  )
}

function ArchiveOrderCard({
  order,
  printingId,
  onPrint,
}: {
  order: OpsOrder
  printingId: string | null
  onPrint: (orderId: string, type: 'KITCHEN' | 'BAG_LABEL') => void
}) {
  const address = orderAddressLine(order)
  const itemCount = order.items.reduce((sum, i) => sum + i.quantity, 0)

  return (
    <article className="flex flex-col rounded-2xl border border-white/10 bg-[#1A1412] p-4 shadow-lg">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <p className="font-display text-3xl font-bold text-tomato-light">#{order.orderNumber}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <TypeBadge type={order.type} />
            <ChannelBadge order={order} />
            <span
              className={cn(
                'rounded-full px-2.5 py-0.5 text-xs font-semibold',
                orderStatusBadgeClass(order.status)
              )}
            >
              {ORDER_STATUS_LABEL[order.status] ?? order.status}
            </span>
          </div>
        </div>
        <p className="text-lg font-bold text-cream">{formatEUR(order.total)}</p>
      </div>

      <div className="mb-3 space-y-1 rounded-xl bg-white/[0.03] px-3 py-2 text-sm">
        <p className="font-semibold text-cream">{orderCustomerLine(order)}</p>
        {order.customerPhone && (
          <p className="flex items-center gap-1.5 text-cream/55">
            <Phone className="h-3.5 w-3.5" />
            {order.customerPhone}
          </p>
        )}
        {address && (
          <p className="flex items-start gap-1.5 text-cream/55">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {address}
          </p>
        )}
        <p className="text-xs text-cream/40">
          {new Date(order.createdAt).toLocaleDateString('fr-FR', {
            weekday: 'short',
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          })}
          {' · '}
          {itemCount} article{itemCount > 1 ? 's' : ''}
        </p>
      </div>

      <ul className="mb-3 flex-1 space-y-2 border-t border-white/10 pt-3">
        {order.items.map((item) => (
          <li key={item.id} className="text-xs text-cream/80">
            <OrderItemLines item={item} />
          </li>
        ))}
      </ul>

      {order.notes && (
        <p className="mb-3 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          {order.notes}
        </p>
      )}

      <div className="mt-auto border-t border-white/10 pt-3">
        <PrintTicketButtons orderId={order.id} printingId={printingId} onPrint={onPrint} />
      </div>
    </article>
  )
}
