import { apiFetch } from '@/lib/api'

export type PrinterConfig = {
  kitchenLanIp?: string
  counterLanIp?: string
}

type EpsonBridge = {
  printToLan: (ip: string, content: string, bold: string) => string
  isAvailable?: () => string
}

declare global {
  interface Window {
    EpsonPrinter?: EpsonBridge
  }
}

let cachedPrinters: PrinterConfig | null = null
let cacheAt = 0
const CACHE_MS = 60_000

export function isEpsonBridgeAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.EpsonPrinter?.printToLan === 'function'
}

export async function fetchPrinterConfig(force = false): Promise<PrinterConfig> {
  const now = Date.now()
  if (!force && cachedPrinters && now - cacheAt < CACHE_MS) return cachedPrinters
  try {
    const data = await apiFetch<{ printers: PrinterConfig }>('/devices/public/printers')
    cachedPrinters = data.printers ?? {}
    cacheAt = now
    return cachedPrinters
  } catch {
    return cachedPrinters ?? {}
  }
}

export function invalidatePrinterConfigCache() {
  cachedPrinters = null
  cacheAt = 0
}

function parseBridgeResult(raw: string): { ok: boolean; error?: string } {
  try {
    const data = JSON.parse(raw) as { ok?: boolean; error?: string }
    return { ok: data.ok === true, error: data.error }
  } catch {
    return { ok: false, error: 'réponse pont invalide' }
  }
}

/** Impression Epson LAN via pont Android WebView (port 9100 ESC/POS). */
export function printToEpsonLan(
  ip: string,
  content: string,
  options?: { bold?: boolean },
): { ok: boolean; error?: string } {
  if (!isEpsonBridgeAvailable()) {
    return { ok: false, error: 'pont_epson_indisponible' }
  }
  const raw = window.EpsonPrinter!.printToLan(ip, content, options?.bold ? '1' : '0')
  return parseBridgeResult(raw)
}

export type EpsonPrintAttempt = {
  ok: boolean
  target?: 'kitchen' | 'counter'
  ip?: string
  error?: string
}

/** Ticket cuisine / étiquette — imprimante cuisine puis caisse (Epson LAN). */
export async function printKitchenEpsonCascade(
  content: string,
  ticketType: 'KITCHEN' | 'BAG_LABEL',
  printers?: PrinterConfig,
  options?: { kitchenEnabled?: boolean; counterEnabled?: boolean },
): Promise<EpsonPrintAttempt> {
  const cfg = printers ?? (await fetchPrinterConfig())
  const bold = ticketType === 'KITCHEN'
  const kitchenEnabled = options?.kitchenEnabled !== false
  const counterEnabled = options?.counterEnabled !== false
  const targets: { key: 'kitchen' | 'counter'; ip?: string; enabled: boolean }[] = [
    { key: 'kitchen', ip: cfg.kitchenLanIp?.trim(), enabled: kitchenEnabled },
    { key: 'counter', ip: cfg.counterLanIp?.trim(), enabled: counterEnabled },
  ]

  let lastError = 'ip_imprimante_non_configuree'
  for (const { key, ip, enabled } of targets) {
    if (!enabled || !ip) continue
    const result = printToEpsonLan(ip, content, { bold })
    if (result.ok) return { ok: true, target: key, ip }
    lastError = result.error ?? `impression_${key}_echouee`
  }

  return { ok: false, error: lastError }
}

export async function printWithEpsonFallback(
  content: string,
  ticketType: 'KITCHEN' | 'BAG_LABEL' | 'RECEIPT',
  printers?: PrinterConfig,
): Promise<{ ok: boolean; method: 'epson' | 'none'; error?: string }> {
  const cfg = printers ?? (await fetchPrinterConfig())
  const ip =
    ticketType === 'RECEIPT' ? cfg.counterLanIp?.trim() : cfg.kitchenLanIp?.trim()
  if (!ip) return { ok: false, method: 'none', error: 'ip_imprimante_non_configuree' }

  const bold = ticketType === 'KITCHEN'
  const result = printToEpsonLan(ip, content, { bold })
  if (result.ok) return { ok: true, method: 'epson' }
  return { ok: false, method: 'none', error: result.error ?? 'impression_epson_echouee' }
}
