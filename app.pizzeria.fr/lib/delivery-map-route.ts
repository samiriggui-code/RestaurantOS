export type LatLng = { lat: number; lng: number }

/** Itinéraire routier OSRM (gratuit, sans clé API). */
export async function fetchDrivingRoute(
  from: LatLng,
  to: LatLng,
): Promise<LatLng[] | null> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`
    const res = await fetch(url)
    if (!res.ok) return null
    const data = (await res.json()) as {
      routes?: Array<{ geometry?: { coordinates?: [number, number][] } }>
    }
    const coords = data.routes?.[0]?.geometry?.coordinates
    if (!coords?.length) return null
    return coords.map(([lng, lat]) => ({ lat, lng }))
  } catch {
    return null
  }
}
