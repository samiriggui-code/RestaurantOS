import { staffFetch } from '@/lib/staff-api'

export type PosSession = {
  id: string
  businessId: string
  cashierId: string
  status: 'OPEN' | 'CLOSED'
  openedAt: string
  openingCashAmount: number
  closedAt: string | null
  closingCashAmount: number | null
  expectedCashAmount: number | null
  discrepancy: number | null
  notes: string | null
}

export async function fetchCurrentPosSession(token: string): Promise<PosSession | null> {
  return staffFetch<PosSession | null>('/pos/session/current', { token, scope: 'device' })
}

export async function openPosSession(token: string, openingCashAmount: number): Promise<PosSession> {
  return staffFetch<PosSession>('/pos/session/open', {
    method: 'POST',
    token,
    scope: 'device',
    body: JSON.stringify({ openingCashAmount }),
  })
}

export async function closePosSession(
  token: string,
  sessionId: string,
  closingCashAmount: number,
  notes?: string,
): Promise<PosSession> {
  return staffFetch<PosSession>(`/pos/session/${sessionId}/close`, {
    method: 'POST',
    token,
    scope: 'device',
    body: JSON.stringify({ closingCashAmount, notes }),
  })
}

export type MergeableOrder = {
  id: string
  orderNumber: number
  type: string
  status: string
  total: number
  tableId: string | null
  customerName: string | null
}

/** Commandes ouvertes (non payées, non clôturées) éligibles à la fusion. */
export async function fetchMergeableOrders(token: string): Promise<MergeableOrder[]> {
  const orders = await staffFetch<MergeableOrder[]>(
    '/orders?paymentStatus=UNPAID&includeUnpaid=true',
    { token, scope: 'device' },
  )
  return orders.filter((o) => !['COMPLETED', 'DELIVERED', 'CANCELLED'].includes(o.status))
}

export async function mergeOrders(
  token: string,
  targetOrderId: string,
  sourceOrderIds: string[],
): Promise<{ target: unknown }> {
  return staffFetch('/orders/merge', {
    method: 'POST',
    token,
    scope: 'device',
    body: JSON.stringify({ targetOrderId, sourceOrderIds }),
  })
}

export type TransferableTable = { id: string; number: string; capacity: number; status: string }

/** Tables du restaurant, pour choisir la cible d'un transfert de commande. */
export async function fetchTransferableTables(token: string): Promise<TransferableTable[]> {
  return staffFetch<TransferableTable[]>('/tables', { token, scope: 'device' })
}

/** Réassigne une commande ouverte à une autre table (Phase F). */
export async function transferOrder(
  token: string,
  orderId: string,
  tableId: string,
): Promise<{ order: unknown }> {
  return staffFetch(`/orders/${orderId}/transfer`, {
    method: 'PATCH',
    token,
    scope: 'device',
    body: JSON.stringify({ tableId }),
  })
}
