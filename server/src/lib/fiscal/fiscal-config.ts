import type { PrismaClient } from '@prisma/client'
import { parseBusinessSettings } from '../business-settings'

const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/

export function isValidFiscalDayKey(dayKey: string): boolean {
  return DAY_KEY_RE.test(dayKey)
}

/** Première journée où la clôture Z est exigée (mise en service ISCA). */
export async function getFiscalActivationDayKey(
  prisma: PrismaClient,
  businessId: string,
): Promise<string | null> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { settings: true },
  })
  const settings = parseBusinessSettings(business?.settings)
  if (settings.fiscalActivationDate && isValidFiscalDayKey(settings.fiscalActivationDate)) {
    return settings.fiscalActivationDate
  }

  const seq = await prisma.fiscalSequence.findUnique({
    where: { businessId },
    select: { commissionedAt: true },
  })
  if (!seq) return null

  const d = seq.commissionedAt
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function assertFiscalDayOnOrAfterActivation(
  dayKey: string,
  activationDayKey: string | null,
): void {
  if (!activationDayKey || !isValidFiscalDayKey(dayKey)) return
  if (dayKey < activationDayKey) {
    throw new Error(
      `Journée ${dayKey} antérieure à la mise en service ISCA (${activationDayKey}). ` +
        'Les clôtures Z ne commencent qu’à partir de la date d’activation.',
    )
  }
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

export async function getFiscalConfigSummary(
  prisma: PrismaClient,
  businessId: string,
): Promise<FiscalConfigSummary> {
  const [business, seq] = await Promise.all([
    prisma.business.findUnique({
      where: { id: businessId },
      select: { settings: true },
    }),
    prisma.fiscalSequence.findUnique({ where: { businessId } }),
  ])
  const settings = parseBusinessSettings(business?.settings)
  const activationDayKey = await getFiscalActivationDayKey(prisma, businessId)

  const minioHost = process.env.MINIO_CONSOLE_HOST?.trim()
  const backupEnabled = process.env.MINIO_ENABLED === 'true' && Boolean(minioHost)
  const devConsole = process.env.MINIO_DEV_CONSOLE === 'true'

  return {
    activationDayKey,
    commissionedAt: seq?.commissionedAt.toISOString() ?? null,
    softwareVersion: seq?.softwareVersion ?? process.env.FISCAL_SOFTWARE_VERSION ?? '1.0.0',
    trainingMode: Boolean(settings.fiscalTrainingMode),
    labRepairEnabled: process.env.FISCAL_ALLOW_JET_REPAIR === 'true',
    backupEnabled,
    backupInventoryEnabled:
      process.env.MINIO_ENABLED === 'true' ||
      Boolean(process.env.BACKUP_DIR?.trim()) ||
      Boolean(process.env.FISCAL_ARCHIVE_DIR?.trim()),
    backupConsoleUrl: backupEnabled && minioHost && devConsole ? `https://${minioHost}` : null,
  }
}
