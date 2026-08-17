/** Locale par défaut — pizzeria France (cahier des charges A6) */
export const DEFAULT_LANGUAGE = 'fr'
export const LANG_MIGRATION_KEY = 'pizzeria-locale-v1'

/** Force le français pour les installs héritées (arabe par défaut). */
export function ensureDefaultLanguage(): string {
  if (typeof window === 'undefined') return DEFAULT_LANGUAGE
  if (localStorage.getItem(LANG_MIGRATION_KEY) !== 'done') {
    localStorage.setItem('language', DEFAULT_LANGUAGE)
    localStorage.setItem(LANG_MIGRATION_KEY, 'done')
    return DEFAULT_LANGUAGE
  }
  return localStorage.getItem('language') || DEFAULT_LANGUAGE
}

export function applyDocumentLanguage(lang: string): void {
  if (typeof document === 'undefined') return
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
  document.documentElement.lang = lang
}

export function displayName(entity?: {
  name?: string | null
  nameAr?: string | null
} | null): string {
  if (!entity) return ''
  return entity.name?.trim() || entity.nameAr?.trim() || ''
}

export function currencySymbol(code?: string | null): string {
  switch (code) {
    case 'EUR':
      return '€'
    case 'USD':
      return '$'
    case 'GBP':
      return '£'
    default:
      return '€'
  }
}

/** Montants API Prisma = centimes EUR (entiers). */
export function centsToEuros(cents: number): number {
  return cents / 100
}

export function eurosToCents(euros: number): number {
  return Math.round(euros * 100)
}

/** Affiche un montant en centimes (ex. 3750 → « 37,50 € »). */
export function formatMoney(cents: number, code?: string | null): string {
  const euros = centsToEuros(cents)
  const symbol = currencySymbol(code ?? 'EUR')
  return `${euros.toFixed(2).replace('.', ',')} ${symbol}`
}
