const cache = new Map<string, { lat: number; lng: number } | null>()

/** Géocodage Nominatim (OSM) — cache mémoire par adresse normalisée. */
export async function geocodeDeliveryAddress(
  address: string,
  postalCode?: string | null,
  city?: string | null,
): Promise<{ lat: number; lng: number } | null> {
  const query = [address, postalCode, city, 'France'].filter(Boolean).join(', ').trim()
  if (!query) return null

  const key = query.toLowerCase()
  if (cache.has(key)) return cache.get(key) ?? null

  try {
    const params = new URLSearchParams({
      q: query,
      format: 'json',
      limit: '1',
      countrycodes: 'fr',
    })
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: { Accept: 'application/json' },
    })
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
