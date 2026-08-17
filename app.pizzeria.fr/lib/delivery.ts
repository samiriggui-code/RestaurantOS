/** Zones livraison — flyer La Z Pizza (minimum par ville, frais selon distance) */

export type DeliveryTown = {
  name: string
  postalCodes: string[]
  minOrder: number
  fee: number
}

export const DELIVERY_TOWNS_CONFIG: DeliveryTown[] = [
  { name: 'Fargues-Saint-Hilaire', postalCodes: ['33370'], minOrder: 25, fee: 4.5 },
  { name: 'Carignan-de-Bordeaux', postalCodes: ['33360'], minOrder: 28, fee: 5.5 },
  { name: 'Bonnetan', postalCodes: ['33370'], minOrder: 28, fee: 5.5 },
  { name: 'Tresses', postalCodes: ['33370'], minOrder: 28, fee: 5.5 },
  { name: 'Lignan-de-Bordeaux', postalCodes: ['33360'], minOrder: 31, fee: 5.5 },
  { name: 'Sallebœuf', postalCodes: ['33370'], minOrder: 31, fee: 5.5 },
  { name: 'Pompignac', postalCodes: ['33670'], minOrder: 31, fee: 5.5 },
  { name: 'Loupes', postalCodes: ['33360'], minOrder: 36, fee: 5.5 },
  { name: 'Cénac', postalCodes: ['33750'], minOrder: 36, fee: 5.5 },
  { name: 'Bouliac', postalCodes: ['33270'], minOrder: 36, fee: 5.5 },
  { name: 'Sadirac', postalCodes: ['33670'], minOrder: 36, fee: 5.5 },
  { name: 'Camarsac', postalCodes: ['33750'], minOrder: 36, fee: 5.5 },
  { name: 'Artigues-près-Bordeaux', postalCodes: ['33370'], minOrder: 36, fee: 5.5 },
]

export type DeliveryZone = DeliveryTown

/** @deprecated utiliser DELIVERY_TOWNS_CONFIG */
export const DELIVERY_ZONES = DELIVERY_TOWNS_CONFIG

export const DELIVERY_POSTAL_CODES = [
  ...new Set(DELIVERY_TOWNS_CONFIG.flatMap((t) => t.postalCodes)),
]

export type DeliveryQuote = {
  ok: boolean
  fee: number
  minOrder: number
  zoneLabel: string
  error?: string
}

export function normalizePostalCode(code: string): string {
  return code.replace(/\s/g, '').slice(0, 5)
}

export function normalizeCityName(city: string): string {
  return city
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function townMatches(city: string, town: DeliveryTown): boolean {
  const n = normalizeCityName(city)
  const t = normalizeCityName(town.name)
  return n === t || n.includes(t) || t.includes(n)
}

export function getDeliveryTown(postalCode: string, city: string): DeliveryTown | null {
  const cp = normalizePostalCode(postalCode)
  if (!cp || cp.length < 5) return null

  const candidates = DELIVERY_TOWNS_CONFIG.filter((t) => t.postalCodes.includes(cp))
  if (!candidates.length) return null

  if (city.trim()) {
    const byCity = candidates.find((t) => townMatches(city, t))
    if (byCity) return byCity
  }

  if (candidates.length === 1) return candidates[0]
  return null
}

export function getDeliveryZone(postalCode: string, city = ''): DeliveryTown | null {
  return getDeliveryTown(postalCode, city)
}

export function isDeliveryPostalCode(code: string): boolean {
  const cp = normalizePostalCode(code)
  return DELIVERY_POSTAL_CODES.includes(cp)
}

export function townsForPostalCode(postalCode: string): DeliveryTown[] {
  const cp = normalizePostalCode(postalCode)
  return DELIVERY_TOWNS_CONFIG.filter((t) => t.postalCodes.includes(cp))
}

export function getDeliveryQuote(
  postalCode: string,
  pizzaSubtotal: number,
  city = ''
): DeliveryQuote {
  const zone = getDeliveryTown(postalCode, city)

  if (!isDeliveryPostalCode(postalCode)) {
    return {
      ok: false,
      fee: 0,
      minOrder: 0,
      zoneLabel: '',
      error: 'Code postal hors zone de livraison (10 km autour de Fargues).',
    }
  }

  if (!zone) {
    const options = townsForPostalCode(postalCode).map((t) => t.name).join(', ')
    return {
      ok: false,
      fee: 0,
      minOrder: 0,
      zoneLabel: '',
      error: options
        ? `Précisez la ville : ${options}.`
        : 'Ville non reconnue pour ce code postal.',
    }
  }

  if (pizzaSubtotal < zone.minOrder) {
    const missing = zone.minOrder - pizzaSubtotal
    return {
      ok: false,
      fee: zone.fee,
      minOrder: zone.minOrder,
      zoneLabel: zone.name,
      error: `Minimum livraison : ${zone.minOrder.toFixed(2).replace('.', ',')} € en pizzas pour ${zone.name}. Il vous manque ${missing.toFixed(2).replace('.', ',')} € de pizzas.`,
    }
  }

  return {
    ok: true,
    fee: zone.fee,
    minOrder: zone.minOrder,
    zoneLabel: zone.name,
  }
}

/** @deprecated */
export const DELIVERY_FEE = 4.5
export const MIN_ORDER_DELIVERY = 25

export function deliveryZoneHint(): string {
  return DELIVERY_TOWNS_CONFIG.slice(0, 5)
    .map((t) => t.name)
    .join(', ')
}
