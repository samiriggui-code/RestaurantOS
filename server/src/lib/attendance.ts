/** Pointage employés — calcul durée, fenêtre d'entrée, statuts. */

import { fiscalDayKey, parisTimeOnDay } from './fiscal/timezone'

export type AttendanceStatus = 'NONE' | 'IN' | 'OUT'

/** Minutes avant le créneau où le pointage entrée s'ouvre. */
export const CLOCK_IN_EARLY_MINUTES = 10

export function todayDateKey(now = new Date()): string {
  return fiscalDayKey(now)
}

export function computeMinutesWorked(clockIn: Date, clockOut: Date): number {
  const ms = clockOut.getTime() - clockIn.getTime()
  if (ms <= 0) return 0
  return Math.round(ms / 60000)
}

export function formatMinutesWorked(minutes: number | null | undefined): string {
  if (minutes == null || minutes <= 0) return '—'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m} min`
  return `${h} h ${m.toString().padStart(2, '0')}`
}

export function attendanceStatus(
  record: { clockIn: Date; clockOut: Date | null } | null | undefined,
): AttendanceStatus {
  if (!record) return 'NONE'
  if (!record.clockOut) return 'IN'
  return 'OUT'
}

export function formatParisClockTime(date: Date): string {
  return date.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Paris',
  })
}

export type ClockInWindow = {
  canClockIn: boolean
  opensAt: Date | null
  blockedReason: string | null
}

/** Vérifie si l'employé peut pointer entrée (planifié + fenêtre 10 min avant créneau). */
export function evaluateClockInWindow(
  now: Date,
  date: string,
  scheduled: boolean,
  startTime: string | null,
  status: AttendanceStatus,
): ClockInWindow {
  if (status === 'IN') {
    return { canClockIn: false, opensAt: null, blockedReason: null }
  }
  if (status === 'OUT') {
    return { canClockIn: false, opensAt: null, blockedReason: 'Journée déjà clôturée' }
  }
  if (!scheduled || !startTime) {
    return {
      canClockIn: false,
      opensAt: null,
      blockedReason: 'Non planifié aujourd\'hui — demandez un remplacement au KDS',
    }
  }

  const slotStart = parisTimeOnDay(date, startTime)
  const opensAt = new Date(slotStart.getTime() - CLOCK_IN_EARLY_MINUTES * 60_000)

  if (now.getTime() < opensAt.getTime()) {
    return {
      canClockIn: false,
      opensAt,
      blockedReason: `Pointage ouvert à ${formatParisClockTime(opensAt)} (${CLOCK_IN_EARLY_MINUTES} min avant le créneau)`,
    }
  }

  return { canClockIn: true, opensAt, blockedReason: null }
}

export function serializeAttendance(record: {
  id: string
  date: string
  clockIn: Date
  clockOut: Date | null
  minutesWorked: number | null
  source: string
  shiftId: string | null
}) {
  const status = attendanceStatus(record)
  return {
    id: record.id,
    date: record.date,
    clockIn: record.clockIn.toISOString(),
    clockOut: record.clockOut?.toISOString() ?? null,
    minutesWorked: record.minutesWorked,
    minutesWorkedLabel: formatMinutesWorked(record.minutesWorked),
    status,
    source: record.source,
    shiftId: record.shiftId,
  }
}
