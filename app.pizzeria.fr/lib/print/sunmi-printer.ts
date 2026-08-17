/**
 * Pont impression SUNMI — disponible dans l'APK android/ via @JavascriptInterface.
 */

export type SunmiPrinterBridge = {
  printKitchenTicket: (content: string) => void
  printReceipt: (content: string) => void
  getPrinterStatus?: () => string
  playNewOrderSound?: () => void
}

declare global {
  interface Window {
    SunmiPrinter?: SunmiPrinterBridge
  }
}

export function isSunmiPrinterAvailable(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false
  if (typeof window.SunmiPrinter?.printKitchenTicket !== 'function') return false
  const ua = navigator.userAgent
  // APK pos-sunmi : suffixe « LaZPizzaPOS/1.0 SunmiV2 »
  if (ua.includes('SunmiV2')) return true
  if (ua.includes('LaZPizzaPOS') && !ua.includes('Tablet')) return true
  return false
}

/** Impression thermique SUNMI V2 uniquement ; retourne true si délégué au pont natif. */
export function printOnSunmi(content: string, type: 'KITCHEN' | 'BAG_LABEL' | 'RECEIPT' = 'KITCHEN'): boolean {
  if (!isSunmiPrinterAvailable()) return false
  const bridge = window.SunmiPrinter!
  try {
    if (type === 'RECEIPT' && bridge.printReceipt) {
      bridge.printReceipt(content)
    } else {
      bridge.printKitchenTicket(content)
    }
    return true
  } catch (err) {
    console.error('[SunmiPrinter]', err)
    return false
  }
}

export function playSunmiNewOrderSound(): boolean {
  try {
    window.SunmiPrinter?.playNewOrderSound?.()
    return true
  } catch {
    return false
  }
}

export function getSunmiPrinterStatus(): string | null {
  try {
    return window.SunmiPrinter?.getPrinterStatus?.() ?? null
  } catch {
    return null
  }
}
