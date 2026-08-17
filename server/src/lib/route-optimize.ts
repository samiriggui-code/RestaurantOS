export type LatLng = { lat: number; lng: number }

/** Distance Haversine en km */
export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}

export type RouteStop = {
  id: string
  lat: number
  lng: number
}

/**
 * Tournée gloutonne : plus proche voisin depuis le dépôt (ou position livreur).
 */
export function optimizeRouteNearestNeighbor(
  origin: LatLng,
  stops: RouteStop[],
): RouteStop[] {
  if (stops.length <= 1) return [...stops]

  const remaining = [...stops]
  const ordered: RouteStop[] = []
  let current = origin

  while (remaining.length > 0) {
    let bestIdx = 0
    let bestDist = Infinity
    for (let i = 0; i < remaining.length; i++) {
      const d = haversineKm(current, remaining[i])
      if (d < bestDist) {
        bestDist = d
        bestIdx = i
      }
    }
    const next = remaining.splice(bestIdx, 1)[0]
    ordered.push(next)
    current = { lat: next.lat, lng: next.lng }
  }

  return ordered
}

export function googleMapsDirectionsUrl(dest: LatLng, origin?: LatLng): string {
  const destStr = `${dest.lat},${dest.lng}`
  if (origin) {
    return `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${destStr}&travelmode=driving`
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${destStr}&travelmode=driving`
}

export function googleMapsMultiStopUrl(
  origin: LatLng,
  stops: LatLng[],
): string | null {
  if (stops.length === 0) return null
  const destination = stops[stops.length - 1]
  const waypoints = stops.length > 1 ? stops.slice(0, -1) : []
  const params = new URLSearchParams({
    api: '1',
    origin: `${origin.lat},${origin.lng}`,
    destination: `${destination.lat},${destination.lng}`,
    travelmode: 'driving',
  })
  if (waypoints.length > 0) {
    params.set('waypoints', waypoints.map((p) => `${p.lat},${p.lng}`).join('|'))
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`
}

export function formatDistanceKm(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`
  return `${km.toFixed(1)} km`
}
