/** Calcul TVA factures (miroir serveur) — preview UI admin. */

export function lineAmounts(
  quantity: number,
  unitHtCents: number,
  taxRatePercent: number
): { htCents: number; taxCents: number; ttcCents: number } {
  const htCents = Math.round(quantity * unitHtCents)
  const taxCents = Math.round((htCents * taxRatePercent) / 100)
  return { htCents, taxCents, ttcCents: htCents + taxCents }
}

export function computeInvoiceLineTotals(
  lines: Array<{ quantity: number; unitPriceCents: number; taxRate: number }>
) {
  let subtotalHt = 0
  let taxCents = 0
  for (const line of lines) {
    const { htCents, taxCents: t } = lineAmounts(line.quantity, line.unitPriceCents, line.taxRate)
    subtotalHt += htCents
    taxCents += t
  }
  return { subtotalHt, taxCents, totalTtc: subtotalHt + taxCents }
}
