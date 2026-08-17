/** URL site public (pizzeria.fr) — liens suivi client depuis le CRM (app.pizzeria.fr). */

export function getPublicSiteOrigin(): string {
  const host = process.env.NEXT_PUBLIC_PUBLIC_HOST?.trim()
  if (host) {
    const proto = host.includes('localhost') ? 'http' : 'https'
    return `${proto}://${host.replace(/^https?:\/\//, '').replace(/\/$/, '')}`
  }
  if (typeof window !== 'undefined') {
    return window.location.origin
  }
  return ''
}

export function publicSitePath(path: string): string {
  const base = getPublicSiteOrigin()
  const normalized = path.startsWith('/') ? path : `/${path}`
  return base ? `${base}${normalized}` : normalized
}
