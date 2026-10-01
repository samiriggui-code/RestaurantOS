import { PIZZERIA } from '@/lib/pizzeria-content'

export const TICKET_WIDTH = 32

export const TICKET_THANK_YOU = 'Merci et à bientôt !'

const LEGAL = {
  legalName: 'LA Z PIZZA',
  siret: '981 700 842 00017',
  vatNumber: 'FR81 981 700 842',
  legalForm: 'Société à responsabilité limitée',
  website: 'lazpizza.fr',
} as const

export type TicketBranding = {
  tradeName: string
  legalName: string
  address: string
  phone: string
  siret: string
  vatNumber: string
  legalForm: string
  website: string
}

export function padCenter(text: string, width = TICKET_WIDTH): string {
  const trimmed = text.trim()
  if (trimmed.length >= width) return trimmed.slice(0, width)
  const padding = width - trimmed.length
  const left = Math.floor(padding / 2)
  return ' '.repeat(left) + trimmed + ' '.repeat(padding - left)
}

export function wrapTicketLines(text: string, width = TICKET_WIDTH): string[] {
  const words = text.trim().split(/\s+/)
  if (!words.length) return []
  const lines: string[] = []
  let current = words[0]
  for (let i = 1; i < words.length; i++) {
    const next = `${current} ${words[i]}`
    if (next.length <= width) {
      current = next
    } else {
      lines.push(current)
      current = words[i]
    }
  }
  lines.push(current)
  return lines
}

/** Icône pizza (icon.svg) + wordmark — 58 mm. */
export function buildTicketLogoLines(width = TICKET_WIDTH): string[] {
  return [
    padCenter('.-----.', width),
    padCenter('|  Z  |', width),
    padCenter("'-----'", width),
    padCenter('La Z Pizza', width),
    padCenter('FARGUES · 33370', width),
  ]
}

export function defaultTicketBranding(businessName?: string): TicketBranding {
  return {
    tradeName: businessName?.trim() || PIZZERIA.name,
    legalName: LEGAL.legalName,
    address: PIZZERIA.fullAddress,
    phone: PIZZERIA.phone,
    siret: LEGAL.siret,
    vatNumber: LEGAL.vatNumber,
    legalForm: LEGAL.legalForm,
    website: LEGAL.website,
  }
}

export type TicketHeaderOptions = {
  banner?: string
  width?: number
  mode?: 'full' | 'kitchen' | 'label'
}

export function buildKitchenTicketHeader(options?: TicketHeaderOptions): string[] {
  const W = options?.width ?? TICKET_WIDTH
  const lines: string[] = [...buildTicketLogoLines(W)]
  if (options?.banner?.trim()) {
    lines.push(padCenter(options.banner.trim(), W))
  }
  lines.push('-'.repeat(W))
  return lines
}

export function buildTicketHeader(
  branding: TicketBranding,
  options?: TicketHeaderOptions,
): string[] {
  const mode = options?.mode ?? 'full'
  if (mode === 'kitchen') {
    return buildKitchenTicketHeader(options)
  }

  const W = options?.width ?? TICKET_WIDTH
  const sep = '='.repeat(W)
  const lines: string[] = ['', sep, ...buildTicketLogoLines(W), sep]

  if (mode === 'label') {
    if (options?.banner?.trim()) {
      lines.push(padCenter(options.banner.trim(), W))
      lines.push('-'.repeat(W))
    }
    return lines
  }

  if (options?.banner?.trim()) {
    lines.push(padCenter(options.banner.trim(), W))
  }
  lines.push('-'.repeat(W), '')
  return lines
}

export function buildTicketFooter(
  branding: TicketBranding,
  options?: { thankYou?: string; legal?: 'full' | 'compact' | 'none'; width?: number },
): string[] {
  const W = options?.width ?? TICKET_WIDTH
  const legal = options?.legal ?? 'full'
  if (legal === 'none') {
    return options?.thankYou ? [padCenter(options.thankYou, W)] : []
  }

  const lines: string[] = ['', '-'.repeat(W)]

  if (legal === 'full') {
    if (branding.legalName !== branding.tradeName) {
      lines.push(...wrapTicketLines(branding.legalName, W))
    }
    lines.push(...wrapTicketLines(branding.address, W))
    lines.push(`Tel : ${branding.phone}`)
    lines.push(`SIRET : ${branding.siret}`)
    lines.push(`TVA : ${branding.vatNumber}`)
    lines.push(...wrapTicketLines(branding.legalForm, W))
  } else {
    lines.push(...wrapTicketLines(branding.tradeName, W))
    lines.push(`SIRET : ${branding.siret}`)
  }

  lines.push('-'.repeat(W))
  lines.push(padCenter(options?.thankYou ?? TICKET_THANK_YOU, W))
  const site = branding.website.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '')
  if (site) lines.push(padCenter(site, W))
  lines.push('')
  return lines
}
