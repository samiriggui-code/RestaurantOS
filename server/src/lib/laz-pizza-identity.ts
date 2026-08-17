/**
 * Identité légale & domaine La Z Pizza — Fargues-Saint-Hilaire.
 * Source : RNE / INSEE (nov. 2023) · site https://www.lazpizzafarguesainthilaire.com/
 */

export const LAZ_PIZZA_DOMAIN = 'lazpizzafarguesainthilaire.com'

export const LAZ_PIZZA_PUBLIC_URL = `https://www.${LAZ_PIZZA_DOMAIN}`

/** Emails staff : prenom.nom@lazpizzafarguesainthilaire.com */
export function lazPizzaStaffEmail(prenom: string, nom: string): string {
  const p = prenom
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '')
  const n = nom
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '')
  return `${p}.${n}@${LAZ_PIZZA_DOMAIN}`
}

export const LAZ_PIZZA_LEGAL = {
  tradeName: 'La Z Pizza',
  legalName: 'LA Z PIZZA',
  address: '33 Avenue de l\'Entre-Deux-Mers, 33370 Fargues-Saint-Hilaire',
  addressLine: 'LA Z PIZZA, 33 AVENUE DE L\'ENTRE 2 MERS 33370 FARGUES-SAINT-HILAIRE',
  phone: '05.57.80.32.45',
  siren: '981 700 842',
  siret: '981 700 842 00017',
  vatNumber: 'FR81 981 700 842',
  nafCode: '56.10C',
  nafLabel: 'Restauration de type rapide',
  legalForm: 'Société à responsabilité limitée',
  rcsRegisteredAt: '2023-11-22',
  inseeRegisteredAt: '2023-11-14',
  website: LAZ_PIZZA_PUBLIC_URL,
  emailDomain: LAZ_PIZZA_DOMAIN,
  /** Livraisons plateformes — leurs livreurs récupèrent en boutique */
  platformDelivery: {
    uberEats: true,
    deliveroo: true,
  },
} as const

/** Business.settings JSON complet pour seed / sync. */
export function lazPizzaDefaultBusinessSettings() {
  return {
    address: LAZ_PIZZA_LEGAL.address,
    phone: LAZ_PIZZA_LEGAL.phone,
    siret: LAZ_PIZZA_LEGAL.siret,
    vatNumber: LAZ_PIZZA_LEGAL.vatNumber,
    legalName: LAZ_PIZZA_LEGAL.legalName,
    siren: LAZ_PIZZA_LEGAL.siren,
    nafCode: LAZ_PIZZA_LEGAL.nafCode,
    nafLabel: LAZ_PIZZA_LEGAL.nafLabel,
    legalForm: LAZ_PIZZA_LEGAL.legalForm,
    website: LAZ_PIZZA_LEGAL.website,
    emailDomain: LAZ_PIZZA_LEGAL.emailDomain,
    adminNotificationEmail: lazPizzaStaffEmail('atmane', 'chennit'),
    hours: { open: 18, close: 22, daysOpen: 7 },
    exceptionalClosures: [] as { date: string; reason?: string }[],
    slotCapacity: 10,
    planning: {
      maxDaysPerWeek: 6,
      maxConsecutiveDays: 6,
      minRestDaysPerWeek: 1,
      kitchenStart: '16:00',
      serviceStart: '18:00',
      closeTime: '22:00',
      /** Le gérant peut remplacer cuisine / caisse */
      managerSubstituteRoles: ['CHEF', 'CASHIER'],
      /** Lucas lun–ven · Amine sam–dim (livreur maison site + zones) */
      inHouseDriverDays: [0, 1, 2, 3, 4, 5, 6],
      fullTimeDriverMaxDays: 6,
      partTimeDriverMaxDays: 3,
      platformDeliveryNote:
        'Uber Eats & Deliveroo : leurs livreurs récupèrent en boutique. Livreur maison = site + zones propres.',
    },
  }
}
