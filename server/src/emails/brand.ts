/** Identité visuelle emails La Z Pizza */
export const BRAND = {
  name: 'La Z Pizza',
  tagline: 'Pizzeria — Fargues-Saint-Hilaire',
  primary: '#c0392b',
  dark: '#1a1410',
  cream: '#f5f0e8',
  siteUrl: process.env.PUBLIC_SITE_URL ?? 'https://lazpizza.fr',
} as const;

export type BusinessEmailContext = {
  businessName?: string;
  legalName?: string;
  logoUrl?: string;
  address?: string;
  phone?: string;
  siret?: string;
  siren?: string;
  vatNumber?: string;
  nafCode?: string;
  nafLabel?: string;
  legalForm?: string;
  website?: string;
};
