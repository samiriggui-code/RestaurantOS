/** Géocodage Nominatim (OSM) avec cache mémoire — usage modéré. */

const cache = new Map<string, { lat: number; lng: number } | null>()

function addressKey(address: string, postalCode: string, city: string): string {
  return `${address}|${postalCode}|${city}`.toLowerCase().trim()
}

export async function geocodeDeliveryAddress(
  address: string | null | undefined,
  postalCode: string | null | undefined,
  city: string | null | undefined,
): Promise<{ lat: number; lng: number } | null> {
  const line = [address, postalCode, city].filter(Boolean).join(', ')
  if (!line.trim()) return null

  const key = addressKey(address ?? '', postalCode ?? '', city ?? '')
  if (cache.has(key)) return cache.get(key) ?? null

  try {
    const q = encodeURIComponent(`${line}, France`)
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`,
      { headers: { 'User-Agent': 'RestaurantOS-Pizzeria/1.0' } },
    )
    if (!res.ok) {
      cache.set(key, null)
      return null
    }
    const data = (await res.json()) as Array<{ lat: string; lon: string }>
    if (!data[0]) {
      cache.set(key, null)
      return null
    }
    const coords = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
    if (!Number.isFinite(coords.lat) || !Number.isFinite(coords.lng)) {
      cache.set(key, null)
      return null
    }
    cache.set(key, coords)
    return coords
  } catch {
    cache.set(key, null)
    return null
  }
}
