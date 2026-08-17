/** JSON canonique pour empreintes fiscales (ordre de clés stable). */
export function fiscalJsonStable(value: unknown): unknown {
  if (value === null || value === undefined) return null
  if (Array.isArray(value)) return value.map(fiscalJsonStable)
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    const sorted: Record<string, unknown> = {}
    for (const key of Object.keys(obj).sort()) {
      sorted[key] = fiscalJsonStable(obj[key])
    }
    return sorted
  }
  return value
}

export function fiscalClosureHashBody(input: {
  periodType: string
  periodKey: string
  totals: unknown
  grandTotalCents: bigint | string
  ticketCount: number
  closedAt: Date
  previousHash: string
}): string {
  return JSON.stringify({
    periodType: input.periodType,
    periodKey: input.periodKey,
    totals: fiscalJsonStable(input.totals),
    grandTotalCents:
      typeof input.grandTotalCents === 'bigint'
        ? input.grandTotalCents.toString()
        : input.grandTotalCents,
    ticketCount: input.ticketCount,
    closedAt: input.closedAt.toISOString(),
    previousHash: input.previousHash,
  })
}
