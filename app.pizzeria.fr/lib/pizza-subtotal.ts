import { PIZZA_CATEGORY_IDS } from '@/lib/menu-types'
import type { CartLine } from '@/lib/cart-types'

/** Montant pizzas uniquement — base du minimum livraison. */
export function pizzaSubtotalFromLines(
  lines: Pick<CartLine, 'categoryId' | 'unitPrice' | 'quantity'>[]
): number {
  return lines
    .filter((l) => PIZZA_CATEGORY_IDS.has(l.categoryId))
    .reduce((sum, l) => sum + l.unitPrice * l.quantity, 0)
}
