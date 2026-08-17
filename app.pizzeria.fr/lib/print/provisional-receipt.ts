import { formatEUR } from '@/lib/money'
import {
  buildTicketFooter,
  buildTicketHeader,
  defaultTicketBranding,
  padCenter,
  TICKET_WIDTH,
} from '@/lib/print/ticket-branding'

export type ProvisionalLine = {
  name: string
  quantity: number
  unitCents: number
  vatRateBps?: number
  sizeLabel?: string
}

function splitTtcUnitCents(unitTtcCents: number, taxRatePercent: number): { ht: number; tax: number } {
  if (taxRatePercent <= 0) return { ht: unitTtcCents, tax: 0 }
  const ht = Math.round(unitTtcCents / (1 + taxRatePercent / 100))
  return { ht, tax: unitTtcCents - ht }
}

function vatRateKey(bps: number): string {
  const pct = bps / 100
  return Number.isInteger(pct) ? String(pct) : pct.toFixed(1).replace(/\.0$/, '')
}

/** Reçu client provisoire 58 mm — mode dégradé B5 (CDC §6.5). */
export function generateProvisionalReceipt(
  lines: ProvisionalLine[],
  opts: {
    offlineRef: string
    orderType: string
    paymentMethod: string
    soldAt: Date
    businessName?: string
    defaultVatBps?: number
  },
): string {
  const W = TICKET_WIDTH
  const branding = defaultTicketBranding(opts.businessName)
  const defaultBps = opts.defaultVatBps ?? 1000
  const typeLabel =
    opts.orderType === 'DELIVERY'
      ? 'Livraison'
      : opts.orderType === 'TAKEAWAY'
        ? 'À emporter'
        : 'Sur place'
  const payLabel = opts.paymentMethod === 'CARD' ? 'Carte' : 'Espèces'
  const soldAtStr = opts.soldAt.toLocaleString('fr-FR')

  const taxByRate: Record<string, number> = {}
  let totalTtc = 0

  for (const line of lines) {
    const bps = line.vatRateBps ?? defaultBps
    const ratePct = bps / 100
    const key = vatRateKey(bps)
    const lineTtc = line.unitCents * line.quantity
    totalTtc += lineTtc
    const { tax } = splitTtcUnitCents(line.unitCents, ratePct)
    taxByRate[key] = (taxByRate[key] ?? 0) + tax * line.quantity
  }

  const totalTax = Object.values(taxByRate).reduce((a, b) => a + b, 0)
  const subtotalHt = totalTtc - totalTax

  const body: string[] = [
    ...buildTicketHeader(branding, { banner: '*** PROVISOIRE ***' }),
    padCenter('NON VALABLE FISCALEMENT', W),
    '-'.repeat(W),
    `Ref: ${opts.offlineRef}`,
    `Vente: ${soldAtStr}`,
    `Mode: ${typeLabel}`,
    `Paiement: ${payLabel}`,
    '-'.repeat(W),
  ]

  for (const line of lines) {
    const label = line.sizeLabel ? `${line.name} (${line.sizeLabel})` : line.name
    const lineTtc = line.unitCents * line.quantity
    body.push(`${line.quantity}x ${label.substring(0, 18)}`)
    body.push(`   ${formatEUR(lineTtc).padStart(8)}`)
  }

  body.push('-'.repeat(W))
  const fmt = (label: string, cents: number) =>
    `${label.padEnd(20)} ${formatEUR(cents).padStart(8)}`
  body.push(fmt('Sous-total HT', subtotalHt))
  for (const [rate, cents] of Object.entries(taxByRate).sort()) {
    body.push(fmt(`TVA ${rate}%`, cents))
  }
  body.push('='.repeat(W))
  body.push(fmt('TOTAL TTC', totalTtc))
  body.push('='.repeat(W))
  body.push('')
  body.push(padCenter('Sync au retour réseau', W))
  body.push(padCenter('Ticket fiscal définitif', W))
  body.push(padCenter("à l'intégration serveur", W))
  body.push(...buildTicketFooter(branding))

  return body.join('\n')
}

/** Référence locale mode dégradé — préfixe HL- (CDC B5). */
export function newOfflineRef(): string {
  const stamp = Date.now().toString(36).toUpperCase()
  const rnd = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `HL-${rnd}${stamp.slice(-4)}`
}
