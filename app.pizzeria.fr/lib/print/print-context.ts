/** Terminal natif (APK SUNMI / tablette / KDS) — pas de pop-up window.print(). */
export function isNativeDeviceApp(): boolean {
  if (typeof window === 'undefined') return false
  return Boolean(
    window.LaZPizzaDevice ||
      typeof window.EpsonPrinter?.printToLan === 'function' ||
      typeof window.SunmiPrinter?.printKitchenTicket === 'function',
  )
}

export function isKitchenDeviceContext(): boolean {
  if (typeof window === 'undefined') return false
  return window.location.pathname.startsWith('/kitchen')
}

export function isPosDeviceContext(): boolean {
  if (typeof window === 'undefined') return false
  return window.location.pathname.startsWith('/pos')
}

/** Pop-up d'aperçu réservée au CRM / navigateur bureau. */
export function shouldAllowBrowserPrint(): boolean {
  return !isNativeDeviceApp()
}
