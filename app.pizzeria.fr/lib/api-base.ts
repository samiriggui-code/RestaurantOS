const API_PORT = process.env.NEXT_PUBLIC_API_PORT ?? '3001'

function stripTrailingSlash(url: string): string {
  return url.replace(/\/$/, '')
}

/** IP privée (tablette cuisine / SUNMI sur le LAN). */
export function isPrivateLanHost(hostname: string): boolean {
  return (
    /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
    /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(hostname)
  )
}

const WEB_PORT = process.env.NEXT_PUBLIC_WEB_PORT ?? '3000'

function isWebAppPort(port: string): boolean {
  if (port === WEB_PORT) return true
  // http sans port explicite
  return !port && WEB_PORT === '80'
}

function isConfiguredAppHost(hostname: string): boolean {
  const ops = process.env.NEXT_PUBLIC_OPS_HOST?.trim()
  const pub = process.env.NEXT_PUBLIC_PUBLIC_HOST?.trim()
  return (ops !== undefined && ops !== '' && hostname === ops) ||
    (pub !== undefined && pub !== '' && hostname === pub)
}

/**
 * Base URL de l'API Express (fetch REST).
 * - SSR → env (localhost:3001)
 * - Navigateur sur pizza-app / pizza (prod) → API Traefik directe (IP client réelle pour jumelage)
 * - Dev LAN tablette → IP:3001
 */
export function getApiBase(): string {
  const fromEnv = stripTrailingSlash(process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001')

  if (typeof window === 'undefined') return fromEnv

  const { hostname, protocol, port } = window.location

  if (isConfiguredAppHost(hostname)) return fromEnv

  if (isWebAppPort(port)) return fromEnv

  if (isPrivateLanHost(hostname)) {
    return `${protocol}//${hostname}:${API_PORT}`
  }

  return fromEnv
}

function stripApiSuffix(url: string): string {
  const trimmed = stripTrailingSlash(url)
  return trimmed.endsWith('/api') ? trimmed.slice(0, -4) : trimmed
}

/**
 * Base URL pour Socket.io — toujours Express (Next ne proxy pas /socket.io).
 * Sans suffixe /api (contrairement à NEXT_PUBLIC_API_URL).
 */
export function getSocketBase(): string {
  const fromEnv = stripApiSuffix(process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001')

  if (typeof window === 'undefined') return fromEnv

  const { hostname, protocol, port } = window.location

  if (isConfiguredAppHost(hostname)) return fromEnv

  if (isWebAppPort(port) || isPrivateLanHost(hostname)) {
    try {
      const base = new URL(fromEnv)
      // Même hôte que la page (localhost vs 127.0.0.1) — évite les rejets CORS socket.io
      if (hostname === '127.0.0.1' || hostname === 'localhost') {
        base.hostname = hostname
        return stripTrailingSlash(base.toString())
      }
      if (isPrivateLanHost(hostname)) {
        return `${protocol}//${hostname}:${API_PORT}`
      }
      return stripTrailingSlash(base.toString())
    } catch {
      return fromEnv
    }
  }

  return fromEnv
}
