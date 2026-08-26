/** Origines ops (app) vs public (site) — isolation multi-apps Next (remplace Option B Vite). */

function stripHost(raw: string): string {
  return raw.replace(/^https?:\/\//, '').replace(/\/$/, '')
}

function originFromHostEnv(hostEnv: string | undefined, fallbackHost: string): string {
  const host = hostEnv?.trim()
  if (host) {
    const bare = stripHost(host)
    const proto = bare.includes('localhost') || bare.startsWith('127.') ? 'http' : 'https'
    return `${proto}://${bare}`
  }
  if (typeof window !== 'undefined') {
    return window.location.origin
  }
  const proto = fallbackHost.includes('localhost') ? 'http' : 'https'
  return `${proto}://${fallbackHost}`
}

export function getOpsSiteOrigin(): string {
  return originFromHostEnv(process.env.NEXT_PUBLIC_OPS_HOST, 'app.pizzeria.fr')
}

export function getPublicSiteOrigin(): string {
  return originFromHostEnv(process.env.NEXT_PUBLIC_PUBLIC_HOST, 'pizzeria.fr')
}

export function opsSitePath(path: string): string {
  const base = getOpsSiteOrigin()
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `${base}${normalized}`
}

export function publicSitePath(path: string): string {
  const base = getPublicSiteOrigin()
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `${base}${normalized}`
}

/** Apps opérationnelles isolées (1 URL = 1 usage). */
export type OpsAppId = 'pos' | 'kitchen' | 'livreur' | 'kiosk'

export type OpsAppDefinition = {
  id: OpsAppId
  label: string
  desc: string
  /** Host ops ou public */
  host: 'ops' | 'public'
  path: string
  /** APK téléchargeable (null = web only, ex. totem) */
  apkFile: string | null
  apkKey: string | null
}

export const OPS_APPS: readonly OpsAppDefinition[] = [
  {
    id: 'pos',
    label: 'Caisse POS',
    desc: 'Tablette / SUNMI — commande, PIN employé',
    host: 'ops',
    path: '/pos',
    apkFile: 'pos-tablet.apk',
    apkKey: 'pos-tablet',
  },
  {
    id: 'kitchen',
    label: 'Écran cuisine (KDS)',
    desc: 'Tablette cuisine — flux commandes, PIN',
    host: 'ops',
    path: '/kitchen',
    apkFile: 'kds.apk',
    apkKey: 'kds',
  },
  {
    id: 'livreur',
    label: 'App livreur',
    desc: 'Smartphone — tournées, PIN livreur',
    host: 'public',
    path: '/livreur',
    apkFile: 'livreur.apk',
    apkKey: 'livreur',
  },
  {
    id: 'kiosk',
    label: 'Totem kiosque',
    desc: 'Self-service — commande sur place / emporter (web)',
    host: 'ops',
    path: '/kiosk',
    apkFile: null,
    apkKey: null,
  },
] as const

export function opsAppOpenUrl(app: OpsAppDefinition): string {
  return app.host === 'ops' ? opsSitePath(app.path) : publicSitePath(app.path)
}

export function opsAppApkUrl(app: OpsAppDefinition): string | null {
  if (!app.apkFile) return null
  return opsSitePath(`/downloads/${app.apkFile}`)
}
