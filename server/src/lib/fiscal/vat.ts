import { orderPriceMode } from '../invoice-vat'
import { splitTtcUnitCents } from '../invoice-vat'

export type FiscalLineInput = {
  name: string
  slug?: string | null
  quantity: number
  unitPriceCents: number
  vatRateBps: number
  selectedModifiers?: unknown
}

/** Basis points → clé JSON "10", "5.5", "20" */
export function vatRateKey(vatRateBps: number): string {
  const pct = vatRateBps / 100
  return Number.isInteger(pct) ? String(pct) : pct.toFixed(1).replace(/\.0$/, '')
}

export function bpsFromBusinessTaxRate(taxRatePercent: number): number {
  return Math.round(taxRatePercent * 100)
}

export function aggregateTaxByRate(
  lines: FiscalLineInput[],
  priceMode: 'HT' | 'TTC',
): Record<string, number> {
  const byRate: Record<string, number> = {}

  for (const line of lines) {
    const ratePct = line.vatRateBps / 100
    const key = vatRateKey(line.vatRateBps)
    let taxCents = 0

    if (priceMode === 'HT') {
      const ht = line.unitPriceCents * line.quantity
      taxCents = Math.round((ht * ratePct) / 100)
    } else {
      const ttc = line.unitPriceCents * line.quantity
      const { tax } = splitTtcUnitCents(line.unitPriceCents, ratePct)
      taxCents = tax * line.quantity
      // Ajustement arrondi sur dernière ligne si besoin — garder somme cohérente
      if (taxCents === 0 && ttc > 0 && ratePct > 0) {
        const split = splitTtcUnitCents(line.unitPriceCents, ratePct)
        taxCents = split.tax * line.quantity
      }
    }

    byRate[key] = (byRate[key] ?? 0) + taxCents
  }

  return byRate
}

export function sumTaxByRate(map: Record<string, number>): number {
  return Object.values(map).reduce((a, b) => a + b, 0)
}

type OrderForFiscalVat = {
  isOnlineOrder: boolean
  tax: number
  discount: number
  items: Array<{
    quantity: number
    price: number
    menuItem: { name: string; slug?: string | null; vatRateBps?: number }
    selectedModifiers?: unknown
  }>
}

export function fiscalLinesFromOrder(
  order: OrderForFiscalVat,
  defaultVatBps: number,
): FiscalLineInput[] {
  return order.items.map((item) => ({
    name: item.menuItem.name,
    slug: item.menuItem.slug,
    quantity: item.quantity,
    unitPriceCents: item.price,
    vatRateBps: item.menuItem.vatRateBps ?? defaultVatBps,
    selectedModifiers: item.selectedModifiers,
  }))
}

export function resolveOrderPriceMode(order: { isOnlineOrder: boolean; tax: number }): 'HT' | 'TTC' {
  return orderPriceMode(order)
}
