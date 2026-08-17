import { staffFetch } from '@/lib/staff-api'



export type OnlineLineSnapshot = {

  slug?: string

  name?: string

  categoryId?: string

  sizeLabel?: string

  sizeId?: string

  offerTag?: string

}



export type OpsOrderItem = {

  id: string

  quantity: number

  price: number

  status: string

  notes?: string | null

  selectedModifiers?: OnlineLineSnapshot | Record<string, unknown> | null

  menuItem: { name?: string | null; nameAr?: string | null }

}



export type OpsOrder = {

  id: string

  orderNumber: number

  status: string

  type: string

  paymentStatus: string

  paymentMethod?: string | null

  stripePaymentIntentId?: string | null

  isOnlineOrder?: boolean

  channel?: string | null

  customerName?: string | null

  customerPhone?: string | null

  customerEmail?: string | null

  notes?: string | null

  cancelledAt?: string | null

  cancelReason?: string | null

  cancelNote?: string | null

  createdAt: string

  subtotal: number

  total: number

  deliveryAddress?: string | null

  deliveryPostalCode?: string | null

  deliveryCity?: string | null

  deliveryIssueReason?: string | null

  deliveryIssueNote?: string | null

  deliveryRouteOrder?: number | null

  trackingToken?: string | null

  driverLat?: number | null

  driverLng?: number | null

  deliveryLat?: number | null

  deliveryLng?: number | null

  driverLocationAt?: string | null

  driverId?: string | null

  driver?: { id: string; name: string } | null

  driverTrail?: unknown

  items: OpsOrderItem[]

  table?: { number: string | number } | null

}



export const KITCHEN_STATUSES = 'CONFIRMED,PENDING,PREPARING,READY,OUT_FOR_DELIVERY,DELIVERY_ISSUE'

/** Commande visible sur le KDS (à emporter READY = file POS uniquement). */
export function isKitchenVisibleOrder(order: OpsOrder): boolean {
  if (['DELIVERED', 'CANCELLED', 'COMPLETED'].includes(order.status)) return false
  if (order.status === 'READY' && order.type !== 'DELIVERY') return false
  return KITCHEN_STATUSES.split(',').includes(order.status)
}

/** Paiement au comptoir en ligne — seule file avec bouton Encaisser au POS. */
export function isPosEncashmentOrder(order: OpsOrder): boolean {
  return (
    Boolean(order.isOnlineOrder) &&
    order.status === 'PENDING_PAYMENT' &&
    order.paymentStatus === 'UNPAID' &&
    order.paymentMethod === 'COUNTER'
  )
}

/** À emporter / sur place déjà payé — remise client au POS (pas de ré-encaissement). */
export function isPosHandoverOrder(order: OpsOrder): boolean {
  return (
    order.status === 'READY' &&
    order.paymentStatus === 'PAID' &&
    order.type !== 'DELIVERY'
  )
}

/** Livraisons payées — suivi cuisine / livreur (pas d'encaissement POS). */
export function isPosDeliveryOrder(order: OpsOrder): boolean {
  return (
    order.type === 'DELIVERY' &&
    order.paymentStatus === 'PAID' &&
    (order.status === 'READY' || order.status === 'OUT_FOR_DELIVERY')
  )
}



export const ORDER_STATUS_LABEL: Record<string, string> = {

  PENDING_PAYMENT: 'En attente paiement',

  PENDING: 'En attente',

  CONFIRMED: 'Confirmée',

  PREPARING: 'En préparation',

  READY: 'Prête',

  OUT_FOR_DELIVERY: 'En livraison',

  DELIVERY_ISSUE: 'Retour livreur',

  DELIVERED: 'Livrée',

  COMPLETED: 'Terminée',

  CANCELLED: 'Annulée',

}

