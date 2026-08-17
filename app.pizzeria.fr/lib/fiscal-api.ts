import { staffFetch } from '@/lib/staff-api'

export type FiscalSequenceInfo = {
  nextTicketNo: number
  grandTotalCents: string
  softwareVersion: string
  commissionedAt: string
}

export type FiscalTicketRow = {
  id: string
  serialNumber: number
  kind: string
  issuedAt: string
  totalCents: number
  paymentMethod: string | null
  orderId: string | null
  recordHash: string
  offlineRef: string | null
  voidOfId: string | null
}

export type FiscalEventRow = {
  id: string
  eventType: string
  operatorId: string | null
  entityType: string | null
  entityId: string | null
  payload: unknown
  recordHash: string
  createdAt: string
}

export type FiscalClosureRow = {
  id: string
  periodType: string
  periodKey: string
  totals: unknown
  grandTotalCents: string
  ticketCount: number
  recordHash: string
  closedAt: string
  closedById: string | null
}

export type FiscalVerifyResult = {
  success: boolean
  ok: boolean
  ticketsChecked: number
  eventsChecked: number
  closuresChecked: number
  firstBreakAt?: string
  message: string
}

export type FiscalClosureStatus = {
  dayKey: string
  suggestedDayKey: string
  timezone: string
  closed: boolean
  closureId?: string
  closedAt?: string
  needsReminder: boolean
  parisHour: number
  autoClosureEnabled: boolean
}

export type PrecloseCheckSeverity = 'ok' | 'warning' | 'blocker'

export type PrecloseCheck = {
  id: string
  severity: PrecloseCheckSeverity
  label: string
  detail: string
  count?: number
  actionHint?: string
}

export type DailyPreclosePreview = {
  dayKey: string
  dayLabel: string
  timezone: string
  parisNow: string
  parisHour: number
  suggestedDayKey: string
  activationDayKey: string | null
  periodStart: string
  periodEnd: string
  alreadyClosed: boolean
  closureId?: string
  closedAt?: string
  canClose: boolean
  blockerCount: number
  warningCount: number
  checks: PrecloseCheck[]
  fiscal: {
    saleCount: number
    voidCount: number
    revenueCents: number
    byPaymentMethod: Record<string, number>
    taxByRate: Record<string, number>
    tickets: Array<{
      id: string
      serialNumber: number
      kind: string
      totalCents: number
      paymentMethod: string | null
      orderId: string | null
      issuedAt: string
      voidOfId: string | null
    }>
  }
  orders: {
    byChannel: Record<string, { count: number; totalCents: number }>
    paidWithoutTicket: Array<{ orderNumber: number; total: number; channel: string }>
    pendingPayment: Array<{ orderNumber: number; total: number }>
    openKitchen: Array<{ orderNumber: number; total: number; status: string }>
    cancelledPaid: Array<{ orderNumber: number; total: number }>
    thirdParty: Array<{ orderNumber: number; total: number; customerName: string | null }>
  }
  chainIntegrity: boolean
  grandTotalPerpetualCents: string
  periodicReminders: {
    monthlyDue: boolean
    monthlyKey?: string
    yearlyDue: boolean
    yearlyKey?: number
  }
}

export type OpenFiscalDayRow = {
  dayKey: string
  dayLabel: string
  closed: boolean
  hasActivity: boolean
  revenueCents: number
  suggested: boolean
}

export type FiscalConfigSummary = {
  activationDayKey: string | null
  commissionedAt: string | null
  softwareVersion: string
  trainingMode: boolean
  labRepairEnabled: boolean
  backupEnabled: boolean
  backupInventoryEnabled: boolean
  backupConsoleUrl: string | null
}

export type FiscalBackupRow = {
  id: string
  filename: string
  kind: 'postgres' | 'fiscal'
  kindLabel: string
  dayKey: string
  createdAt: string
  sizeBytes: number
  sizeLabel: string
  source: 'minio' | 'local'
  status: 'ok'
}

export type FiscalBackupsResult = {
  month: string
  backups: FiscalBackupRow[]
  minioConfigured: boolean
  localDirConfigured: boolean
}

