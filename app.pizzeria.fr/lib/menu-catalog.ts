/**
 * Réexport types catalogue — source de vérité : BDD via `/api/public/menu`.
 * @see menu-api.ts · menu-types.ts
 */
export {
  type CatalogItem,
  type CatalogCategory,
  PIZZA_CATEGORY_IDS,
  formatPriceEUR,
} from './menu-types'
