import type { CartLine } from './cart-types'
import { cartHasDessert, cartHasDrink, cartHasPizza } from './cart-helpers'
import type { MenuFormulesConfig } from './formules-api'
import type { CatalogCategory, CatalogItem } from './menu-types'
import { PIZZA_CATEGORY_IDS } from './menu-types'
import { findCatalogItemBySlug } from './menu-api'

export type UpsellItem = {
  slug: string
  name: string
  categoryId: string
  description: string
  catalogPrice: number
  offerPrice: number
  image: string
  badge?: string
  kind: 'menu_drink' | 'menu_dessert' | 'extra'
}

/** Suggestions dynamiques selon le contenu du panier (catalogue API requis). */
export function getCartUpsells(
  lines: CartLine[],
  formules: MenuFormulesConfig | null | undefined,
  categories: CatalogCategory[],
): UpsellItem[] {
  if (!formules || categories.length === 0) return []

  const upsells: UpsellItem[] = []
  const slugsInCart = new Set(lines.map((l) => l.slug))
  const drinkPrice = formules.duo.priceEuros
  const dessertPrice = formules.dessert.priceEuros
  const drinkSlugs = formules.duo.eligibleSlugs
  const dessertSlugs = formules.dessert.eligibleSlugs

  if (cartHasPizza(lines) && !cartHasDrink(lines)) {
    for (const slug of drinkSlugs) {
      const found = findCatalogItemBySlug(slug, categories)
      if (!found || slugsInCart.has(slug)) continue
      const { item, categoryId } = found
      upsells.push({
        slug: item.slug,
        name: item.name,
        categoryId,
        description: 'Prix menu avec votre pizza',
        catalogPrice: item.price,
        offerPrice: drinkPrice,
        image: item.image || '/images/categories/boissons.jpg',
        badge: 'Menu',
        kind: 'menu_drink',
      })
    }
  }

  if (cartHasPizza(lines) && !cartHasDessert(lines)) {
    for (const slug of dessertSlugs) {
      const found = findCatalogItemBySlug(slug, categories)
      if (!found || slugsInCart.has(slug)) continue
      const { item, categoryId } = found
      upsells.push({
        slug: item.slug,
        name: item.name,
        categoryId,
        description: 'Tarif menu dessert',
        catalogPrice: item.price,
        offerPrice: dessertPrice,
        image: item.image || '/images/categories/desserts.jpg',
        badge: '-1 €',
        kind: 'menu_dessert',
      })
    }
  }

  const supplementItems =
    categories.find((c) => c.id === 'supplements')?.items ??
    categories.find((c) => c.id.startsWith('supplement'))?.items ??
    []
  for (const supplement of supplementItems) {
    const slug = supplement.slug
    if (slugsInCart.has(slug)) continue
    const found = findCatalogItemBySlug(slug, categories)
    if (!found) continue
    const { item, categoryId } = found
    upsells.push({
      slug: item.slug,
      name: item.name,
      categoryId,
      description: item.description,
      catalogPrice: item.price,
      offerPrice: item.price,
      image: '/images/categories/supplements.jpg',
      badge: 'Extra',
      kind: 'extra',
    })
    if (upsells.filter((u) => u.kind === 'extra').length >= 2) break
  }

  return upsells.slice(0, 6)
}

function catalogItemToUpsell(
  item: CatalogItem,
  categoryId: string,
  extra?: Partial<UpsellItem>,
): UpsellItem {
  return {
    slug: item.slug,
    name: item.name,
    categoryId,
    description: item.description,
    catalogPrice: item.price,
    offerPrice: item.price,
    image: item.image || '/images/placeholder/margherita.jpg',
    kind: 'extra',
    ...extra,
  }
}

/** Pizzas à suggérer pour atteindre le minimum livraison (tri : couvre le gap, puis moins cher). */
export function getPizzaMinimumSuggestions(
  lines: CartLine[],
  categories: CatalogCategory[],
  gapEuros: number,
  max = 4,
): UpsellItem[] {
  if (gapEuros <= 0) return []

  const slugsInCart = new Set(lines.map((l) => l.slug))
  const candidates: UpsellItem[] = []

  for (const cat of categories) {
    if (!PIZZA_CATEGORY_IDS.has(cat.id)) continue
    for (const item of cat.items) {
      if (slugsInCart.has(item.slug)) continue
      candidates.push(
        catalogItemToUpsell(item, cat.id, {
          badge: item.price >= gapEuros ? 'Min. OK' : undefined,
        }),
      )
    }
  }

  candidates.sort((a, b) => {
    const aCovers = a.offerPrice >= gapEuros ? 0 : 1
    const bCovers = b.offerPrice >= gapEuros ? 0 : 1
    if (aCovers !== bCovers) return aCovers - bCovers
    return a.offerPrice - b.offerPrice
  })

  return candidates.slice(0, max)
}

export type MenuCompletionStatus = {
  hasPizza: boolean
  hasDrink: boolean
  hasDessert: boolean
  drinkMissing: boolean
  suggestedSavings: number
}

export function getMenuCompletion(lines: CartLine[]): MenuCompletionStatus {
  const hasPizza = cartHasPizza(lines)
  const hasDrink = cartHasDrink(lines)
  const hasDessert = cartHasDessert(lines)
  return {
    hasPizza,
    hasDrink,
    hasDessert,
    drinkMissing: hasPizza && !hasDrink,
    suggestedSavings: hasPizza && !hasDrink ? 0.5 : hasPizza && !hasDessert ? 1 : 0,
  }
}
