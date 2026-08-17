export type DriverTrailPoint = { lat: number; lng: number; at: string }

const MAX_TRAIL_POINTS = 400
const MIN_DISTANCE_METERS = 20

function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const x =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(x))
}

export function parseDriverTrail(raw: unknown): DriverTrailPoint[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter(
      (p): p is DriverTrailPoint =>
        p != null &&
        typeof p === 'object' &&
        typeof (p as DriverTrailPoint).lat === 'number' &&
        typeof (p as DriverTrailPoint).lng === 'number',
    )
    .slice(-MAX_TRAIL_POINTS)
}

export function appendDriverTrail(
  existing: unknown,
  lat: number,
  lng: number,
  at = new Date(),
): DriverTrailPoint[] {
  const trail = parseDriverTrail(existing)
  const point = { lat, lng, at: at.toISOString() }
  const last = trail[trail.length - 1]
  if (last && haversineMeters(last, point) < MIN_DISTANCE_METERS) {
    return trail
  }
  const next = [...trail, point]
  return next.length > MAX_TRAIL_POINTS ? next.slice(-MAX_TRAIL_POINTS) : next
}
