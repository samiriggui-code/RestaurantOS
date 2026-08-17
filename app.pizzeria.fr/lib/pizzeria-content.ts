export const PIZZERIA = {
  name: 'La Z Pizza',
  tagline: 'Pizza à Fargues-Saint-Hilaire',
  phone: '05.57.80.32.45',
  phoneHref: 'tel:+33557803245',
  address: "33 Av. de l'Entre-Deux-Mers",
  city: 'Fargues-Saint-Hilaire',
  postalCode: '33370',
  fullAddress: "33 Av. de l'Entre-Deux-Mers, 33370 Fargues-Saint-Hilaire",
  /** Coordonnées Google Maps — La Z Pizza */
  coordinates: { lat: 44.774046, lng: -0.487389 },
  hours: { open: 18, close: 22 },
  daysOpen: '7j/7',
  deliveryRadius: '10 km autour de Fargues-Saint-Hilaire',
  deliveryHours: '18h – 22h',
} as const

export const DELIVERY_TOWNS = [
  'Fargues-Saint-Hilaire',
  'Carignan-de-Bordeaux',
  'Bonnetan',
  'Tresses',
  'Lignan-de-Bordeaux',
  'Sallebœuf',
  'Pompignac',
  'Loupes',
  'Cénac',
  'Bouliac',
  'Sadirac',
  'Camarsac',
  'Artigues-près-Bordeaux',
] as const

export const PROMO = {
  title: 'Offre spéciale',
  text: 'Du lundi au jeudi, toutes les pizzas méga à 18 €',
  detail: 'Hors Les Z Pizzas — à emporter. Mardi : toutes les sénior à 11 €.',
} as const
