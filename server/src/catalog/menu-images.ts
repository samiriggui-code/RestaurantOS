/**
 * Photos menu — pizzas uniquement, fichiers locaux vérifiés.
 * 1 slug = 1 fichier dans public/images/menu/{slug}.jpg
 * Remplacer par les visuels client (même nom de fichier).
 */

const IMG = '/images/menu'

/** Visuels pizza vérifiés (dossier placeholder, copiés par scripts/fix-menu-images.mjs) */
export const PIZZA_STOCK_IMAGES = [
  '/images/placeholder/margherita.jpg',
  '/images/placeholder/pepperoni-close.jpg',
  '/images/placeholder/pepperoni-slice.jpg',
  '/images/placeholder/tomato-basil.jpg',
  '/images/placeholder/cheese-pizza.jpg',
  '/images/placeholder/gourmet-pizza.jpg',
  '/images/placeholder/pizza-loaded.jpg',
  '/images/placeholder/white-pizza.jpg',
] as const

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function menuItemSlug(categoryId: string, name: string): string {
  return `${categoryId}-${slugify(name)}`
}

/** Slugs pizza avec photo produit (31 articles) */
export const PIZZA_ITEM_SLUGS = [
  'tomate-margherita',
  'tomate-classique',
  'tomate-fromagere',
  'tomate-bolognaise',
  'tomate-orientale',
  'tomate-vegetarienne',
  'tomate-calzone',
  'tomate-fermiere',
  'tomate-soufiya',
  'tomate-reine',
  'tomate-raclette',
  'tomate-cheddar',
  'tomate-napolitaine',
  'tomate-chorizo',
  'tomate-oceane',
  'tomate-pepperoni',
  'creme-cremeuse',
  'creme-chevre-miel',
  'creme-chicken',
  'creme-savoyarde',
  'creme-tartiflette',
  'creme-paysanne',
  'creme-gourmande',
  'creme-montagnarde',
  'z-pizzas-kebab',
  'z-pizzas-biggy-burger',
  'z-pizzas-7-fromages',
  'z-pizzas-sud-ouest',
  'z-pizzas-nordique',
  'z-pizzas-4-saisons',
  'z-pizzas-serrano',
] as const

/** Nom de fichier réel si différent du slug catalogue (photos client) */
export const MENU_ITEM_IMAGE_FILE: Partial<Record<(typeof PIZZA_ITEM_SLUGS)[number], string>> = {
  'tomate-chorizo': 'tomate-la-chorizo',
  'z-pizzas-kebab': 'z-pizzas-la-kebab',
  'z-pizzas-7-fromages': 'z-pizzas-la-7-fromages',
  'z-pizzas-sud-ouest': 'z-pizzas-la-sud-ouest',
}

/** Chaque pizza a un visuel distinct (rotation sur le pool vérifié) */
export const MENU_ITEM_STOCK_SOURCE: Record<string, string> = Object.fromEntries(
  PIZZA_ITEM_SLUGS.map((slug, i) => [slug, PIZZA_STOCK_IMAGES[i % PIZZA_STOCK_IMAGES.length]])
)

export function menuItemImagePath(categoryId: string, name: string, slugOverride?: string): string {
  const slug = slugOverride ?? menuItemSlug(categoryId, name)
  if (PIZZA_ITEM_SLUGS.includes(slug as (typeof PIZZA_ITEM_SLUGS)[number])) {
    const file = MENU_ITEM_IMAGE_FILE[slug as (typeof PIZZA_ITEM_SLUGS)[number]] ?? slug
    return `${IMG}/${file}.jpg`
  }
  return ''
}

/** Catégories avec photo pizza sur les cartes produit */
export const MENU_IMAGE_CATEGORY_IDS = new Set(['tomate', 'creme', 'z-pizzas'])

const CAT = '/images/categories'

/** Bannière en-tête pour chaque onglet du menu */
export const CATEGORY_HERO_IMAGES: Record<string, string> = {
  tomate: `${CAT}/tomate.jpg`,
  creme: `${CAT}/creme.jpg`,
  'z-pizzas': `${CAT}/z-pizzas.jpg`,
  supplements: `${CAT}/supplements.jpg`,
  desserts: `${CAT}/desserts.jpg`,
  boissons: `${CAT}/boissons.jpg`,
  alcool: `${CAT}/alcool.jpg`,
}

/** Source locale pour générer les bannières (scripts/fix-menu-images.mjs) */
export const CATEGORY_HERO_SOURCES: Record<string, string> = {
  tomate: '/images/placeholder/margherita.jpg',
  creme: '/images/placeholder/white-pizza.jpg',
  'z-pizzas': '/images/placeholder/gourmet-pizza.jpg',
  supplements: '/images/placeholder/pizza-loaded.jpg',
  desserts: '/images/placeholder/tiramisu.jpg',
  boissons: '/images/placeholder/drinks.jpg',
  alcool: '/images/placeholder/wine.jpg',
}

export function getCategoryHeroImage(categoryId: string): string {
  return CATEGORY_HERO_IMAGES[categoryId] ?? `${CAT}/tomate.jpg`
}

export function categoryShowsItemPhoto(categoryId: string): boolean {
  return MENU_IMAGE_CATEGORY_IDS.has(categoryId)
}
