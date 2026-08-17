import {
  fetchPrinterConfig,
  invalidatePrinterConfigCache,
  isEpsonBridgeAvailable,
  printKitchenEpsonCascade,
  printToEpsonLan,
  type PrinterConfig,
} from '@/lib/print/epson-lan-print'
import { printKitchenWithCascade } from '@/lib/print/print-job-handler'
import { getSunmiPrinterStatus, isSunmiPrinterAvailable, printOnSunmi } from '@/lib/print/sunmi-printer'
import { testPrintBagLabel, testPrintReceipt } from '@/lib/device-diagnostics'
import {
  getPaymentTerminalMode,
  getTerminalCapabilities,
  isPaymentTerminalAvailable,
} from '@/lib/payment/payment-terminal'
import type { PosPeripheralSettings } from '@/lib/pos-peripherals'
import { loadPosPeripherals } from '@/lib/pos-peripherals'

export type PeripheralTestResult = {
  ok: boolean
  message: string
  detail?: string
}

function testTicketContent(kind: string) {
  return `=== TEST ${kind} ===\n${new Date().toLocaleString('fr-FR')}\nLa Z Pizza — diagnostic POS\n\nOK`
}

export function resolvePrinterIps(
  crm: PrinterConfig,
  settings: PosPeripheralSettings,
): { kitchen: string; counter: string } {
  return {
    kitchen: settings.kitchenLanIpOverride?.trim() || crm.kitchenLanIp?.trim() || '',
    counter: settings.counterLanIpOverride?.trim() || crm.counterLanIp?.trim() || '',
  }
}

export async function probePosHardware(
  settings: PosPeripheralSettings = loadPosPeripherals(),
): Promise<{
  crm: PrinterConfig
  ips: { kitchen: string; counter: string }
  epsonBridge: boolean
  sunmi: boolean
  sunmiStatus: string | null
  tpeNative: boolean
  tpeMode: string
  tpeCaps: ReturnType<typeof getTerminalCapabilities>
}> {
  invalidatePrinterConfigCache()
  const crm = await fetchPrinterConfig(true)
  const ips = resolvePrinterIps(crm, settings)
  return {
    crm,
    ips,
    epsonBridge: isEpsonBridgeAvailable(),
    sunmi: isSunmiPrinterAvailable(),
    sunmiStatus: getSunmiPrinterStatus(),
    tpeNative: isPaymentTerminalAvailable(),
    tpeMode: getPaymentTerminalMode(),
    tpeCaps: getTerminalCapabilities(),
  }
}

export async function testKitchenPrinter(
  settings: PosPeripheralSettings,
  crm?: PrinterConfig,
): Promise<PeripheralTestResult> {
  if (!settings.printerKitchen) {
    return { ok: false, message: 'Imprimante cuisine désactivée' }
  }
  const config = crm ?? (await fetchPrinterConfig(true))
  const ips = resolvePrinterIps(config, settings)
  const content = testTicketContent('CUISINE')

  if (ips.kitchen && isEpsonBridgeAvailable()) {
    const direct = printToEpsonLan(ips.kitchen, content, { bold: true })
    if (direct.ok) {
      return { ok: true, message: 'Ticket envoyé', detail: `Epson cuisine ${ips.kitchen}:9100` }
    }
  }

  const cascade = await printKitchenWithCascade(content, 'KITCHEN', {
    allowSunmi: true,
    allowBrowser: true,
    peripherals: settings,
  })
  if (cascade.ok) {
    return {
      ok: true,
      message: 'Ticket cuisine imprimé',
      detail: cascade.method ?? 'cascade',
    }
  }

  if (!ips.kitchen) {
    return {
      ok: false,
      message: 'IP cuisine manquante',
      detail: 'CRM → Appareils → Réseau, ou saisissez une IP locale ci-dessous',
    }
  }
  return { ok: false, message: 'Échec impression', detail: cascade.error ?? 'vérifiez LAN / APK' }
}

export async function testCounterPrinter(
  settings: PosPeripheralSettings,
  crm?: PrinterConfig,
): Promise<PeripheralTestResult> {
  if (!settings.printerCounter) {
    return { ok: false, message: 'Imprimante caisse désactivée' }
  }
  const config = crm ?? (await fetchPrinterConfig(true))
  const ips = resolvePrinterIps(config, settings)
  const content = testTicketContent('CAISSE')

  if (ips.counter && isEpsonBridgeAvailable()) {
    const r = printToEpsonLan(ips.counter, content, { bold: false })
    if (r.ok) {
      return { ok: true, message: 'Reçu envoyé', detail: `Epson comptoir ${ips.counter}:9100` }
    }
    return { ok: false, message: 'Socket Epson refusé', detail: r.error }
  }

  if (isSunmiPrinterAvailable() && printOnSunmi(content, 'RECEIPT')) {
    return { ok: true, message: 'Reçu SUNMI intégré', detail: 'imprimante V2' }
  }

  try {
    const r = await testPrintReceipt()
    if (r.ok && r.method === 'browser') {
      return { ok: true, message: 'Aperçu navigateur', detail: 'Autorisez la pop-up d\'impression' }
    }
    if (r.ok) {
      return { ok: true, message: 'Reçu imprimé', detail: r.method }
    }
    return {
      ok: false,
      message: 'Aucune imprimante joignable',
      detail: r.error ?? (ips.counter ? 'Pont Epson absent — installez l\'APK' : 'Configurez l\'IP comptoir'),
    }
  } catch {
    return {
      ok: false,
      message: 'Aucune imprimante joignable',
      detail: ips.counter ? 'Pont Epson absent — installez l\'APK' : 'Configurez l\'IP comptoir',
    }
  }
}

