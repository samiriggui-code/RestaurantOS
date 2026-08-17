/** Catégories catalogue = pizzas pour le minimum livraison (pas boissons / suppléments). */
export const PIZZA_CATEGORY_SLUGS = new Set(['tomate', 'creme', 'z-pizzas'])

export function pizzaSubtotalFromLines(
  lines: { categoryId: string; unitPrice: number; quantity: number }[]
): number {
  return lines
    .filter((l) => PIZZA_CATEGORY_SLUGS.has(l.categoryId))
    .reduce((sum, l) => sum + l.unitPrice * l.quantity, 0)
}
