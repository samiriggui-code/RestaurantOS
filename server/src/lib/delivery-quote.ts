import type { PrismaClient } from '@prisma/client'
import { centsToEuros } from './money'

/** Zones livraison La Z Pizza — repli flyer si base vide */

export type DeliveryTownConfig = {
  name: string
  postalCodes: string[]
  minOrder: number
  fee: number
}

export const LAZ_PIZZA_DELIVERY_TOWNS: DeliveryTownConfig[] = [
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

export type DeliveryQuoteResult = {
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

function cityNamesMatch(inputCity: string, zoneCity: string): boolean {
  const n = normalizeCityName(inputCity)
  const t = normalizeCityName(zoneCity)
  return n === t || n.includes(t) || t.includes(n)
}

function townMatches(postalCode: string, city: string, town: DeliveryTownConfig): boolean {
  const cp = normalizePostalCode(postalCode)
  if (!town.postalCodes.includes(cp)) return false
  if (!city.trim()) return true
  return cityNamesMatch(city, town.name)
}

export function getDeliveryTownFromFlyer(postalCode: string, city: string): DeliveryTownConfig | null {
  const cp = normalizePostalCode(postalCode)
  if (cp.length < 5) return null

  const candidates = LAZ_PIZZA_DELIVERY_TOWNS.filter((t) => t.postalCodes.includes(cp))
  if (!candidates.length) return null

  if (city.trim()) {
    const byCity = candidates.find((t) => cityNamesMatch(city, t.name))
    if (byCity) return byCity
  }

  if (candidates.length === 1) return candidates[0]
  return null
}

function formatEurFr(amount: number): string {
  return amount.toFixed(2).replace('.', ',')
}

function quoteFromValues(
  pizzaSubtotalEur: number,
  fee: number,
  minOrder: number,
  zoneLabel: string
): DeliveryQuoteResult {
  if (pizzaSubtotalEur < minOrder) {
    const missing = minOrder - pizzaSubtotalEur
    return {
      ok: false,
      fee,
      minOrder,
      zoneLabel,
      error: `Minimum livraison : ${formatEurFr(minOrder)} € en pizzas pour ${zoneLabel}. Il vous manque ${formatEurFr(missing)} € de pizzas (boissons et suppléments s'ajoutent en plus).`,
    }
  }
  return { ok: true, fee, minOrder, zoneLabel }
}

/** Devis depuis le flyer (repli). pizzaSubtotalEur = montant pizzas uniquement. */
export function computeDeliveryQuoteFromFlyer(
  postalCode: string,
  city: string,
  pizzaSubtotalEur: number
): DeliveryQuoteResult {
  const town = getDeliveryTownFromFlyer(postalCode, city)
  if (!town) {
    return {
      ok: false,
      fee: 0,
      minOrder: 0,
      zoneLabel: '',
      error: 'Zone non desservie pour ce code postal / ville.',
    }
  }
  return quoteFromValues(pizzaSubtotalEur, town.fee, town.minOrder, town.name)
}

/** Devis depuis PostgreSQL (DeliveryZone), repli flyer si aucune zone active. */
export async function computeDeliveryQuote(
  prisma: PrismaClient,
  businessId: string,
  postalCode: string,
  city: string,
  pizzaSubtotalEur: number
): Promise<DeliveryQuoteResult> {
  const cp = normalizePostalCode(postalCode)
  if (cp.length < 5) {
    return {
      ok: false,
      fee: 0,
      minOrder: 0,
      zoneLabel: '',
      error: 'Code postal invalide.',
    }
  }

  const zones = await prisma.deliveryZone.findMany({
    where: { businessId, isActive: true, postalCode: cp },
    orderBy: { sortOrder: 'asc' },
  })

  if (!zones.length) {
    return computeDeliveryQuoteFromFlyer(postalCode, city, pizzaSubtotalEur)
  }

  let zone = city.trim()
    ? zones.find((z) => z.city && cityNamesMatch(city, z.city))
    : undefined
  if (!zone && zones.length === 1) zone = zones[0]
  if (!zone) {
    return {
      ok: false,
      fee: 0,
      minOrder: 0,
      zoneLabel: '',
      error: 'Précisez la commune pour ce code postal.',
    }
  }

  const fee = centsToEuros(zone.feeCents)
  const minOrder = centsToEuros(zone.minOrderCents)
  const zoneLabel = zone.city ?? cp

  return quoteFromValues(pizzaSubtotalEur, fee, minOrder, zoneLabel)
}

/** @deprecated utiliser computeDeliveryQuote async — pizzaSubtotalEur uniquement */
export function computeDeliveryQuoteSync(
  postalCode: string,
  city: string,
  pizzaSubtotalEur: number
): DeliveryQuoteResult {
  return computeDeliveryQuoteFromFlyer(postalCode, city, pizzaSubtotalEur)
}
