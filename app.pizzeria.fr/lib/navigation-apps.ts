import type { LatLng } from '@/lib/route-optimize'

export type NavigationDestination = {
  lat?: number | null
  lng?: number | null
  address?: string
  label?: string
}

export type NavigationAppOption = {
  id: string
  name: string
  description: string
  url: string
  /** iOS / Android / all */
  platforms: ('ios' | 'android' | 'all')[]
}

function enc(s: string): string {
  return encodeURIComponent(s)
}

export function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iPhone|iPad|iPod/i.test(navigator.userAgent)
}

export function isAndroidDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Android/i.test(navigator.userAgent)
}

function destCoords(dest: NavigationDestination): { lat: number; lng: number } | null {
  if (dest.lat != null && dest.lng != null && Number.isFinite(dest.lat) && Number.isFinite(dest.lng)) {
    return { lat: dest.lat, lng: dest.lng }
  }
  return null
}

/** Liens profonds vers les apps de navigation installées (iOS / Android). */
export function buildNavigationApps(
  dest: NavigationDestination,
  origin?: LatLng | null,
): NavigationAppOption[] {
  const coords = destCoords(dest)
  const address = dest.address?.trim() || ''
  const label = dest.label || address || 'Livraison'
  const options: NavigationAppOption[] = []

  if (coords) {
    const { lat, lng } = coords
    const coordStr = `${lat},${lng}`

    // Google Maps — ouvre l'app si installée (Android + iOS)
    const gParams = new URLSearchParams({
      api: '1',
      destination: coordStr,
      travelmode: 'driving',
    })
    if (origin) gParams.set('origin', `${origin.lat},${origin.lng}`)
    options.push({
      id: 'google-maps',
      name: 'Google Maps',
      description: 'Itinéraire voiture',
      url: `https://www.google.com/maps/dir/?${gParams.toString()}`,
      platforms: ['all'],
    })

    // App native Google (iOS)
    if (isIosDevice()) {
      const gApp = new URLSearchParams({ daddr: coordStr, directionsmode: 'driving' })
      if (origin) gApp.set('saddr', `${origin.lat},${origin.lng}`)
      options.push({
        id: 'google-maps-app',
        name: 'Google Maps (app)',
        description: 'Ouvrir l’application',
        url: `comgooglemaps://?${gApp.toString()}`,
        platforms: ['ios'],
      })
    }

    // Apple Plans
    const appleParams = new URLSearchParams({ daddr: coordStr, dirflg: 'd' })
    if (address) appleParams.set('address', address)
    options.push({
      id: 'apple-maps',
      name: 'Plans',
      description: 'Apple Maps (iPhone/iPad)',
      url: `maps://?${appleParams.toString()}`,
      platforms: ['ios', 'all'],
    })
    options.push({
      id: 'apple-maps-web',
      name: 'Plans (web)',
      description: 'Safari → Plans',
      url: `http://maps.apple.com/?${appleParams.toString()}`,
      platforms: ['ios', 'all'],
    })

    // Waze
    options.push({
      id: 'waze',
      name: 'Waze',
      description: 'Navigation communautaire',
      url: `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`,
      platforms: ['all'],
    })
    options.push({
      id: 'waze-app',
      name: 'Waze (app)',
      description: 'Ouvrir l’application',
      url: `waze://?ll=${lat},${lng}&navigate=yes`,
      platforms: ['all'],
    })

    // Android geo: — choix d'app par le système
    if (isAndroidDevice()) {
      options.push({
        id: 'geo',
        name: 'App navigation (Android)',
        description: 'Choisir Maps, Waze…',
        url: `geo:${lat},${lng}?q=${lat},${lng}(${enc(label)})`,
        platforms: ['android'],
      })
    }
  } else if (address) {
    options.push({
      id: 'google-search',
      name: 'Google Maps',
      description: address,
      url: `https://www.google.com/maps/dir/?api=1&destination=${enc(address)}&travelmode=driving`,
      platforms: ['all'],
    })
    options.push({
      id: 'apple-search',
      name: 'Plans',
      description: address,
      url: `maps://?daddr=${enc(address)}&dirflg=d`,
      platforms: ['ios', 'all'],
    })
    options.push({
      id: 'waze-search',
      name: 'Waze',
      description: address,
      url: `https://waze.com/ul?q=${enc(address)}&navigate=yes`,
      platforms: ['all'],
    })
  }

  // Fallback web OSM
  if (coords) {
    options.push({
      id: 'osm',
      name: 'OpenStreetMap',
      description: 'Navigateur web',
      url: `https://www.openstreetmap.org/directions?to=${coords.lat}%2C${coords.lng}`,
      platforms: ['all'],
    })
  }

  return dedupeById(filterForPlatform(options))
}

function filterForPlatform(options: NavigationAppOption[]): NavigationAppOption[] {
  const ios = isIosDevice()
  const android = isAndroidDevice()
  return options.filter((o) => {
    if (o.platforms.includes('all')) return true
    if (ios && o.platforms.includes('ios')) return true
    if (android && o.platforms.includes('android')) return true
    if (!ios && !android) return true
    return false
  })
}

function dedupeById(options: NavigationAppOption[]): NavigationAppOption[] {
  const seen = new Set<string>()
  const out: NavigationAppOption[] = []
  for (const o of options) {
    const key = o.name
    if (seen.has(key)) continue
    seen.add(key)
    out.push(o)
  }
  return out
}

/** Apps recommandées en tête (1 par écosystème). */
export function primaryNavigationApps(
  dest: NavigationDestination,
  origin?: LatLng | null,
): NavigationAppOption[] {
  const all = buildNavigationApps(dest, origin)
  const ios = isIosDevice()
  const preferred = ios
    ? ['apple-maps', 'google-maps', 'waze']
    : ['google-maps', 'waze', 'geo']
  const picked: NavigationAppOption[] = []
  for (const id of preferred) {
    const found = all.find((a) => a.id === id)
    if (found) picked.push(found)
  }
  return picked.length > 0 ? picked : all.slice(0, 3)
}

export function openNavigationUrl(url: string): void {
  window.location.href = url
}

export const PIZZERIA_NAV: NavigationDestination = {
  lat: 44.774046,
  lng: -0.487389,
  address: "33 Av. de l'Entre-Deux-Mers, 33370 Fargues-Saint-Hilaire",
  label: 'La Z Pizza',
}
