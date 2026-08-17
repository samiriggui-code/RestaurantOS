/**
 * Visuels landing — uniquement pizzas du dossier menu (fichiers vérifiés).
 */

const IMG = '/images/menu'

export const PLACEHOLDER_IMAGES = {
  hero: `${IMG}/tomate-margherita.jpg`,
  oven: `${IMG}/tomate-pepperoni.jpg`,
  delivery: `${IMG}/tomate-classique.jpg`,
  promo: `${IMG}/z-pizzas-serrano.jpg`,

  categories: {
    tomate: '/images/categories/tomate.jpg',
    creme: '/images/categories/creme.jpg',
    z: '/images/categories/z-pizzas.jpg',
  },

  gallery: [
    `${IMG}/tomate-margherita.jpg`,
    `${IMG}/tomate-pepperoni.jpg`,
    `${IMG}/z-pizzas-serrano.jpg`,
    `${IMG}/creme-chevre-miel.jpg`,
    `${IMG}/tomate-classique.jpg`,
    `${IMG}/z-pizzas-nordique.jpg`,
  ],
} as const

export { getCategoryHeroImage } from './menu-images'
