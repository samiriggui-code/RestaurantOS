/** Montants API Prisma = centimes EUR (entiers). */

export function centsToEuros(cents: number): number {
  return cents / 100
}

export function eurosToCents(euros: number): number {
  return Math.round(euros * 100)
}

export function formatEUR(cents: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(
    centsToEuros(cents)
  )
}
