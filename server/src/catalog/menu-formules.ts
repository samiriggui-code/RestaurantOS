/**
 * Formules menu — pizza + boisson (choix obligatoire) + dessert optionnel à prix réduit.
 */

export const FORMULE_DRINK_PRICE = 1.5
export const FORMULE_DESSERT_PRICE = 2.5

export const MENU_FORMULE = {
  id: 'formule-duo',
  name: 'Menu Pizza + Boisson',
  tagline: 'Boisson à prix menu avec votre pizza',
  savingsLabel: 'Économisez jusqu’à 0,50 €',
} as const

export const MENU_FORMULE_DESSERT = {
  id: 'formule-dessert',
  name: 'Dessert menu',
  tagline: 'Dessert à prix réduit avec une pizza au panier',
  savingsLabel: '1 € d’économie',
} as const

/** Boissons éligibles au menu (canettes) */
export const FORMULE_DRINK_SLUGS = [
  'boissons-coca-canette',
  'boissons-ice-tea-canette',
  'boissons-pepsi-canette',
] as const

/** Desserts éligibles au tarif menu */
export const FORMULE_DESSERT_SLUGS = [
  'desserts-tiramisu-caramel',
  'desserts-tiramisu-choco',
  'desserts-tiramisu-oreo',
  'desserts-tarte-snickers',
  'desserts-tarte-daim',
] as const
