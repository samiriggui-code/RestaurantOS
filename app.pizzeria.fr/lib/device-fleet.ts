import { apiFetch } from '@/lib/api'
import { staffFetch } from '@/lib/staff-api'
import { opsSitePath, publicSitePath } from '@/lib/ops-apps'

export type FleetSurfaceId = 'pos-sunmi' | 'pos-tablet' | 'kds' | 'livreur' | 'kiosk'

export type FleetSurfaceStatus = {
  id: FleetSurfaceId | string
  label: string
  kind: 'paired' | 'app'
  status: 'online' | 'offline' | 'unpaired' | 'idle'
  detail: string
  lastSeenAt: string | null
  deviceId?: string | null
  labelDevice?: string | null
  lastIp?: string | null
  driversOnDuty?: { id: string; name: string }[]
  activeNames?: string[]
  ordersToday?: number
}

export type DeviceFleetResponse = {
  surfaces: FleetSurfaceStatus[]
  onlineWindowMs: number
  at: string
}

export function fetchDeviceFleet(token: string): Promise<DeviceFleetResponse> {
  return staffFetch<DeviceFleetResponse>('/devices/fleet', { token })
}

export async function postAppHeartbeat(input: {
  app: 'kiosk' | 'livreur'
  driverId?: string
  driverName?: string
}): Promise<void> {
  await apiFetch('/devices/public/app-heartbeat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

/** Heartbeat périodique tant que l’écran reste ouvert. */
export function startAppHeartbeat(
  app: 'kiosk' | 'livreur',
  opts?: { driverId?: string; driverName?: string; intervalMs?: number },
): () => void {
  if (typeof window === 'undefined') return () => {}
  const intervalMs = opts?.intervalMs ?? 60_000
  const tick = () => {
    void postAppHeartbeat({
      app,
      driverId: opts?.driverId,
      driverName: opts?.driverName,
    }).catch(() => {})
  }
  tick()
  const id = window.setInterval(tick, intervalMs)
  return () => window.clearInterval(id)
}

export function fleetOpenHref(id: string): string {
  switch (id) {
    case 'pos-sunmi':
    case 'pos-tablet':
      return opsSitePath('/pos')
    case 'kds':
      return opsSitePath('/kitchen')
    case 'livreur':
      return publicSitePath('/livreur')
    case 'kiosk':
      return opsSitePath('/kiosk')
    default:
      return opsSitePath('/admin/devices')
  }
}
