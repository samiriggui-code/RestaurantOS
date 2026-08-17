/** Montants stockés en centimes EUR (entiers). */

export function eurosToCents(amount: number): number {
  return Math.round(amount * 100)
}

export function centsToEuros(cents: number): number {
  return cents / 100
}

export function formatEUR(cents: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(centsToEuros(cents))
}

/** TVA et frais de service sur un sous-total en centimes. */
export function calcTaxCents(subtotalCents: number, taxRatePercent: number): number {
  return Math.round((subtotalCents * taxRatePercent) / 100)
}

export function calcServiceChargeCents(subtotalCents: number, serviceRatePercent: number): number {
  return Math.round((subtotalCents * serviceRatePercent) / 100)
}

export function orderTotalsCents(
  subtotalCents: number,
  taxRatePercent: number,
  serviceRatePercent: number,
  orderType: string
): { tax: number; serviceCharge: number; total: number } {
  const tax = calcTaxCents(subtotalCents, taxRatePercent)
  const serviceCharge =
    orderType === 'DINE_IN' ? calcServiceChargeCents(subtotalCents, serviceRatePercent) : 0
  const total = subtotalCents + tax + serviceCharge
  return { tax, serviceCharge, total }
}
