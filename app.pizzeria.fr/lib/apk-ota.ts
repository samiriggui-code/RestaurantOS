/**
 * Mise à jour OTA des APK POS/KDS/livreur — sans câble USB.
 * L'app native télécharge depuis /downloads/*.apk et ouvre l'installateur Android
 * (remplace l'ancienne version si même certificat).
 */

export type ApkKind = 'pos-sunmi' | 'pos-tablet' | 'kds' | 'livreur'

export type ApkManifestEntry = {
  versionCode: number
  versionName: string
  url: string
  file: string
  sizeBytes?: number
}

export type ApkManifest = {
  generatedAt: string
  apps: Record<ApkKind, ApkManifestEntry>
}

type LaZPizzaDeviceOtaBridge = {
  getDeviceInfo?: () => string
  downloadAndInstallApk?: (url: string) => string
}

function getOtaBridge(): LaZPizzaDeviceOtaBridge | undefined {
  return typeof window !== 'undefined' ? window.LaZPizzaDevice : undefined
}

export type ApkOtaState =
  | { phase: 'idle' }
  | { phase: 'checking' }
  | { phase: 'up_to_date'; currentCode: number }
  | { phase: 'update_available'; currentCode: number; entry: ApkManifestEntry }
  | { phase: 'downloading'; entry: ApkManifestEntry }
  | { phase: 'install_prompt'; message: string }
  | { phase: 'error'; message: string }

const MANIFEST_PATH = '/downloads/apk-manifest.json'

function parseNativeInfo(): {
  appKind: ApkKind | null
  appVersionCode: number | null
  canOta: boolean
} {
  try {
    const raw = getOtaBridge()?.getDeviceInfo?.()
    if (!raw) return { appKind: null, appVersionCode: null, canOta: false }
    const parsed = JSON.parse(raw) as {
      appKind?: string
      appVersionCode?: number
    }
    const kind = parsed.appKind as ApkKind | undefined
    const validKind =
      kind === 'pos-sunmi' || kind === 'pos-tablet' || kind === 'kds' || kind === 'livreur'
        ? kind
        : detectKindFromUserAgent()
    return {
      appKind: validKind,
      appVersionCode:
        typeof parsed.appVersionCode === 'number' ? parsed.appVersionCode : null,
      canOta: typeof getOtaBridge()?.downloadAndInstallApk === 'function',
    }
  } catch {
    return { appKind: detectKindFromUserAgent(), appVersionCode: null, canOta: false }
  }
}

function detectKindFromUserAgent(): ApkKind | null {
  if (typeof navigator === 'undefined') return null
  const ua = navigator.userAgent
  if (ua.includes('LaZPizzaKDS/')) return 'kds'
  if (ua.includes('LaZPizzaLivreur/')) return 'livreur'
  if (ua.includes('LaZPizzaPOS/')) {
    return ua.includes('Tablet') ? 'pos-tablet' : 'pos-sunmi'
  }
  return null
}

export function resolveApkDownloadUrl(relativeOrAbsolute: string): string {
  if (relativeOrAbsolute.startsWith('http://') || relativeOrAbsolute.startsWith('https://')) {
    return relativeOrAbsolute
  }
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  return `${origin}${relativeOrAbsolute.startsWith('/') ? '' : '/'}${relativeOrAbsolute}`
}

export async function fetchApkManifest(): Promise<ApkManifest | null> {
  try {
    const res = await fetch(MANIFEST_PATH, { cache: 'no-store' })
    if (!res.ok) return null
    return (await res.json()) as ApkManifest
  } catch {
    return null
  }
}

export async function checkApkUpdate(): Promise<
  | { status: 'not_native' }
  | { status: 'unknown_kind' }
  | { status: 'no_manifest' }
  | { status: 'up_to_date'; currentCode: number; entry: ApkManifestEntry }
  | { status: 'update_available'; currentCode: number; entry: ApkManifestEntry }
  | { status: 'needs_native_bridge'; entry: ApkManifestEntry }
> {
  const native = parseNativeInfo()
  if (!native.appKind) return { status: 'not_native' }

  const manifest = await fetchApkManifest()
  if (!manifest?.apps?.[native.appKind]) return { status: 'no_manifest' }

  const entry = manifest.apps[native.appKind]
  const currentCode = native.appVersionCode ?? 0

  if (currentCode >= entry.versionCode) {
    return { status: 'up_to_date', currentCode, entry }
  }

  if (!native.canOta) {
    return { status: 'needs_native_bridge', entry }
  }

  return { status: 'update_available', currentCode, entry }
}

export function startApkOtaInstall(apkUrl: string): { ok: boolean; message: string } {
  try {
    const raw = getOtaBridge()?.downloadAndInstallApk?.(resolveApkDownloadUrl(apkUrl))
    if (!raw) {
      return { ok: false, message: 'Pont natif indisponible — installez la dernière APK une fois en USB.' }
    }
    const parsed = JSON.parse(raw) as { ok?: boolean; message?: string }
    return {
      ok: parsed.ok === true,
      message: parsed.message ?? (parsed.ok ? 'Installation lancée' : 'Échec'),
    }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Erreur mise à jour' }
  }
}
