import { staffFetch } from '@/lib/staff-api'
import { apiUrl } from '@/lib/api'
import { getKitchenSocket, joinBusinessRoom } from '@/lib/socket'
import {
  fetchKitchenOrders,
  fetchOnlineOrdersForPos,
  printTicketText,
} from '@/lib/ops-orders'
import {
  getSunmiPrinterStatus,
  isSunmiPrinterAvailable,
  playSunmiNewOrderSound,
  printOnSunmi,
} from '@/lib/print/sunmi-printer'
import {
  getPaymentTerminalMode,
  isPaymentTerminalAvailable,
} from '@/lib/payment/payment-terminal'
import { getOfflineQueueSize } from '@/lib/offline-queue'
import {
  getWebViewCapability,
  getWebViewGoNoGoReport,
  type WebViewCapability,
} from '@/lib/webview-capability'

export async function testApiPing(): Promise<{ ok: boolean; ms: number }> {
  const start = performance.now()
  try {
    const res = await fetch(apiUrl('/health'), { cache: 'no-store' })
    return { ok: res.ok, ms: Math.round(performance.now() - start) }
  } catch {
    return { ok: false, ms: Math.round(performance.now() - start) }
  }
}

export async function testStaffApi(token: string): Promise<boolean> {
  try {
    await staffFetch('/settings', { token })
    return true
  } catch {
    return false
  }
}

export async function testSocketConnection(token: string, businessId: string): Promise<boolean> {
  try {
    const socket = getKitchenSocket(token)
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('timeout')), 5000)
      const onConnect = () => {
        clearTimeout(timeout)
        joinBusinessRoom(socket, businessId)
        socket.off('connect', onConnect)
        resolve()
      }
      if (socket.connected) {
        clearTimeout(timeout)
        joinBusinessRoom(socket, businessId)
        resolve()
        return
      }
      socket.on('connect', onConnect)
    })
    return true
  } catch {
    return false
  }
}

export async function testPosMenuLoad(token: string, businessId: string): Promise<boolean> {
  try {
    const data = await staffFetch<unknown[]>(
      `/menu/categories?businessId=${businessId}`,
      { token }
    )
    return Array.isArray(data)
  } catch {
    return false
  }
}

export async function testOnlineOrdersQueue(token: string): Promise<boolean> {
  try {
    await fetchOnlineOrdersForPos(token)
    return true
  } catch {
    return false
  }
}

export async function testKitchenOrdersApi(token: string): Promise<boolean> {
  try {
    await fetchKitchenOrders(token)
    return true
  } catch {
    return false
  }
}

import { printKitchenWithCascade } from '@/lib/print/print-job-handler'

export async function testPrintKitchenTicket(options?: {
  allowBrowser?: boolean
}): Promise<{ ok: boolean; method?: string; error?: string }> {
  const content = `=== TEST CUISINE ===\n${new Date().toLocaleString('fr-FR')}\n\n1. Epson cuisine\n2. Epson caisse\n3. SUNMI intégrée\n\nOK`
  const result = await printKitchenWithCascade(content, 'KITCHEN', {
    allowSunmi: true,
    allowBrowser: options?.allowBrowser !== false,
  })
  if (result.ok && result.method === 'browser' && options?.allowBrowser === false) {
    return { ok: false, method: 'browser', error: 'impression_navigateur_non_valide' }
  }
  return { ok: result.ok, method: result.method, error: result.error }
}

export function testPrintBagLabel(): void {
  printTicketText(
    `=== ETIQUETTE SAC ===\n${new Date().toLocaleString('fr-FR')}\n\n#TEST\nClient: Diagnostic POS\n\nOK`,
    'Test étiquette sac',
    'BAG_LABEL'
  )
}

import {
  fetchPrinterConfig,
  printWithEpsonFallback,
} from '@/lib/print/epson-lan-print'

export async function testPrintReceipt(options?: {
  allowBrowser?: boolean
}): Promise<{ ok: boolean; method?: string; error?: string }> {
  const content = `=== RECU CAISSE ===\n${new Date().toLocaleString('fr-FR')}\n\nTotal: 12,50 €\nMerci !\n\nOK`
  if (isSunmiPrinterAvailable()) {
    const ok = printOnSunmi(content, 'RECEIPT')
    return {
      ok,
      method: ok ? 'sunmi' : undefined,
      error: ok ? undefined : (getSunmiPrinterStatus() ?? 'impression_sunmi_echouee'),
    }
  }

  const printers = await fetchPrinterConfig()
  const epson = await printWithEpsonFallback(content, 'RECEIPT', printers)
  if (epson.ok) return { ok: true, method: 'epson-counter' }

  if (options?.allowBrowser === false) {
    return { ok: false, error: epson.error ?? 'aucune_imprimante_joignable' }
  }

  printTicketText(content, 'Test reçu client')
  return { ok: true, method: 'browser', error: epson.error ?? undefined }
}

export function testSunmiBridge(): { available: boolean; status: string | null } {
  return {
    available: isSunmiPrinterAvailable(),
    status: getSunmiPrinterStatus(),
  }
}

export function testSunmiSound(): boolean {
  return playSunmiNewOrderSound()
}

export function testPaymentTerminal(): { available: boolean; mode: 'native' | 'manual' } {
  return {
    available: isPaymentTerminalAvailable(),
    mode: getPaymentTerminalMode(),
  }
}

export function getWebViewDiagnostics(): WebViewCapability {
  return getWebViewCapability()
}

export function getWebViewGoNoGoClipboard(): string {
  return getWebViewGoNoGoReport()
}

export async function testOfflineQueueSize(): Promise<number> {
  try {
    return await getOfflineQueueSize()
  } catch {
    return -1
  }
}
