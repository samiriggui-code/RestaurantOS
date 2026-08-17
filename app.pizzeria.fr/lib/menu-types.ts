/** Types catalogue public — source de vérité : API `/api/public/menu` (Prisma). */

export type CatalogItem = {
  slug: string
  name: string
  description: string
  price: number
  priceNote?: string
  image: string
}

export type CatalogCategory = {
  id: string
  name: string
  shortLabel: string
  description?: string
  items: CatalogItem[]
}

/** Slugs catégories pizza en BDD — utilisés pour tailles, sous-total livraison, vitrine. */
export const PIZZA_CATEGORY_SLUGS = ['tomate', 'creme', 'z-pizzas'] as const

export const PIZZA_CATEGORY_IDS = new Set<string>(PIZZA_CATEGORY_SLUGS)

export function isPizzaCategoryId(categoryId: string): boolean {
  return PIZZA_CATEGORY_IDS.has(categoryId)
}

/** Catégories pizza pour la vitrine ; sinon les 3 premières du catalogue API. */
export function filterPizzaCategories(categories: CatalogCategory[]): CatalogCategory[] {
  const pizza = categories.filter((c) => isPizzaCategoryId(c.id))
  return pizza.length > 0 ? pizza : categories.slice(0, 3)
}

export function formatPriceEUR(price: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(price)
}
