/**
 * Totaux commande avec multi-TVA par ligne (MenuItem.vatRateBps).
 * Caisse / sur place : prix HT + TVA par taux (5,5 % · 10 % · 20 %).
 * En ligne : prix TTC affichés — Order.tax = 0 (ventilation au ticket fiscal).
 */

import type { PriceMode } from './invoice-vat'
import { splitTtcUnitCents } from './invoice-vat'
import { calcServiceChargeCents } from './money'
import { vatRateKey } from './fiscal/vat'

export type OrderVatLine = {
  quantity: number
  unitPriceCents: number
  vatRateBps: number
}

export function defaultVatBpsFromTaxRate(taxRatePercent: number): number {
  return Math.round(taxRatePercent * 100)
}

export function lineTaxCents(line: OrderVatLine, priceMode: PriceMode): number {
  const ratePct = line.vatRateBps / 100
  const lineTotal = line.unitPriceCents * line.quantity
  if (ratePct <= 0) return 0
  if (priceMode === 'HT') {
    return Math.round((lineTotal * ratePct) / 100)
  }
  const { tax } = splitTtcUnitCents(line.unitPriceCents, ratePct)
  return tax * line.quantity
}

export function aggregateLineTaxByRate(
  lines: OrderVatLine[],
  priceMode: PriceMode,
): Record<string, number> {
  const byRate: Record<string, number> = {}
  for (const line of lines) {
    const key = vatRateKey(line.vatRateBps)
    byRate[key] = (byRate[key] ?? 0) + lineTaxCents(line, priceMode)
  }
  return byRate
}

export function computeOrderTotalsFromLines(
  lines: OrderVatLine[],
  options: {
    priceMode: PriceMode
    serviceRatePercent: number
    orderType: string
    /** Frais livraison / extra TTC (commande en ligne). */
    extraCents?: number
  },
): { subtotal: number; tax: number; serviceCharge: number; total: number; taxByRate: Record<string, number> } {
  const subtotal = lines.reduce((sum, l) => sum + l.unitPriceCents * l.quantity, 0)
  const taxByRate = aggregateLineTaxByRate(lines, options.priceMode)
  const taxSum = Object.values(taxByRate).reduce((a, b) => a + b, 0)
  const tax = options.priceMode === 'TTC' ? 0 : taxSum
  const serviceCharge =
    options.orderType === 'DINE_IN'
      ? calcServiceChargeCents(subtotal, options.serviceRatePercent)
      : options.extraCents ?? 0
  const total = subtotal + tax + serviceCharge
  return { subtotal, tax, serviceCharge, total, taxByRate }
}
