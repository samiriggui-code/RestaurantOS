import type { PrismaClient } from '@prisma/client'
import { formatMinutesWorked } from './attendance'

export type MonthlyHoursDayEntry = {
  date: string
  clockIn: string
  clockOut: string
  minutes: number
  hoursLabel: string
  source: string
}

export type MonthlyHoursRow = {
  userId: string
  name: string
  role: string
  daysWorked: number
  totalMinutes: number
  totalHoursLabel: string
  avgMinutesPerDay: number
  avgHoursLabel: string
  records: number
  days: MonthlyHoursDayEntry[]
}

export function parseMonthKey(raw: string | undefined, now = new Date()): string {
  if (raw && /^\d{4}-\d{2}$/.test(raw)) return raw
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

export function monthDateBounds(monthKey: string): { from: string; to: string; label: string } {
  const [yStr, mStr] = monthKey.split('-')
  const y = Number(yStr)
  const m = Number(mStr)
  const from = `${monthKey}-01`
  const lastDay = new Date(y, m, 0).getDate()
  const to = `${monthKey}-${String(lastDay).padStart(2, '0')}`
  const label = new Date(y, m - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
  return { from, to, label }
}

export async function buildMonthlyHoursSummary(
  prisma: PrismaClient,
  businessId: string,
  monthKey: string,
): Promise<{ month: string; label: string; from: string; to: string; rows: MonthlyHoursRow[] }> {
  const { from, to, label } = monthDateBounds(monthKey)

  const records = await prisma.attendance.findMany({
    where: {
      businessId,
      date: { gte: from, lte: to },
      clockOut: { not: null },
    },
    include: { user: { select: { id: true, name: true, role: true } } },
    orderBy: [{ user: { name: 'asc' } }, { date: 'asc' }],
  })

  const absentReplaced = await prisma.employeeScheduleEntry.findMany({
    where: {
      businessId,
      date: { gte: from, lte: to },
      notes: { contains: 'Absent — remplacé' },
    },
    select: { userId: true, date: true },
  })
  const skipAbsentKeys = new Set(absentReplaced.map((e) => `${e.userId}:${e.date}`))

  const scheduleByUserDate = await prisma.employeeScheduleEntry.findMany({
    where: {
      businessId,
      date: { gte: from, lte: to },
      notes: { contains: 'Remplace ' },
    },
    select: { userId: true, date: true, roleLabel: true },
  })
  const substituteRole = new Map(
    scheduleByUserDate.map((e) => [`${e.userId}:${e.date}`, e.roleLabel ?? '']),
  )

  const byUser = new Map<
    string,
    MonthlyHoursRow & { dayDates: Set<string> }
  >()

  for (const r of records) {
    if (skipAbsentKeys.has(`${r.userId}:${r.date}`)) continue

    const minutes = r.minutesWorked ?? 0
    const subRole = substituteRole.get(`${r.userId}:${r.date}`)
    const dayEntry: MonthlyHoursDayEntry = {
      date: r.date,
      clockIn: r.clockIn.toISOString(),
      clockOut: r.clockOut!.toISOString(),
      minutes,
      hoursLabel: formatMinutesWorked(minutes),
      source: subRole ? `${r.source} · ${subRole}` : r.source,
    }
    const existing = byUser.get(r.userId)
    if (!existing) {
      byUser.set(r.userId, {
        userId: r.userId,
        name: r.user.name,
        role: r.user.role,
        daysWorked: 1,
        totalMinutes: minutes,
        totalHoursLabel: formatMinutesWorked(minutes),
        avgMinutesPerDay: minutes,
        avgHoursLabel: formatMinutesWorked(minutes),
        records: 1,
        days: [dayEntry],
        dayDates: new Set([r.date]),
      })
    } else {
      if (!existing.dayDates.has(r.date)) {
        existing.daysWorked += 1
        existing.dayDates.add(r.date)
      }
      existing.totalMinutes += minutes
      existing.records += 1
      existing.totalHoursLabel = formatMinutesWorked(existing.totalMinutes)
      existing.avgMinutesPerDay = Math.round(existing.totalMinutes / existing.daysWorked)
      existing.avgHoursLabel = formatMinutesWorked(existing.avgMinutesPerDay)
      existing.days.push(dayEntry)
    }
  }

  const rows = [...byUser.values()]
    .map(({ dayDates: _dayDates, days, ...row }) => ({
      ...row,
      days: days.sort((a, b) => a.date.localeCompare(b.date)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
  return { month: monthKey, label, from, to, rows }
}

export function monthlyHoursToCsv(
  summary: Awaited<ReturnType<typeof buildMonthlyHoursSummary>>,
): string {
  const lines = [
    'Employé;Rôle;Jours pointés;Moy. h/jour;Heures (min);Heures (libellé);Pointages',
    ...summary.rows.map(
      (r) =>
        `${csvCell(r.name)};${csvCell(r.role)};${r.daysWorked};${csvCell(r.avgHoursLabel)};${r.totalMinutes};${csvCell(r.totalHoursLabel)};${r.records}`,
    ),
  ]
  return `\uFEFF${lines.join('\n')}`
}

function csvCell(value: string): string {
  const safe = value.replace(/"/g, '""')
  return `"${safe}"`
}
