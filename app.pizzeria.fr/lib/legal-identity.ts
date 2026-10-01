import { PIZZERIA } from '@/lib/pizzeria-content'

/** Identité légale affichée sur les pages publiques (alignée sur server/src/lib/laz-pizza-identity.ts). */
export const LEGAL_IDENTITY = {
  tradeName: 'La Z Pizza',
  legalName: 'LA Z PIZZA',
  legalForm: 'Société à responsabilité limitée (SARL)',
  address: PIZZERIA.fullAddress,
  phone: PIZZERIA.phone,
  phoneHref: PIZZERIA.phoneHref,
  siren: '981 700 842',
  siret: '981 700 842 00017',
  vatNumber: 'FR81 981 700 842',
  nafCode: '56.10C',
  nafLabel: 'Restauration de type rapide',
  rcsCity: 'Bordeaux',
  website: 'https://lazpizza.fr',
  contactEmail: 'atmane.chennit@lazpizza.fr',
  directorPublication: 'Atmane Chennit, gérant',
  hostingProvider: 'Hostinger / infrastructure VPS sécurisée (TLS)',
} as const

export const LEGAL_ROUTES = {
  mentions: '/mentions-legales',
  privacy: '/confidentialite',
  delivery: '/livraison',
  cgv: '/cgv',
} as const

export const LEGAL_FOOTER_LINKS = [
  { label: 'Mentions légales', href: LEGAL_ROUTES.mentions },
  { label: 'Confidentialité', href: LEGAL_ROUTES.privacy },
  { label: 'Livraison', href: LEGAL_ROUTES.delivery },
  { label: 'CGV', href: LEGAL_ROUTES.cgv },
] as const
