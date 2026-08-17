import { staffFetch } from '@/lib/staff-api'
import { printBrowserTicket, type PrintTicketType } from '@/lib/ops-orders'
import {
  fetchPrinterConfig,
  isEpsonBridgeAvailable,
  printKitchenEpsonCascade,
  printWithEpsonFallback,
} from '@/lib/print/epson-lan-print'
import {
  isKitchenDeviceContext,
  isNativeDeviceApp,
  shouldAllowBrowserPrint,
} from '@/lib/print/print-context'
import {
  getSunmiPrinterStatus,
  isSunmiPrinterAvailable,
  printOnSunmi,
} from '@/lib/print/sunmi-printer'
import { enqueueSunmiPrint } from '@/lib/print/sunmi-print-queue'
import {
  epsonTargetsFromPeripherals,
  loadPosPeripherals,
  peripheralsAllowPrint,
  type PosPrintTicketType,
  type PosPeripheralSettings,
} from '@/lib/pos-peripherals'

export type PrintJobPayload = {
  id: string
  type: string
  status: string
  createdAt?: string
  payload?: { text?: string } | null
  orderId?: string | null
}

export type KitchenPrintResult = {
  ok: boolean
  method?: 'epson-kitchen' | 'epson-counter' | 'sunmi' | 'browser'
  error?: string
}

export function printJobSunmiType(type: string): 'KITCHEN' | 'RECEIPT' {
  return type === 'RECEIPT' ? 'RECEIPT' : 'KITCHEN'
}

export async function updatePrintJobStatus(
  jobId: string,
  status: 'PRINTED' | 'FAILED',
  token: string,
  error?: string | null,
) {
  return staffFetch(`/print-jobs/${jobId}`, {
    method: 'PATCH',
    token,
    body: JSON.stringify({ status, error: error ?? undefined }),
  })
}

async function isPrintJobStillPending(jobId: string, token: string): Promise<boolean> {
  try {
    const jobs = await staffFetch<PrintJobPayload[]>('/print-jobs?status=PENDING&limit=100', { token })
    return jobs.some((j) => j.id === jobId)
  } catch {
    return true
  }
}

function ticketTitle(type: PrintTicketType): string {
  if (type === 'BAG_LABEL') return 'Étiquette colis'
  if (type === 'RECEIPT') return 'Reçu client'
  return 'Ticket cuisine'
}

/**
 * Ticket cuisine — cascade :
 * 1. Epson cuisine (LAN)
 * 2. Epson caisse (LAN)
 * 3. Imprimante intégrée SUNMI (POS V2)
 * 4. Aperçu navigateur (dernier recours KDS)
 */
export async function printKitchenWithCascade(
  content: string,
  ticketType: 'KITCHEN' | 'BAG_LABEL',
  options?: {
    allowSunmi?: boolean
    allowBrowser?: boolean
    peripherals?: ReturnType<typeof loadPosPeripherals>
    /** Relais POS — ignore toggles périphériques */
    forcePrint?: boolean
  },
): Promise<KitchenPrintResult> {
  const onKitchenDevice = isKitchenDeviceContext()
  const allowSunmi = options?.allowSunmi !== false && !onKitchenDevice
  const allowBrowser = options?.allowBrowser !== false && shouldAllowBrowserPrint()
  const peripherals = options?.peripherals ?? loadPosPeripherals()
  const printType: PosPrintTicketType = ticketType
  if (
    !onKitchenDevice &&
    !options?.forcePrint &&
    !peripheralsAllowPrint(printType, peripherals)
  ) {
    return { ok: false, error: 'impression_desactivee_peripheriques' }
  }
  const printers = await fetchPrinterConfig()
  const epsonTargets = onKitchenDevice
    ? { kitchenEnabled: true, counterEnabled: true }
    : epsonTargetsFromPeripherals(peripherals)

  const epson = await printKitchenEpsonCascade(content, ticketType, printers, epsonTargets)
  if (epson.ok) {
    return {
      ok: true,
      method: epson.target === 'counter' ? 'epson-counter' : 'epson-kitchen',
    }
  }

  if (allowSunmi && isSunmiPrinterAvailable()) {
    const sunmiOk = await enqueueSunmiPrint(() => printOnSunmi(content, ticketType))
    if (sunmiOk) return { ok: true, method: 'sunmi' }
    return { ok: false, error: getSunmiPrinterStatus() ?? 'impression_sunmi_echouee' }
  }

  if (allowBrowser) {
    printBrowserTicket(content, ticketTitle(ticketType), ticketType)
    return { ok: true, method: 'browser', error: epson.error }
  }

  return { ok: false, error: epson.error ?? 'impression_echouee' }
}

