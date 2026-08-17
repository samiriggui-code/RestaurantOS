import { clearDeviceSession } from '@/lib/staff-auth'

export type DeviceKind = 'pos' | 'kitchen'

function unlockKey(device: DeviceKind): string {
  return `device_unlock_${device}`
}

export function setDeviceUnlocked(device: DeviceKind): void {
  if (typeof window === 'undefined') return
  sessionStorage.setItem(unlockKey(device), String(Date.now()))
}

export function isDeviceUnlocked(device: DeviceKind): boolean {
  if (typeof window === 'undefined') return false
  return sessionStorage.getItem(unlockKey(device)) != null
}

export function clearDeviceUnlock(device: DeviceKind): void {
  if (typeof window === 'undefined') return
  sessionStorage.removeItem(unlockKey(device))
}

/** Verrouille l'appareil : efface uniquement la session appareil (pas le CRM). */
export function lockDevice(device: DeviceKind): void {
  clearDeviceUnlock(device)
  clearDeviceSession()
}
