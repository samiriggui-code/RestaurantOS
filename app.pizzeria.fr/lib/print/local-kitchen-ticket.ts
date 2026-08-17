import {
  buildTicketHeader,
  defaultTicketBranding,
  TICKET_WIDTH,
} from '@/lib/print/ticket-branding'
import { formatEUR } from '@/lib/money'

type CartLine = {
  name: string
  quantity: number
  unitCents: number
  sizeLabel?: string
}

/** Ticket cuisine minimal pour impression locale hors-ligne (CDC §4.2 B5). */
export function generateLocalKitchenTicket(
  lines: CartLine[],
  opts: { orderType: string; paymentMethod: string; tempRef: string },
): string {
  const W = TICKET_WIDTH
  const branding = defaultTicketBranding()
  const typeLabel =
    opts.orderType === 'DELIVERY'
      ? 'Livraison'
      : opts.orderType === 'TAKEAWAY'
        ? 'À emporter'
        : 'Sur place'
  const payLabel = opts.paymentMethod === 'CARD' ? 'Carte' : 'Espèces'
  const now = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

  const body: string[] = [
    ...buildTicketHeader(branding, { banner: 'CUISINE', mode: 'kitchen' }),
    'HORS-LIGNE',
    `Ref: ${opts.tempRef}`,
    `Mode: ${typeLabel}`,
    `Heure: ${now}`,
    `Paiement: ${payLabel}`,
    '-'.repeat(W),
  ]

  for (const line of lines) {
    const label = line.sizeLabel ? `${line.name} (${line.sizeLabel})` : line.name
    body.push(`${line.quantity}x ${label}`)
    body.push(`   ${formatEUR(line.unitCents * line.quantity)}`)
  }

  body.push('-'.repeat(W))
  return body.join('\n')
}
