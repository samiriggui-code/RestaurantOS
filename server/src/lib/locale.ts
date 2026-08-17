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
