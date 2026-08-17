import { apiFetch } from '@/lib/api'
import { staffFetch } from '@/lib/staff-api'

export type DeviceSlot = 'pos-sunmi' | 'pos-tablet' | 'kds'

export const DEVICE_SLOT_LABELS: Record<DeviceSlot, string> = {
  'pos-sunmi': 'Caisse SUNMI',
  'pos-tablet': 'Tablette caisse',
  kds: 'Écran cuisine (KDS)',
}

export type PairedDevice = {
  id: string
  slot: DeviceSlot
  label: string
  pairedAt: string
  lastSeenAt?: string
  userAgent?: string
  pairedFromIp?: string
  lastIp?: string
}

export type DeviceAuditEntry = {
  at: string
  action: 'PAIR' | 'UNPAIR' | 'REPLACE' | 'WAN_CAPTURE' | 'INVENTORY'
  slot?: DeviceSlot
  deviceId?: string
  label?: string
  ip?: string
  userAgent?: string
  byUserId?: string
  note?: string
}

export type DevicesSettings = {
  onboardingComplete?: boolean
  allowedWanIps?: string[]
  pairedDevices?: PairedDevice[]
  printers?: {
    kitchenLanIp?: string
    counterLanIp?: string
  }
  recipeCompletedAt?: string
  lastWanIpCapture?: { ip: string; at: string }
  deviceAuditLog?: DeviceAuditEntry[]
}

export type SlotCapacityRow = {
  slot: DeviceSlot
  label: string
  limit: number
  used: number
  available: number
}

export type StoreInventoryRow = {
  businessId: string
  businessName: string
  wanIp: string | null
  pairedCount: number
  slots: SlotCapacityRow[]
  printers: { kitchenLanIp?: string; counterLanIp?: string }
}

export type DevicesAdminState = {
  devices: DevicesSettings
  access: DevicesAccessStatus
  stripeMode: 'test' | 'live' | 'unset'
  slotCapacity?: SlotCapacityRow[]
  storeInventory?: StoreInventoryRow[]
}

export type DevicesAccessStatus = {
  onboardingComplete: boolean
  ipAllowed: boolean
  wanIpConfigured: boolean
  clientIp: string | null
  allowedWanIps: string[]
  gateSkipped: boolean
  allowed: boolean
  message?: string
}

export type DeviceBindingStatus = {
  valid: boolean
  deviceId: string
  slot: DeviceSlot | null
  ipAllowed: boolean
  clientIp: string | null
}

export function isPrivateOrReservedIp(ip: string): boolean {
  const base = ip.trim().split('/')[0] ?? ''
  const parts = base.split('.')
  if (parts.length !== 4) return true
  const nums = parts.map(Number)
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true
  const [a, b] = nums
  if (a === 10) return true
  if (a === 127) return true
  if (a === 0) return true
  if (a === 169 && b === 254) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  return false
}

export function isLocalDevHost(): boolean {
  if (typeof window === 'undefined') return false
  const host = window.location.hostname
  return host === 'localhost' || host === '127.0.0.1'
}

export async function fetchDeviceAccessStatus(): Promise<DevicesAccessStatus> {
  return apiFetch<DevicesAccessStatus>('/devices/public/access-status', undefined, {
    retries: 1,
    timeoutMs: 8_000,
  })
}

export async function fetchDeviceBindingStatus(deviceId: string): Promise<DeviceBindingStatus> {
  return apiFetch<DeviceBindingStatus>(
    `/devices/public/device-status?deviceId=${encodeURIComponent(deviceId)}`,
    undefined,
    { retries: 1, timeoutMs: 8_000 },
  )
}

export async function pairDevicePublic(code: string, expectedSlot: DeviceSlot) {
  return apiFetch<{ device: PairedDevice }>('/devices/public/pair', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, expectedSlot }),
  })
}

export async function fetchDevicesAdmin(token: string): Promise<DevicesAdminState> {
  return staffFetch<DevicesAdminState>('/devices', { token })
}

export async function generatePairingCode(
  token: string,
  slot: DeviceSlot,
  label: string,
): Promise<{ code: string; expiresAt: string }> {
  return staffFetch('/devices/pairing-code', {
    method: 'POST',
    token,
    body: JSON.stringify({ slot, label }),
  })
}

export async function pairDevice(token: string, code: string) {
  return staffFetch('/devices/pair', {
    method: 'POST',
    token,
    body: JSON.stringify({ code }),
  })
}

export async function captureWanIp(token: string) {
  return staffFetch<{
    capturedIp: string
    allowedWanIps: string[]
    traefik?: { synced: boolean; path?: string; reason?: string }
  }>('/devices/capture-wan-ip', {
    method: 'POST',
    token,
  })
}

export async function savePrinterIps(
  token: string,
  printers: { kitchenLanIp?: string; counterLanIp?: string },
) {
  return staffFetch('/devices/printers', {
    method: 'PUT',
    token,
    body: JSON.stringify(printers),
  })
}

export async function completeRecipe(token: string) {
  return staffFetch('/devices/complete-recipe', { method: 'POST', token })
}

export async function completeOnboarding(token: string) {
  return staffFetch('/devices/complete-onboarding', { method: 'POST', token })
}

export async function resetOnboarding(token: string) {
  return staffFetch('/devices/reset-onboarding', { method: 'POST', token })
}

export async function unpairDevice(token: string, deviceId: string) {
  return staffFetch(`/devices/paired/${deviceId}`, { method: 'DELETE', token })
}