/** Colonnes KDS — source unique pour cuisine / admin live. */
export const ORDER_KANBAN_COLUMNS = [
  { id: 'todo', title: 'À préparer', statuses: ['PENDING', 'CONFIRMED'], accent: 'border-amber-500/40' },
  { id: 'prep', title: 'En préparation', statuses: ['PREPARING'], accent: 'border-blue-500/40' },
  {
    id: 'ready',
    title: 'Livraisons',
    statuses: ['READY', 'OUT_FOR_DELIVERY', 'DELIVERY_ISSUE'],
    accent: 'border-violet-500/40',
  },
] as const

export type OrderKanbanColumn = (typeof ORDER_KANBAN_COLUMNS)[number]

/** Étapes suivi client — click & collect / sur place. */
export const ORDER_TRACKING_STEPS_PICKUP = [
  { key: 'PENDING_PAYMENT', label: 'Paiement' },
  { key: 'CONFIRMED', label: 'Confirmée' },
  { key: 'PREPARING', label: 'Préparation' },
  { key: 'READY', label: 'Prête' },
  { key: 'COMPLETED', label: 'Remise client' },
] as const

/** Étapes suivi client — livraison. */
export const ORDER_TRACKING_STEPS_DELIVERY = [
  { key: 'PENDING_PAYMENT', label: 'Paiement' },
  { key: 'CONFIRMED', label: 'Confirmée' },
  { key: 'PREPARING', label: 'Préparation' },
  { key: 'READY', label: 'Prête' },
  { key: 'OUT_FOR_DELIVERY', label: 'En route' },
  { key: 'DELIVERED', label: 'Livrée' },
] as const

export function orderTrackingStepIndex(status: string, isDelivery: boolean): number {
  const steps = isDelivery ? ORDER_TRACKING_STEPS_DELIVERY : ORDER_TRACKING_STEPS_PICKUP
  const idx = steps.findIndex((s) => s.key === status)
  if (idx >= 0) return idx
  if (status === 'COMPLETED' || status === 'DELIVERED') return steps.length - 1
  if (status === 'PENDING') return 1
  return 0
}

export function isAwaitingPrep(status: string): boolean {

  return status === 'PENDING' || status === 'CONFIRMED'

}

export function orderStatusBadgeClass(status: string): string {
  if (isAwaitingPrep(status)) return 'bg-amber-500/20 text-amber-200'
  if (status === 'PREPARING') return 'bg-blue-500/20 text-blue-200'
  if (status === 'READY') return 'bg-emerald-500/20 text-emerald-200'
  if (status === 'OUT_FOR_DELIVERY') return 'bg-violet-500/20 text-violet-200'
  if (status === 'DELIVERY_ISSUE') return 'bg-red-500/25 text-red-200'
  return 'bg-white/10 text-cream/60'
}

/** Libellé court livraison (admin / livreur). */
export function deliveryQueueStatusLabel(status: string): string {
  if (status === 'OUT_FOR_DELIVERY') return 'En route'
  if (status === 'READY') return ORDER_STATUS_LABEL.READY
  return ORDER_STATUS_LABEL[status] ?? status
}

export type DriverTrailPoint = { lat: number; lng: number; at?: string }

export function parseDriverTrail(raw: unknown): DriverTrailPoint[] {
  if (!Array.isArray(raw)) return []
  return raw.filter(
    (p): p is DriverTrailPoint =>
      p != null &&
      typeof p === 'object' &&
      typeof (p as DriverTrailPoint).lat === 'number' &&
      typeof (p as DriverTrailPoint).lng === 'number',
  )
}

/** Transitions autorisées depuis le KDS selon type de commande. */
export function getKitchenStatusTransitions(
  order: Pick<OpsOrder, 'type' | 'status'>
): Array<{ status: string; label: string }> {
  const { type, status } = order
  const out: Array<{ status: string; label: string }> = []

  if (isAwaitingPrep(status)) {
    out.push({ status: 'PREPARING', label: ORDER_STATUS_LABEL.PREPARING })
  }
  if (status === 'PREPARING') {
    out.push({ status: 'READY', label: ORDER_STATUS_LABEL.READY })
  }
  if (status === 'READY' && type === 'DELIVERY') {
    out.push({ status: 'OUT_FOR_DELIVERY', label: ORDER_STATUS_LABEL.OUT_FOR_DELIVERY })
  }
  if (status === 'OUT_FOR_DELIVERY' && type === 'DELIVERY') {
    out.push({ status: 'DELIVERY_ISSUE', label: ORDER_STATUS_LABEL.DELIVERY_ISSUE })
    out.push({ status: 'PREPARING', label: 'Retour cuisine' })
  }
  if (status === 'DELIVERY_ISSUE') {
    out.push({ status: 'PREPARING', label: 'Retour cuisine' })
  }
  return out
}

