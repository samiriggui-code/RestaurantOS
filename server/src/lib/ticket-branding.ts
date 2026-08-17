import { LAZ_PIZZA_LEGAL } from './laz-pizza-identity'

export const TICKET_WIDTH = 32

export const TICKET_THANK_YOU = 'Merci et à bientôt !'

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

export function resolveTicketBranding(business: {
  name?: string | null
  settings?: unknown
}): TicketBranding {
  const settings =
    business?.settings && typeof business.settings === 'object'
      ? (business.settings as Record<string, string | undefined>)
      : {}

  return {
    tradeName: business?.name?.trim() || LAZ_PIZZA_LEGAL.tradeName,
    legalName: settings.legalName?.trim() || LAZ_PIZZA_LEGAL.legalName,
    address: settings.address?.trim() || LAZ_PIZZA_LEGAL.address,
    phone: settings.phone?.trim() || LAZ_PIZZA_LEGAL.phone,
    siret: settings.siret?.trim() || LAZ_PIZZA_LEGAL.siret,
    vatNumber: settings.vatNumber?.trim() || LAZ_PIZZA_LEGAL.vatNumber,
    legalForm: settings.legalForm?.trim() || LAZ_PIZZA_LEGAL.legalForm,
    website: settings.website?.trim() || LAZ_PIZZA_LEGAL.website,
  }
}

export type TicketHeaderOptions = {
  /** Sous-titre centré sous le logo (ex. « CUISINE », « COLIS »). */
  banner?: string
  width?: number
  /** full = reçu client ; kitchen = ticket cuisine compact ; label = étiquette sac */
  mode?: 'full' | 'kitchen' | 'label'
}

/** En-tête ticket cuisine — logo + bannière, sans mentions légales. */
export function buildKitchenTicketHeader(options?: TicketHeaderOptions): string[] {
  const W = options?.width ?? TICKET_WIDTH
  const lines: string[] = [...buildTicketLogoLines(W)]
  if (options?.banner?.trim()) {
    lines.push(padCenter(options.banner.trim(), W))
  }
  lines.push('-'.repeat(W))
  return lines
}

/** En-tête ticket : logo + bannière optionnelle. */
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

export type TicketFooterOptions = {
  thankYou?: string
  /** Pied légal complet (défaut) ou réduit pour étiquette sac. */
  legal?: 'full' | 'compact' | 'none'
  width?: number
}

/** Pied de page : mentions légales obligatoires + remerciement. */
export function buildTicketFooter(
  branding: TicketBranding,
  options?: TicketFooterOptions,
): string[] {
  const W = options?.width ?? TICKET_WIDTH
  const legal = options?.legal ?? 'full'
  if (legal === 'none') {
    return options?.thankYou ? [padCenter(options.thankYou, W)] : []
  }

  const lines: string[] = ['', '-'.repeat(W)]

  if (legal === 'full') {
    if (branding.legalName && branding.legalName !== branding.tradeName) {
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
