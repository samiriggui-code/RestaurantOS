import type { CartLine } from './cart-types'
import { PIZZA_CATEGORY_IDS } from './menu-types'
import { CATEGORY_HERO_IMAGES } from './menu-images'
import type { CatalogCategory } from './menu-types'
import { findCatalogItemBySlug } from './menu-api'

const CATEGORY_FALLBACK: Record<string, string> = {
  tomate: CATEGORY_HERO_IMAGES.tomate,
  creme: CATEGORY_HERO_IMAGES.creme,
  'z-pizzas': CATEGORY_HERO_IMAGES['z-pizzas'],
  supplements: CATEGORY_HERO_IMAGES.supplements,
  desserts: CATEGORY_HERO_IMAGES.desserts,
  boissons: CATEGORY_HERO_IMAGES.boissons,
  alcool: CATEGORY_HERO_IMAGES.alcool,
}

export function resolveCartLineImage(line: CartLine, categories?: CatalogCategory[]): string {
  if (line.image) return line.image

  const fromApi = findCatalogItemBySlug(line.slug, categories ?? [])
  if (fromApi?.item.image) return fromApi.item.image

  return CATEGORY_FALLBACK[line.categoryId] ?? '/images/categories/tomate.jpg'
}

export function cartHasPizza(lines: CartLine[]): boolean {
  return lines.some((l) => PIZZA_CATEGORY_IDS.has(l.categoryId))
}

export function cartHasDrink(lines: CartLine[]): boolean {
  return lines.some((l) => l.categoryId === 'boissons')
}

export function cartHasDessert(lines: CartLine[]): boolean {
  return lines.some((l) => l.categoryId === 'desserts')
}
