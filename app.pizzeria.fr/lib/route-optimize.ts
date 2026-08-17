export type LatLng = { lat: number; lng: number }

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

export function addressLine(
  address: string | null | undefined,
  postalCode: string | null | undefined,
  city: string | null | undefined,
): string {
  return [address, postalCode, city].filter(Boolean).join(', ')
}

export function scheduledSlotLabel(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}
