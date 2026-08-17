/**
 * Phase 0 CDC — WebView Chrome ≥ 64 requis pour Next.js POS sur SUNMI V2.
 * @see docs/webview-sunmi-checklist.md
 */

export const MIN_CHROME_VERSION = 64

export type WebViewDecision = 'GO' | 'NO_GO' | 'UNKNOWN'

export type WebViewCapability = {
  userAgent: string
  chromeVersion: number | null
  isSecureContext: boolean
  isLaZPizzaApk: boolean
  isLikelySunmiPos: boolean
  appVersion: string | null
  androidModel: string | null
  decision: WebViewDecision
  /** Bloquer le POS (SUNMI APK avec WebView incompatible). */
  blockPos: boolean
  message: string
}

type LaZPizzaDeviceBridge = {
  getDeviceInfo?: () => string
  lockLandscape?: () => void
  lockPortrait?: () => void
  getScreenOrientation?: () => string
  getDefaultOrientation?: () => string
  downloadAndInstallApk?: (url: string) => string
}

declare global {
  interface Window {
    LaZPizzaDevice?: LaZPizzaDeviceBridge
  }
}

function parseChromeVersion(userAgent: string): number | null {
  const match = userAgent.match(/Chrome\/(\d+)/)
  if (!match) return null
  const version = Number.parseInt(match[1], 10)
  return Number.isFinite(version) ? version : null
}

function readNativeDeviceInfo(): { appVersion: string | null; androidModel: string | null } {
  try {
    const raw = window.LaZPizzaDevice?.getDeviceInfo?.()
    if (!raw) return { appVersion: null, androidModel: null }
    const parsed = JSON.parse(raw) as { appVersion?: string; model?: string }
    return {
      appVersion: parsed.appVersion ?? null,
      androidModel: parsed.model ?? null,
    }
  } catch {
    return { appVersion: null, androidModel: null }
  }
}

export function isLaZPizzaApk(userAgent: string): boolean {
  return userAgent.includes('LaZPizzaPOS/') || userAgent.includes('LaZPizzaKDS/')
}

export function isLikelySunmiPos(userAgent: string): boolean {
  if (typeof window !== 'undefined' && window.SunmiPrinter?.printKitchenTicket) return true
  return isLaZPizzaApk(userAgent) || /SunmiV2/i.test(userAgent)
}

function buildDecision(
  chromeVersion: number | null,
  isLikelySunmi: boolean,
): Pick<WebViewCapability, 'decision' | 'blockPos' | 'message'> {
  if (chromeVersion == null) {
    if (isLikelySunmi) {
      return {
        decision: 'NO_GO',
        blockPos: true,
        message:
          'Version Chrome/WebView introuvable — mettez à jour « Android System WebView » (Play Store) ou remplacez le terminal.',
      }
    }
    return {
      decision: 'UNKNOWN',
      blockPos: false,
      message: 'Version Chrome non détectée — testez sur l’APK SUNMI réel.',
    }
  }

  if (chromeVersion >= MIN_CHROME_VERSION) {
    return {
      decision: 'GO',
      blockPos: false,
      message: `WebView Chrome ${chromeVersion} — compatible POS (≥ ${MIN_CHROME_VERSION}).`,
    }
  }

  const updateHint =
    chromeVersion >= 58
      ? 'Mettez à jour « Android System WebView » via le Play Store.'
      : 'WebView usine Android 7.1 — remplacement V2 ou appareil secours requis.'

  return {
    decision: 'NO_GO',
    blockPos: isLikelySunmi,
    message: `WebView Chrome ${chromeVersion} — incompatible (minimum ${MIN_CHROME_VERSION}). ${updateHint}`,
  }
}

export function getWebViewCapability(): WebViewCapability {
  if (typeof navigator === 'undefined') {
    return {
      userAgent: '',
      chromeVersion: null,
      isSecureContext: false,
      isLaZPizzaApk: false,
      isLikelySunmiPos: false,
      appVersion: null,
      androidModel: null,
      decision: 'UNKNOWN',
      blockPos: false,
      message: 'Environnement serveur — diagnostic WebView indisponible.',
    }
  }

  const userAgent = navigator.userAgent
  const chromeVersion = parseChromeVersion(userAgent)
  const likelySunmi = isLikelySunmiPos(userAgent)
  const native = readNativeDeviceInfo()
  const { decision, blockPos, message } = buildDecision(chromeVersion, likelySunmi)

  return {
    userAgent,
    chromeVersion,
    isSecureContext: window.isSecureContext,
    isLaZPizzaApk: isLaZPizzaApk(userAgent),
    isLikelySunmiPos: likelySunmi,
    appVersion: native.appVersion,
    androidModel: native.androidModel,
    decision,
    blockPos,
    message,
  }
}

/** JSON prêt à coller dans la fiche go/no-go (docs/webview-sunmi-checklist.md). */
export function getWebViewGoNoGoReport(): string {
  const cap = getWebViewCapability()
  return JSON.stringify(
    {
      date: new Date().toISOString(),
      decision: cap.decision,
      chromeVersion: cap.chromeVersion,
      minRequired: MIN_CHROME_VERSION,
      isLaZPizzaApk: cap.isLaZPizzaApk,
      isLikelySunmiPos: cap.isLikelySunmiPos,
      appVersion: cap.appVersion,
      androidModel: cap.androidModel,
      secureContext: cap.isSecureContext,
      userAgent: cap.userAgent,
    },
    null,
    2,
  )
}