/** @deprecated utiliser printKitchenWithCascade */
export async function printKitchenTicketFromDevice(
  content: string,
  ticketType: 'KITCHEN' | 'BAG_LABEL',
): Promise<{ ok: boolean; error?: string }> {
  const result = await printKitchenWithCascade(content, ticketType, {
    allowSunmi: isSunmiPrinterAvailable(),
    allowBrowser: true,
  })
  return { ok: result.ok, error: result.error }
}

async function printTicketWithFallback(
  content: string,
  ticketType: PrintTicketType,
): Promise<{ ok: boolean; error?: string | null }> {
  if (ticketType === 'KITCHEN' || ticketType === 'BAG_LABEL') {
    const kitchen = await printKitchenWithCascade(content, ticketType)
    return { ok: kitchen.ok, error: kitchen.error ?? null }
  }

  const printers = await fetchPrinterConfig()
  const epson = await printWithEpsonFallback(content, ticketType, printers)
  if (epson.ok) return { ok: true, error: null }

  printBrowserTicket(content, ticketTitle(ticketType), ticketType)
  return { ok: true, error: epson.error ?? null }
}

/** Relais POS — laisse le KDS tenter Epson avant SUNMI. */
const RELAY_DELAY_TABLET_MS = 2000
const RELAY_DELAY_SUNMI_MS = 2000
const RELAY_DELAY_BAG_LABEL_MS = 6500

const posPrintJobDedupe = new Map<string, number>()
const POS_PRINT_DEDUPE_MS = 15_000

function claimPosPrintJob(jobId: string): boolean {
  const now = Date.now()
  for (const [id, at] of posPrintJobDedupe) {
    if (now - at > POS_PRINT_DEDUPE_MS) posPrintJobDedupe.delete(id)
  }
  if (posPrintJobDedupe.has(jobId)) return false
  posPrintJobDedupe.set(jobId, now)
  return true
}

