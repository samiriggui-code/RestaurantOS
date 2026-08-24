const DRIVER_PIN_KEY = 'pizzeria_driver_pin'
const DRIVER_USER_KEY = 'pizzeria_driver_user_id'

export type DeliveryStop = {
  id: string
  orderNumber: number
  status: string
  trackingToken: string | null
  customerName: string | null
  customerPhone: string | null
  deliveryAddress: string | null
  deliveryPostalCode: string | null
  deliveryCity: string | null
  deliveryLat: number | null
  deliveryLng: number | null
  deliveryRouteOrder: number | null
  scheduledAt: string | null
  total: number
  notes: string | null
  distanceKm: number | null
  legDistanceKm?: number | null
  routePosition: number
  driverId?: string | null
  driverName?: string | null
}

export type DriverDayRecapItem = {
  id: string
  orderNumber: number
  status: 'DELIVERED' | 'DELIVERY_ISSUE'
  customerName: string | null
  deliveryCity: string | null
  total: number
  completedAt: string
  issueReason?: string | null
}

export type DriverDayRecap = {
  dateLabel: string
  deliveredCount: number
  issueCount: number
  totalRevenueCents: number
  items: DriverDayRecapItem[]
}

export type DriverStopsResponse = {
  success: boolean
  depot: { lat: number; lng: number }
  origin?: { lat: number; lng: number }
  originFromGps?: boolean
  routeTotalKm?: number
  stops: DeliveryStop[]
  totalStops: number
  enRoute: number
  ready: number
  error?: string
}

export type DriverProfile = { id: string; name: string }

export function getStoredDriverPin(): string | null {
  if (typeof window === 'undefined') return null
  return sessionStorage.getItem(DRIVER_PIN_KEY)
}

export function setStoredDriverPin(pin: string) {
  sessionStorage.setItem(DRIVER_PIN_KEY, pin)
}

export function clearStoredDriverPin() {
  sessionStorage.removeItem(DRIVER_PIN_KEY)
  sessionStorage.removeItem(DRIVER_USER_KEY)
}

export function getStoredDriverUserId(): string | null {
  if (typeof window === 'undefined') return null
  return sessionStorage.getItem(DRIVER_USER_KEY)
}

export function setStoredDriverUserId(userId: string) {
  sessionStorage.setItem(DRIVER_USER_KEY, userId)
}

export function driverAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {}
  const pin = getStoredDriverPin()
  const userId = getStoredDriverUserId()
  if (pin) headers['x-driver-pin'] = pin
  if (userId) headers['x-driver-user-id'] = userId
  return headers
}

export async function verifyDriverPin(
  pin: string,
): Promise<{ ok: boolean; driverUserId?: string | null }> {
  const res = await fetch('/api/public/delivery/verify-pin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin }),
  })
  const data = await res.json()
  if (!res.ok) return { ok: false }
  setStoredDriverPin(pin)
  if (data.driverUserId) setStoredDriverUserId(data.driverUserId)
  return { ok: Boolean(data.success), driverUserId: data.driverUserId ?? null }
}

export async function fetchDriversOnDuty(): Promise<DriverProfile[]> {
  const res = await fetch('/api/public/delivery/drivers', {
    headers: driverAuthHeaders(),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Livreurs indisponibles')
  return (data.drivers ?? []) as DriverProfile[]
}

export async function fetchDriverStops(opts?: {
  driverLat?: number
  driverLng?: number
  pin?: string
}): Promise<DriverStopsResponse> {
  const params = new URLSearchParams()
  if (opts?.driverLat != null) params.set('driverLat', String(opts.driverLat))
  if (opts?.driverLng != null) params.set('driverLng', String(opts.driverLng))

  const headers = driverAuthHeaders()
  if (opts?.pin) headers['x-driver-pin'] = opts.pin

  const res = await fetch(`/api/public/delivery/stops?${params}`, { headers })
  const data = (await res.json()) as DriverStopsResponse
  if (!res.ok) throw new Error(data.error ?? 'Chargement impossible')
  return data
}

export async function fetchDriverDayRecap(): Promise<DriverDayRecap> {
  const res = await fetch('/api/public/delivery/day-recap', {
    headers: driverAuthHeaders(),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Récap indisponible')
  return data.recap as DriverDayRecap
}

export async function postDriverLocation(
  orderId: string,
  coords: { lat: number; lng: number },
): Promise<{ success: boolean; order?: { status: string; driverName?: string | null } }> {
  const res = await fetch(`/api/driver/orders/${encodeURIComponent(orderId)}/location`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...driverAuthHeaders() },
    body: JSON.stringify(coords),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Erreur GPS')
  return data
}

export async function confirmDriverDelivery(
  orderId: string,
  code: string,
): Promise<{ success: boolean; order?: { status: string } }> {
  const res = await fetch(`/api/driver/orders/${encodeURIComponent(orderId)}/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...driverAuthHeaders() },
    body: JSON.stringify({ code }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Confirmation impossible')
  return data
}

export async function reportDriverDeliveryIssue(
  orderId: string,
  payload: { reason: string; note?: string },
): Promise<{ success: boolean; order?: { status: string } }> {
  const res = await fetch(`/api/driver/orders/${encodeURIComponent(orderId)}/issue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...driverAuthHeaders() },
    body: JSON.stringify(payload),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Envoi impossible')
  return data
}
