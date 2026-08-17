/** Verrouillage paysage — APK tablette/KDS (pont natif) ou Screen Orientation API (Chrome). */

export type DeviceOrientationMode = 'portrait' | 'landscape' | 'unknown'

/** APK dédié cuisine ou caisse tablette (pas SUNMI portrait). */
export function isLandscapeDeviceApk(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  if (ua.includes('LaZPizzaKDS/')) return true
  return ua.includes('LaZPizzaPOS/') && ua.includes('Tablet')
}

export function canNativeLockOrientation(): boolean {
  return typeof window !== 'undefined' && Boolean(window.LaZPizzaDevice?.lockLandscape)
}

export function lockDeviceLandscape(): { ok: boolean; message?: string } {
  if (typeof window === 'undefined') return { ok: false, message: 'Indisponible' }

  if (window.LaZPizzaDevice?.lockLandscape) {
    try {
      window.LaZPizzaDevice.lockLandscape()
      return { ok: true }
    } catch {
      return { ok: false, message: 'Échec verrouillage natif' }
    }
  }

  return {
    ok: false,
    message: isLandscapeDeviceApk()
      ? 'Mettez à jour l’APK (v1.0.8+) depuis le CRM.'
      : 'Installez l’APK kds.apk ou pos-tablet.apk pour le verrouillage paysage.',
  }
}

export async function lockDeviceLandscapeAsync(): Promise<{ ok: boolean; message?: string }> {
  return lockDeviceLandscape()
}

export function readDeviceOrientation(): DeviceOrientationMode {
  const fromNative = window.LaZPizzaDevice?.getScreenOrientation?.()
  if (fromNative === 'landscape' || fromNative === 'portrait') return fromNative

  if (typeof window !== 'undefined') {
    const type = window.screen?.orientation?.type ?? ''
    if (type.includes('landscape')) return 'landscape'
    if (type.includes('portrait')) return 'portrait'
    if (window.innerWidth > window.innerHeight) return 'landscape'
  }
  return 'unknown'
}