/** Caisse — cuisine : relais KDS → SUNMI intégrée / Epson ; reçu : SUNMI / Epson caisse. */
export async function handlePosPrintJob(job: PrintJobPayload, token: string) {
  if (job.status !== 'PENDING') return
  if (job.type !== 'RECEIPT' && job.type !== 'KITCHEN' && job.type !== 'BAG_LABEL') return
  if (!claimPosPrintJob(job.id)) return

  const content = job.payload?.text
  if (!content) {
    await updatePrintJobStatus(job.id, 'FAILED', token, 'Contenu ticket vide')
    return
  }

  const ticketType = job.type as 'KITCHEN' | 'BAG_LABEL' | 'RECEIPT'
  const peripherals = loadPosPeripherals()
  const isKitchenRelay = ticketType === 'KITCHEN' || ticketType === 'BAG_LABEL'

  if (!isKitchenRelay && !peripheralsAllowPrint(ticketType, peripherals)) {
    await updatePrintJobStatus(job.id, 'PRINTED', token, 'skipped_peripherals')
    return
  }

  if (ticketType === 'KITCHEN' || ticketType === 'BAG_LABEL') {
    const sunmi = isSunmiPrinterAvailable()
    const epsonBridge = isEpsonBridgeAvailable()
    const relayDelay =
      ticketType === 'BAG_LABEL' ? RELAY_DELAY_BAG_LABEL_MS : RELAY_DELAY_SUNMI_MS

    if (sunmi) {
      await new Promise((r) => setTimeout(r, relayDelay))
      if (!(await isPrintJobStillPending(job.id, token))) return
      const result = await printKitchenWithCascade(content, ticketType, {
        allowSunmi: true,
        allowBrowser: false,
        forcePrint: true,
        peripherals: { ...peripherals, printerKitchen: true, printerDelivery: true },
      })
      await updatePrintJobStatus(
        job.id,
        result.ok ? 'PRINTED' : 'FAILED',
        token,
        result.ok ? null : result.error ?? 'cascade_echouee',
      )
      return
    }

    if (epsonBridge) {
      await new Promise((r) => setTimeout(r, relayDelay))
      if (!(await isPrintJobStillPending(job.id, token))) return
      const result = await printKitchenWithCascade(content, ticketType, {
        allowSunmi: false,
        allowBrowser: false,
        forcePrint: true,
        peripherals: { ...peripherals, printerKitchen: true, printerDelivery: true },
      })
      if (result.ok) {
        await updatePrintJobStatus(job.id, 'PRINTED', token)
        return
      }
    }

    await updatePrintJobStatus(job.id, 'FAILED', token, 'relais_caisse_indisponible')
    return
  }

  let ok = false
  let error: string | null = null

  if (isSunmiPrinterAvailable()) {
    ok = await enqueueSunmiPrint(() => printOnSunmi(content, 'RECEIPT'))
    if (!ok) error = getSunmiPrinterStatus()
  } else {
    const printers = await fetchPrinterConfig()
    const epson = await printWithEpsonFallback(content, 'RECEIPT', printers)
    if (epson.ok) {
      ok = true
    } else if (!isNativeDeviceApp()) {
      printBrowserTicket(content, ticketTitle('RECEIPT'), 'RECEIPT')
      ok = true
    } else {
      error = epson.error ?? 'impression_epson_echouee'
    }
  }

  await updatePrintJobStatus(job.id, ok ? 'PRINTED' : 'FAILED', token, error)
}

/** Évite double impression (socket + bouton manuel KDS). */
const kitchenJobDedupe = new Map<string, number>()
const KITCHEN_JOB_DEDUPE_MS = 15_000

function claimKitchenPrintJob(jobId: string): boolean {
  const now = Date.now()
  for (const [id, at] of kitchenJobDedupe) {
    if (now - at > KITCHEN_JOB_DEDUPE_MS) kitchenJobDedupe.delete(id)
  }
  if (kitchenJobDedupe.has(jobId)) return false
  kitchenJobDedupe.set(jobId, now)
  return true
}

/** KDS — Epson cuisine → caisse ; si HS, job PENDING → relais POS SUNMI / tablette. */
export async function handleKitchenPrintJob(
  job: PrintJobPayload,
  token: string,
): Promise<KitchenPrintResult> {
  if (job.status !== 'PENDING') return { ok: false, error: 'job_non_pending' }
  if (job.type !== 'KITCHEN' && job.type !== 'BAG_LABEL') {
    return { ok: false, error: 'type_invalide' }
  }
  if (!claimKitchenPrintJob(job.id)) {
    return { ok: true, method: 'epson-kitchen' }
  }

  const content = job.payload?.text
  if (!content) {
    await updatePrintJobStatus(job.id, 'FAILED', token, 'Contenu ticket vide')
    return { ok: false, error: 'contenu_vide' }
  }

  const ticketType = job.type as 'KITCHEN' | 'BAG_LABEL'
  const result = await printKitchenWithCascade(content, ticketType, {
    allowSunmi: false,
    allowBrowser: false,
  })

  if (result.ok) {
    await updatePrintJobStatus(job.id, 'PRINTED', token)
  }

  return result
}

export async function drainPosPrintJobs(jobs: PrintJobPayload[], token: string) {
  for (const job of jobs) {
    await handlePosPrintJob(job, token)
  }
}

export async function drainKitchenPrintJobs(jobs: PrintJobPayload[], token: string) {
  for (const job of jobs) {
    await handleKitchenPrintJob(job, token)
  }
}

export { printTicketWithFallback }
