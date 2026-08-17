import type { PrismaClient } from '@prisma/client'
import { fiscalDayKey, parisHour, suggestFiscalCloseDayKey } from './timezone'

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

export async function getFiscalClosureStatus(
  prisma: PrismaClient,
  businessId: string,
): Promise<FiscalClosureStatus> {
  const now = new Date()
  const dayKey = fiscalDayKey(now)
  const suggestedDayKey = suggestFiscalCloseDayKey(now)
  const hour = parisHour(now)

  const closure = await prisma.fiscalClosure.findUnique({
    where: {
      businessId_periodType_periodKey: {
        businessId,
        periodType: 'DAILY',
        periodKey: suggestedDayKey,
      },
    },
    select: { id: true, closedAt: true },
  })

  const closed = Boolean(closure)
  /** Rappel : soir (≥22 h) ou retour tardif (≤6 h) si la journée suggérée n'est pas clôturée. */
  const needsReminder = !closed && (hour >= 22 || hour < 6)

  return {
    dayKey,
    suggestedDayKey,
    timezone: 'Europe/Paris',
    closed,
    closureId: closure?.id,
    closedAt: closure?.closedAt?.toISOString(),
    needsReminder,
    parisHour: hour,
    autoClosureEnabled: process.env.FISCAL_AUTO_Z_CLOSURE !== 'false',
  }
}
