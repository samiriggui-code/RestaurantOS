import { staffFetch } from '@/lib/staff-api'
import {
  fetchOrders,
  isMarketplaceChannel,
  ORDER_STATUS_LABEL,
  orderChannelLabel,
  orderTypeLabel,
  PAYMENT_STATUS_LABEL,
  type OpsOrder,
} from '@/lib/ops-orders'

export type PosLiveCategory =
  | 'order'
  | 'kitchen'
  | 'delivery'
  | 'stock'
  | 'reservation'
  | 'table'
  | 'system'

export type PosLiveActivity = {
  id: string
  at: string
  category: PosLiveCategory
  title: string
  detail?: string
  urgent?: boolean
}

type AdminLivePayload = {
  domain: string
  action?: string
  label?: string
  detail?: string
  at?: string
}

type StockRow = {
  id: string
  name: string
  quantity: number
  reorderAt: number | null
  unit: string
}

type ReservationRow = {
  id: string
  customerName: string
  guests: number
  dateTime: string
  status: string
  notes?: string | null
  table?: { name?: string | null } | null
}

function categoryForOrder(order: OpsOrder, kind: string): PosLiveCategory {
  if (order.type === 'DELIVERY') return 'delivery'
  if (['PREPARING', 'READY'].includes(order.status) || kind === 'kitchen') return 'kitchen'
  return 'order'
}

function orderKindLabel(kind: string): string {
  if (kind === 'new') return 'Nouvelle commande'
  if (kind === 'pending') return 'Attente paiement'
  if (kind === 'payment') return 'Paiement reçu'
  if (kind === 'cancel') return 'Commande annulée'
  if (kind === 'status') return 'Statut mis à jour'
  return 'Commande'
}

export function orderToPosActivity(order: OpsOrder, kind: string): PosLiveActivity {
  const channel = orderChannelLabel(order)
  const status = ORDER_STATUS_LABEL[order.status] ?? order.status
  const type = orderTypeLabel(order.type)
  const urgent =
    kind === 'new' ||
    kind === 'pending' ||
    order.status === 'READY' ||
    order.status === 'DELIVERY_ISSUE' ||
    (kind === 'new' && isMarketplaceChannel(order))

  return {
    id: `${order.id}-${kind}-${order.status}-${Date.now()}`,
    at: new Date().toISOString(),
    category: categoryForOrder(order, kind),
    title: `#${order.orderNumber} · ${orderKindLabel(kind)} · ${status}`,
    detail: `${channel} · ${type} · ${PAYMENT_STATUS_LABEL[order.paymentStatus] ?? order.paymentStatus}`,
    urgent,
  }
}

export function adminLiveToPosActivity(payload: AdminLivePayload): PosLiveActivity {
  const domain = payload.domain
  let category: PosLiveCategory = 'system'
  if (domain === 'stock') category = 'stock'
  if (domain === 'orders') category = 'order'

  return {
    id: `admin-${domain}-${payload.action}-${Date.now()}`,
    at: payload.at ?? new Date().toISOString(),
    category,
    title: payload.label ?? 'Mise à jour boutique',
    detail: payload.detail,
    urgent: domain === 'stock' && payload.action === 'move',
  }
}

export function stockAlertToPosActivity(item: StockRow): PosLiveActivity | null {
  if (item.reorderAt == null || item.quantity > item.reorderAt) return null
  return {
    id: `stock-${item.id}-${Date.now()}`,
    at: new Date().toISOString(),
    category: 'stock',
    title: `Stock bas · ${item.name}`,
    detail: `${item.quantity} ${item.unit} (seuil ${item.reorderAt})`,
    urgent: true,
  }
}

export function reservationToPosActivity(row: ReservationRow): PosLiveActivity {
  const time = new Date(row.dateTime).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  })
  const table = row.table?.name ? ` · ${row.table.name}` : ''
  return {
    id: `res-${row.id}`,
    at: row.dateTime,
    category: 'reservation',
    title: `Réservation ${time} · ${row.customerName}`,
    detail: `${row.guests} pers.${table}${row.notes ? ` — ${row.notes}` : ''}`,
  }
}

export function tableServiceToPosActivity(tableId: string, message: string): PosLiveActivity {
  return {
    id: `table-${tableId}-${Date.now()}`,
    at: new Date().toISOString(),
    category: 'table',
    title: `Appel table · ${tableId}`,
    detail: message,
    urgent: true,
  }
}

const ACTIVE_STATUSES =
  'PENDING_PAYMENT,CONFIRMED,PREPARING,READY,OUT_FOR_DELIVERY,DELIVERY_ISSUE'

export async function fetchPosLiveSnapshot(token: string): Promise<PosLiveActivity[]> {
  const today = new Date().toISOString().slice(0, 10)
  const [orders, stock, reservations] = await Promise.all([
    fetchOrders(token, { status: ACTIVE_STATUSES, limit: 40 }),
    staffFetch<StockRow[]>('/stock', { token }).catch(() => [] as StockRow[]),
    staffFetch<ReservationRow[]>(`/reservations?date=${today}`, { token }).catch(
      () => [] as ReservationRow[],
    ),
  ])

  const items: PosLiveActivity[] = []

  for (const order of orders) {
    items.push(orderToPosActivity(order, 'snapshot'))
  }

  for (const row of stock) {
    const alert = stockAlertToPosActivity(row)
    if (alert) items.push(alert)
  }

  for (const row of reservations.filter((r) => r.status !== 'CANCELLED' && r.status !== 'COMPLETED')) {
    items.push(reservationToPosActivity(row))
  }

  items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
  return items.slice(0, 35)
}