export function kanbanColumnForStatus(status: string): OrderKanbanColumn {
  return (
    ORDER_KANBAN_COLUMNS.find((c) => (c.statuses as readonly string[]).includes(status)) ??
    ORDER_KANBAN_COLUMNS[0]
  )
}



export const ORDER_TYPE_LABEL: Record<string, string> = {

  DINE_IN: 'Sur place',

  TAKEAWAY: 'À emporter',

  DELIVERY: 'Livraison',

}



export const PAYMENT_STATUS_LABEL: Record<string, string> = {

  UNPAID: 'Non payée',

  PAID: 'Payée',

  REFUNDED: 'Remboursée',

}



export const ORDER_CANCEL_REASONS = [
  { value: 'CLIENT_REFUSED', label: 'Client refuse' },
  { value: 'OUT_OF_STOCK', label: 'Stock épuisé (boisson, etc.)' },
  { value: 'MISSING_INGREDIENT', label: 'Ingrédient manquant' },
  { value: 'INCIDENT', label: 'Incident cuisine' },
  { value: 'OTHER', label: 'Autre motif' },
] as const

export type OrderCancelReason = (typeof ORDER_CANCEL_REASONS)[number]['value']

export const CANCEL_REASON_LABEL: Record<OrderCancelReason, string> = Object.fromEntries(
  ORDER_CANCEL_REASONS.map((r) => [r.value, r.label])
) as Record<OrderCancelReason, string>



export const ITEM_STATUS_LABEL: Record<string, string> = {

  PENDING: 'À faire',

  CONFIRMED: 'À faire',

  PREPARING: 'En cours',

  READY: 'Prêt',

}



const CATEGORY_LABEL: Record<string, string> = {

  tomate: 'Pizza tomate',

  creme: 'Pizza crème',

  'z-pizzas': 'Z Pizza',

  boissons: 'Boisson',

  desserts: 'Dessert',

  supplements: 'Supplément',

}



const GENERIC_MENU_NAMES = new Set(['Ligne commande en ligne', 'Article', 'Commande en ligne (interne)'])



function lineSnapshot(item: OpsOrderItem): OnlineLineSnapshot | null {

  const raw = item.selectedModifiers

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null

  const snap = raw as OnlineLineSnapshot

  return snap.name || snap.slug || snap.categoryId || snap.sizeLabel ? snap : null

}



export function itemLabel(item: OpsOrderItem): string {

  const snap = lineSnapshot(item)

  if (snap?.name?.trim()) return snap.name.trim()



  const dbName = item.menuItem.name?.trim() || item.menuItem.nameAr?.trim()

  if (dbName && !GENERIC_MENU_NAMES.has(dbName)) return dbName



  return 'Article'

}



function formatOfferTag(tag: string): string {

  if (tag === 'formule-duo') return 'Formule menu — boisson'

  if (tag === 'formule-dessert' || tag === 'menu_dessert') return 'Formule menu — dessert'

  if (tag === 'extra') return 'Extra'

  return tag

}



/** Sous-lignes : taille, formule, catégorie, note client sur la ligne */

