import type { DeviceSlot } from '@/lib/device-onboarding'
import { detectPosDeviceProfile } from '@/lib/pos-device-profile'

const DEVICE_ID_KEY = 'pizzeria_paired_device_id'
const DEVICE_SLOT_KEY = 'pizzeria_paired_device_slot'

export function getBoundDeviceId(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(DEVICE_ID_KEY)
}

export function getBoundDeviceSlot(): DeviceSlot | null {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem(DEVICE_SLOT_KEY)
  if (raw === 'kds' || raw === 'pos-sunmi' || raw === 'pos-tablet') return raw
  return null
}

export function saveDeviceBinding(deviceId: string, slot: DeviceSlot): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(DEVICE_ID_KEY, deviceId)
  localStorage.setItem(DEVICE_SLOT_KEY, slot)
}

export function clearDeviceBinding(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(DEVICE_ID_KEY)
  localStorage.removeItem(DEVICE_SLOT_KEY)
}

/** Slot attendu selon l’URL ou le profil POS (SUNMI vs tablette). */
export function expectedDeviceSlot(pathname?: string): DeviceSlot {
  const path = pathname ?? (typeof window !== 'undefined' ? window.location.pathname : '')
  if (path.startsWith('/kitchen')) return 'kds'
  const profile = detectPosDeviceProfile()
  return profile === 'sunmi' ? 'pos-sunmi' : 'pos-tablet'
}
