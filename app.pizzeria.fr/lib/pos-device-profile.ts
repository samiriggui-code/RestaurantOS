import { isPaymentTerminalAvailable } from '@/lib/payment/payment-terminal'
import { isSunmiPrinterAvailable } from '@/lib/print/sunmi-printer'

export type PosDeviceProfile = 'sunmi' | 'tablet'

const STORAGE_KEY = 'pos_device_profile'

/** SUNMI V2 = pont natif imprimante/TPE ; tablette = Android + Epson réseau. */
export function detectPosDeviceProfile(): PosDeviceProfile {
  if (typeof window === 'undefined') return 'tablet'
  const ua = navigator.userAgent
  if (ua.includes('LaZPizzaPOS/') && ua.includes('SunmiV2')) return 'sunmi'
  if (ua.includes('LaZPizzaPOS/') && ua.includes('Tablet')) return 'tablet'
  const stored = localStorage.getItem(STORAGE_KEY) as PosDeviceProfile | null
  if (stored === 'sunmi' || stored === 'tablet') return stored
  if (isSunmiPrinterAvailable() || isPaymentTerminalAvailable()) return 'sunmi'
  if (window.innerWidth >= 768) return 'tablet'
  return 'sunmi'
}

export function setPosDeviceProfile(profile: PosDeviceProfile) {
  localStorage.setItem(STORAGE_KEY, profile)
}

export function usePosDeviceProfile(): PosDeviceProfile {
  if (typeof window === 'undefined') return 'tablet'
  return detectPosDeviceProfile()
}