export function itemExtras(item: OpsOrderItem): string[] {

  const extras: string[] = []

  const snap = lineSnapshot(item)



  if (snap?.categoryId && CATEGORY_LABEL[snap.categoryId]) {

    extras.push(CATEGORY_LABEL[snap.categoryId])

  }



  if (snap?.sizeLabel?.trim()) {

    extras.push(`Taille : ${snap.sizeLabel.trim()}`)

  } else if (item.notes) {

    const parts = item.notes.split(' · ')

    const sizePart = parts.find((p) => p && !p.startsWith('Offre:'))

    if (sizePart) extras.push(`Taille : ${sizePart}`)

  }



  if (snap?.offerTag?.trim()) {

    extras.push(formatOfferTag(snap.offerTag.trim()))

  } else if (item.notes?.includes('Offre:')) {

    const offer = item.notes.split(' · ').find((p) => p.startsWith('Offre:'))

    if (offer) extras.push(offer.replace(/^Offre:\s*/, ''))

  }



  if (item.notes && !item.notes.includes(' · ') && !extras.some((e) => e.includes(item.notes!))) {

    extras.push(item.notes)

  }



  return extras

}



export function fetchKitchenOrders(token: string) {
  return staffFetch<OpsOrder[]>(`/orders?status=${KITCHEN_STATUSES}`, { token })
}

/** File caisse — préparation + remise client + livraisons (payées uniquement). */
export function fetchPosDistributionQueue(token: string) {
  return fetchOrders(token, {
    status: 'CONFIRMED,PREPARING,READY,OUT_FOR_DELIVERY,DELIVERY_ISSUE',
    paymentStatus: 'PAID',
    limit: 150,
  })
}

/** Commandes terminées aujourd'hui — visibilité caissière. */
export function fetchPosDistributionDoneToday(token: string) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  return fetchOrders(token, {
    status: 'COMPLETED,DELIVERED',
    paymentStatus: 'PAID',
    dateFrom: today.toISOString(),
    dateTo: tomorrow.toISOString(),
    limit: 60,
  })
}

export type PosDistributionPhase =
  | 'preparing'
  | 'handover'
  | 'await_driver'
  | 'delivering'
  | 'issue'
  | 'done'

export function getPosDistributionPhase(order: OpsOrder): PosDistributionPhase {
  if (['COMPLETED', 'DELIVERED'].includes(order.status)) return 'done'
  if (order.status === 'DELIVERY_ISSUE') return 'issue'
  if (order.status === 'OUT_FOR_DELIVERY') return 'delivering'
  if (order.status === 'READY') {
    if (order.type === 'DELIVERY') {
      return order.driverId ? 'delivering' : 'await_driver'
    }
    return 'handover'
  }
  if (['CONFIRMED', 'PREPARING', 'PENDING'].includes(order.status)) return 'preparing'
  return 'preparing'
}

export const POS_DISTRIBUTION_SECTIONS = [
  { id: 'preparing', label: 'En préparation', empty: 'Rien en cuisine' },
  { id: 'handover', label: 'À remettre', empty: 'Aucune remise en attente' },
  { id: 'await_driver', label: 'Attente livreur', empty: 'Aucune livraison en attente' },
  { id: 'delivering', label: 'En livraison', empty: 'Aucune en route' },
  { id: 'done', label: 'Terminées', empty: 'Rien terminé aujourd\'hui' },
] as const

export type PosDistributionSectionId = (typeof POS_DISTRIBUTION_SECTIONS)[number]['id']

export function posDistributionBadge(order: OpsOrder): { label: string; className: string } {
  const phase = getPosDistributionPhase(order)
  switch (phase) {
    case 'preparing':
      return {
        label: ORDER_STATUS_LABEL[order.status] ?? 'En préparation',
        className:
          order.status === 'PREPARING'
            ? 'bg-blue-500/30 text-blue-100 ring-1 ring-blue-400/50'
            : 'bg-amber-500/30 text-amber-100 ring-1 ring-amber-400/50',
      }
    case 'handover':
      return {
        label: `Prête · ${ORDER_TYPE_LABEL[order.type] ?? order.type}`,
        className: 'bg-emerald-500/30 text-emerald-100 ring-1 ring-emerald-400/50',
      }
    case 'await_driver':
      return {
        label: 'Prête · Attente livreur',
        className: 'bg-violet-500/30 text-violet-100 ring-1 ring-violet-400/50',
      }
    case 'delivering':
      if (order.status === 'DELIVERY_ISSUE') {
        return { label: 'Retour livreur', className: 'bg-red-500/30 text-red-100 ring-1 ring-red-400/50' }
      }
      return {
        label: order.driver?.name ? `En route · ${order.driver.name}` : 'En livraison',
        className: 'bg-violet-500/30 text-violet-100 ring-1 ring-violet-400/50',
      }
    case 'issue':
      return {
        label: 'Incident livraison',
        className: 'bg-red-500/30 text-red-100 ring-1 ring-red-400/50',
      }
    case 'done':
      return {
        label: order.status === 'DELIVERED' ? 'Livrée' : 'Remise client',
        className: 'bg-white/15 text-cream/70',
      }
  }
}