export function fetchFiscalConfig(token: string) {
  return staffFetch<FiscalConfigSummary>('/fiscal/config', { token })
}

export function fetchFiscalBackups(token: string, month?: string) {
  const q = month ? `?month=${encodeURIComponent(month)}` : ''
  return staffFetch<FiscalBackupsResult>(`/fiscal/backups${q}`, { token })
}

export function fetchFiscalClosureStatus(token: string) {
  return staffFetch<FiscalClosureStatus>('/fiscal/closure-status', { token })
}

export function fetchFiscalSequence(token: string) {
  return staffFetch<{ sequence: FiscalSequenceInfo | null }>('/fiscal/sequence', { token })
}

export function fetchFiscalVerify(token: string) {
  return staffFetch<FiscalVerifyResult>('/fiscal/verify', { token })
}

export function fetchFiscalTickets(token: string, limit = 50) {
  return staffFetch<{ tickets: FiscalTicketRow[] }>(`/fiscal/tickets?limit=${limit}`, { token })
}

export function fetchFiscalEvents(token: string, limit = 100) {
  return staffFetch<{ events: FiscalEventRow[] }>(`/fiscal/events?limit=${limit}`, { token })
}

export function fetchFiscalClosures(token: string, limit = 30) {
  return staffFetch<{ closures: FiscalClosureRow[] }>(`/fiscal/closures?limit=${limit}`, { token })
}

export function fetchFiscalOpenDays(token: string) {
  return staffFetch<{
    suggestedDayKey: string
    timezone: string
    days: OpenFiscalDayRow[]
  }>('/fiscal/preclose/open-days', { token })
}

export function fetchDailyPreclose(token: string, dayKey: string) {
  return staffFetch<{ preview: DailyPreclosePreview }>(
    `/fiscal/preclose/daily?dayKey=${encodeURIComponent(dayKey)}`,
    { token },
  )
}

export function acknowledgeDailyPreclose(
  token: string,
  body: {
    dayKey: string
    managerNotes?: string
    cashCountedCents?: number | null
    confirmWarnings?: boolean
  },
) {
  return staffFetch<{
    success: boolean
    precloseId: string
    expiresAt: string
    preview: DailyPreclosePreview
  }>('/fiscal/preclose/daily/acknowledge', {
    method: 'POST',
    token,
    body: JSON.stringify(body),
  })
}

export function closeFiscalDay(token: string, dayKey: string, precloseId: string) {
  return staffFetch<{ success: boolean; closure: FiscalClosureRow }>('/fiscal/closures/daily', {
    method: 'POST',
    token,
    body: JSON.stringify({ dayKey, precloseId }),
  })
}

export type FiscalArchiveRow = {
  id: string
  fiscalYear: number
  storagePath: string
  contentHash: string
  exportedAt: string
  exportedById: string | null
}

export function fetchFiscalArchives(token: string) {
  return staffFetch<{ archives: FiscalArchiveRow[] }>('/fiscal/archives', { token })
}

export function exportFiscalYearArchive(token: string, fiscalYear: number) {
  return staffFetch<{ success: boolean; archive: FiscalArchiveRow }>('/fiscal/archives/yearly', {
    method: 'POST',
    token,
    body: JSON.stringify({ fiscalYear }),
  })
}

export async function downloadFiscalArchive(token: string, fiscalYear: number): Promise<Blob> {
  const base = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ?? ''
  const res = await fetch(`${base}/api/fiscal/archives/${fiscalYear}/download`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? 'Téléchargement impossible')
  }
  return res.blob()
}

export function recordFiscalReprint(token: string, orderId: string) {
  return staffFetch<{ success: boolean; reprintNumber: number; label: string | null }>('/fiscal/reprint', {
    method: 'POST',
    token,
    body: JSON.stringify({ orderId }),
  })
}

export function issueFiscalVoid(token: string, ticketId: string, reason: string) {
  return staffFetch<{ success: boolean; ticket: unknown }>('/fiscal/void', {
    method: 'POST',
    token,
    body: JSON.stringify({ ticketId, reason }),
  })
}