export async function testDeliveryPrinter(settings: PosPeripheralSettings): Promise<PeripheralTestResult> {
  if (!settings.printerDelivery) {
    return { ok: false, message: 'Impression livraison désactivée' }
  }
  const cascade = await printKitchenWithCascade(testTicketContent('LIVRAISON'), 'BAG_LABEL', {
    peripherals: settings,
  })
  if (cascade.ok) {
    return { ok: true, message: 'Étiquette imprimée', detail: cascade.method }
  }
  try {
    testPrintBagLabel()
    return { ok: true, message: 'Étiquette (navigateur)', detail: 'pop-up' }
  } catch {
    return { ok: false, message: 'Échec étiquette', detail: cascade.error }
  }
}

export async function testSunmiIntegrated(): Promise<PeripheralTestResult> {
  const raw = getSunmiPrinterStatus()
  if (!isSunmiPrinterAvailable()) {
    return {
      ok: false,
      message: 'SUNMI non détecté',
      detail: 'APK SUNMI V2 requis, ou utilisez Epson LAN',
    }
  }
  let parsed: { ok?: boolean; error?: string; model?: string } = {}
  if (raw) {
    try {
      parsed = JSON.parse(raw) as typeof parsed
    } catch {
      /* ignore */
    }
  }
  const ok = printOnSunmi(testTicketContent('SUNMI'), 'KITCHEN')
  return {
    ok,
    message: ok ? 'Impression SUNMI OK' : 'Échec impression SUNMI',
    detail: parsed.model ? `Modèle ${parsed.model}` : (parsed.error ?? raw ?? undefined),
  }
}

export function testEpsonBridgeLink(): PeripheralTestResult {
  const ok = isEpsonBridgeAvailable()
  return {
    ok,
    message: ok ? 'Pont Epson actif (APK)' : 'Pont Epson absent',
    detail: ok ? 'RAW TCP port 9100 via WebView' : 'Installez pos-sunmi.apk ou pos-tablet.apk',
  }
}

export function testTpeLink(settings: PosPeripheralSettings): PeripheralTestResult {
  if (!settings.tpeEnabled) {
    return { ok: false, message: 'TPE désactivé dans les réglages' }
  }
  const caps = getTerminalCapabilities()
  const native = isPaymentTerminalAvailable()
  if (native && caps) {
    const active = caps.providers.find((p) => p.id === caps.activeProvider)
    const preferred = settings.preferredTpeProviderId
      ? caps.providers.find((p) => p.id === settings.preferredTpeProviderId)
      : null
    const lines = caps.providers
      .map((p) => `${p.label} (${p.connection}) : ${p.available ? 'dispo' : 'off'}`)
      .join(' · ')
    return {
      ok: true,
      message: `TPE natif — ${active?.label ?? caps.activeProvider ?? 'actif'}`,
      detail: preferred ? `Préféré : ${preferred.label} · ${lines}` : lines,
    }
  }
  return {
    ok: true,
    message: 'Mode manuel (pas de TPE natif)',
    detail: 'Validez le paiement sur le terminal physique après encaissement',
  }
}

export async function testCashDrawer(
  settings: PosPeripheralSettings,
  crm?: PrinterConfig,
): Promise<PeripheralTestResult> {
  if (!settings.cashDrawer) {
    return { ok: false, message: 'Tiroir désactivé' }
  }
  const config = crm ?? (await fetchPrinterConfig(true))
  const counterIp = resolvePrinterIps(config, settings).counter
  if (!counterIp) {
    return { ok: false, message: 'IP comptoir requise', detail: 'Le tiroir s\'ouvre via l\'imprimante caisse' }
  }
  if (!isEpsonBridgeAvailable()) {
    return { ok: false, message: 'Pont Epson requis', detail: 'Impulsion tiroir via ESC/POS sur imprimante caisse' }
  }
  const r = printToEpsonLan(counterIp, testTicketContent('TIROIR'), { bold: false })
  if (r.ok) {
    return {
      ok: true,
      message: 'Impulsion envoyée',
      detail: `Vérifiez l'ouverture du tiroir (${counterIp}:9100)`,
    }
  }
  return { ok: false, message: 'Impossible d\'ouvrir le tiroir', detail: r.error }
}

export function testCoinDispenser(): PeripheralTestResult {
  return {
    ok: false,
    message: 'Monnayeur non connecté',
    detail: 'Intégration Cashkeeper / Glory — phase ultérieure',
  }
}

export async function testNewOrderSound(): Promise<PeripheralTestResult> {
  const { playSunmiNewOrderSound } = await import('@/lib/print/sunmi-printer')
  const ok = playSunmiNewOrderSound()
  return {
    ok,
    message: ok ? 'Bip joué' : 'Son indisponible',
    detail: ok ? 'SUNMI APK' : 'Uniquement sur terminal SUNMI',
  }
}