export function ordersForDistributionSection(
  orders: OpsOrder[],
  sectionId: PosDistributionSectionId,
): OpsOrder[] {
  if (sectionId === 'preparing') {
    return orders.filter((o) => getPosDistributionPhase(o) === 'preparing')
  }
  if (sectionId === 'handover') {
    return orders.filter((o) => getPosDistributionPhase(o) === 'handover')
  }
  if (sectionId === 'await_driver') {
    return orders.filter((o) => getPosDistributionPhase(o) === 'await_driver')
  }
  if (sectionId === 'delivering') {
    return orders.filter((o) => ['delivering', 'issue'].includes(getPosDistributionPhase(o)))
  }
  return orders.filter((o) => getPosDistributionPhase(o) === 'done')
}

const ARCHIVE_STATUSES = 'COMPLETED,DELIVERED,CANCELLED'

export function fetchKitchenArchive(token: string) {
  const to = new Date()
  const from = new Date()
  from.setDate(from.getDate() - 30)
  return fetchOrders(token, {
    status: ARCHIVE_STATUSES,
    dateFrom: from.toISOString(),
    dateTo: to.toISOString(),
    limit: 500,
  })
}

import { isNativeDeviceApp } from '@/lib/print/print-context'
import { printOnSunmi } from '@/lib/print/sunmi-printer'
import type { PaymentMeta } from '@/lib/payment/payment-meta'

export type PrintTicketType = 'KITCHEN' | 'BAG_LABEL' | 'RECEIPT'

export function requestOrderPrint(
  orderId: string,
  type: PrintTicketType,
  token: string,
  opts?: { reprint?: boolean },
) {
  return staffFetch<{ printJob: { id: string }; content: string }>(`/orders/${orderId}/print`, {
    method: 'POST',
    body: JSON.stringify({ type, reprint: opts?.reprint === true }),
    token,
  })
}

/** Fenêtre navigateur (secours CRM / navigateur bureau uniquement). */
export function printBrowserTicket(content: string, title = 'Ticket', type?: PrintTicketType) {
  if (isNativeDeviceApp()) {
    console.warn('[print] Aperçu navigateur ignoré sur terminal natif (POS/KDS/SUNMI)')
    return
  }

  const w = window.open('', '_blank', 'width=420,height=720')
  if (!w) return

  const escaped = content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  const isBag = type === 'BAG_LABEL'
  const bodyClass = isBag ? 'bag-label' : ''

  w.document.write(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${title}</title>
<style>
  * { box-sizing: border-box; }
  body {
    font-family: 'Courier New', Courier, monospace;
    font-size: ${isBag ? '15px' : '14px'};
    line-height: 1.45;
    margin: 20px;
    color: #111;
    background: #fff;
    white-space: pre-wrap;
  }
  body.bag-label { font-size: 16px; font-weight: 600; }
  @media print { body { margin: 8mm; } }
</style></head>
<body class="${bodyClass}">${escaped}</body></html>`)
  w.document.close()
  w.focus()
  w.print()
}

/** Impression : SUNMI natif (V2 reçu) ou fenêtre navigateur. Cuisine KDS → utiliser printKitchenTicketFromDevice. */
export function printTicketText(content: string, title = 'Ticket', type?: PrintTicketType) {
  const sunmiType =
    type === 'RECEIPT' ? 'RECEIPT' : type === 'BAG_LABEL' ? 'KITCHEN' : type ?? 'KITCHEN'
  if (sunmiType === 'RECEIPT' && printOnSunmi(content, sunmiType)) return
  printBrowserTicket(content, title, type)
}



export type OrderListQuery = {
  status?: string
  type?: string
  dateFrom?: string
  dateTo?: string
  isOnlineOrder?: boolean
  paymentStatus?: string
  paymentMethod?: string
  channel?: string
  limit?: number
  /** Inclure commandes PENDING_PAYMENT + UNPAID (comptoir web non encaissé) */
  includeUnpaid?: boolean
}

export function fetchOrders(token: string, query: OrderListQuery = {}) {
  const params = new URLSearchParams()
  if (query.status) params.set('status', query.status)
  if (query.type) params.set('type', query.type)
  if (query.dateFrom) params.set('dateFrom', query.dateFrom)
  if (query.dateTo) params.set('dateTo', query.dateTo)
  if (query.isOnlineOrder !== undefined) params.set('isOnlineOrder', String(query.isOnlineOrder))
  if (query.paymentStatus) params.set('paymentStatus', query.paymentStatus)
  if (query.paymentMethod) params.set('paymentMethod', query.paymentMethod)
  if (query.channel) params.set('channel', query.channel)
  if (query.limit) params.set('limit', String(query.limit))
  if (query.includeUnpaid) params.set('includeUnpaid', 'true')
  const q = params.toString()
  return staffFetch<OpsOrder[]>(`/orders${q ? `?${q}` : ''}`, { token })
}

export function fetchAdminOrders(token: string, status?: string) {
  return fetchOrders(token, { status, limit: 250 })
}

/** Commandes « payer au comptoir » — seules à encaisser au POS. */
export function fetchOnlineOrdersForPos(token: string) {
  return fetchOrders(token, {
    isOnlineOrder: true,
    status: 'PENDING_PAYMENT',
    paymentStatus: 'UNPAID',
    paymentMethod: 'COUNTER',
    limit: 30,
  })
}

/** Commandes prêtes à remettre au client (déjà payées, hors livraison). */
export function fetchPosHandoverQueue(token: string) {
  return fetchOrders(token, {
    status: 'READY',
    paymentStatus: 'PAID',
    limit: 40,
  }).then((orders) => orders.filter((o) => o.type !== 'DELIVERY'))
}

/** @deprecated Utiliser fetchPosHandoverQueue */
export const fetchPosReadyQueue = fetchPosHandoverQueue

/** Livraisons payées — prêtes ou en route (suivi, pas d'encaissement). */
export function fetchPosDeliveryQueue(token: string) {
  return fetchOrders(token, {
    status: 'READY,OUT_FOR_DELIVERY',
    type: 'DELIVERY',
    paymentStatus: 'PAID',
    limit: 30,
  })
}

export function encashOnlineOrder(
  orderId: string,
  paymentMethod: 'CASH' | 'CARD',
  token: string,
  paymentMeta?: PaymentMeta,
) {
  return staffFetch<OpsOrder>(`/orders/${orderId}/encash`, {
    method: 'PATCH',
    body: JSON.stringify({ paymentMethod, paymentMeta }),
    token,
  })
}

export function settlePosOrder(
  orderId: string,
  token: string,
  payload: { action: 'pay'; paymentMethod: 'CASH' | 'CARD' } | { action: 'handover' }
) {
  return staffFetch<OpsOrder>(`/orders/${orderId}/pos-settle`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
    token,
  })
}

export function orderOriginLabel(order: OpsOrder): string {
  return orderChannelLabel(order)
}

/** Canal commande — POS, WEB, marketplaces, kiosque. */
export function orderChannelLabel(order: OpsOrder): string {
  const channel = effectiveOrderChannel(order)
  if (channel === 'DELIVEROO') return 'Deliveroo'
  if (channel === 'UBER_EATS') return 'Uber Eats'
  if (channel === 'KIOSK') return 'Totem'
  if (channel === 'WEB') return 'Site web'
  if (channel === 'POS') return 'Comptoir'
  return order.isOnlineOrder ? 'Site web' : 'Comptoir'
}

export function effectiveOrderChannel(order: OpsOrder): string {
  if (order.channel) return order.channel
  return order.isOnlineOrder ? 'WEB' : 'POS'
}

export function isMarketplaceChannel(order: OpsOrder): boolean {
  const channel = effectiveOrderChannel(order)
  return channel === 'DELIVEROO' || channel === 'UBER_EATS'
}

export function orderChannelBadgeClass(order: OpsOrder): string {
  const channel = effectiveOrderChannel(order)
  if (channel === 'DELIVEROO') return 'border border-[#00ccbc]/50 bg-[#00ccbc]/20 text-[#b8fff8] font-bold'
  if (channel === 'UBER_EATS') return 'border border-[#06c167]/50 bg-[#06c167]/20 text-white font-bold'
  if (channel === 'KIOSK') return 'bg-purple-500/20 text-purple-200'
  if (channel === 'WEB') return 'bg-sky-500/20 text-sky-200'
  return 'bg-white/10 text-cream/70'
}

export function orderChannelShortLabel(order: OpsOrder): string {
  const channel = effectiveOrderChannel(order)
  if (channel === 'DELIVEROO') return 'ROO'
  if (channel === 'UBER_EATS') return 'UBER'
  return orderChannelLabel(order)
}



export function updateOrderStatus(id: string, status: string, token: string) {

  return staffFetch<OpsOrder>(`/orders/${id}/status`, {

    method: 'PATCH',

    body: JSON.stringify({ status }),

    token,

  })

}

export type DriverOnDuty = { id: string; name: string }

export async function fetchDriversOnDutyStaff(token: string): Promise<DriverOnDuty[]> {
  const res = await staffFetch<{ success: boolean; drivers: DriverOnDuty[] }>(
    '/delivery/drivers-on-duty',
    { token },
  )
  return res.drivers ?? []
}

export function assignDeliveryDriver(orderId: string, driverId: string, token: string) {
  return staffFetch<OpsOrder>(`/orders/${orderId}/assign-driver`, {
    method: 'PATCH',
    body: JSON.stringify({ driverId }),
    token,
  })
}

export function cancelOrder(
  orderId: string,
  token: string,
  payload: {
    reason: OrderCancelReason
    note?: string
    source?: 'KITCHEN' | 'POS' | 'ADMIN'
    refund?: boolean
  }
) {
  return staffFetch<OpsOrder>(`/orders/${orderId}/cancel`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
    token,
  })
}



export function createCounterOrder(
  token: string,
  data: {
    items: {
      menuItemId: string
      quantity: number
      price?: number
      notes?: string | null
      selectedModifiers?: Record<string, unknown>
    }[]
    type: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY'
    paymentMethod: 'CASH' | 'CARD'
    customerName?: string
    customerPhone?: string
    notes?: string
    paymentMeta?: PaymentMeta
  },
) {
  return staffFetch<OpsOrder>('/orders', {
    method: 'POST',
    token,
    body: JSON.stringify({
      ...data,
      paymentStatus: 'PAID',
      isOnlineOrder: false,
    }),
  })
}

/** Alias — comptoir fast-food : payé puis cuisine. */
export const sendCounterOrderToKitchen = createCounterOrder

export function updateItemStatus(orderId: string, itemId: string, status: string, token: string) {
  return staffFetch(`/orders/${orderId}/items/${itemId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
    token,
  })
}



export function orderTypeLabel(type: string): string {

  return ORDER_TYPE_LABEL[type] ?? type

}



export function orderCustomerLine(order: OpsOrder): string {

  if (order.customerName) return order.customerName

  if (order.table?.number != null) return `Table ${order.table.number}`

  return 'Client'

}



export function orderAddressLine(order: OpsOrder): string | null {

  if (order.type !== 'DELIVERY') return null

  const parts = [order.deliveryAddress, order.deliveryPostalCode, order.deliveryCity].filter(Boolean)

  return parts.length > 0 ? parts.join(', ') : null

}


