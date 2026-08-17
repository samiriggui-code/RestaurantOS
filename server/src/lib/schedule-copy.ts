/**
 * Duplication de semaines de planning (EmployeeScheduleEntry).
 */

import type { PrismaClient } from '@prisma/client'

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00`)
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

function dayOffset(sourceFrom: string, date: string): number {
  const start = new Date(`${sourceFrom}T12:00:00`)
  const d = new Date(`${date}T12:00:00`)
  return Math.round((d.getTime() - start.getTime()) / 86400000)
}

export async function copyScheduleWeeks(
  prisma: PrismaClient,
  businessId: string,
  input: {
    sourceFrom: string
    targetFrom: string
    /** Nombre de semaines à recopier (1 = une seule semaine cible) */
    weekCount?: number
    overwrite?: boolean
  }
): Promise<{ created: number; skipped: number; weeks: number }> {
  const weekCount = Math.min(Math.max(input.weekCount ?? 1, 1), 4)
  const sourceTo = addDays(input.sourceFrom, 6)

  const sourceEntries = await prisma.employeeScheduleEntry.findMany({
    where: {
      businessId,
      date: { gte: input.sourceFrom, lte: sourceTo },
    },
  })

  let created = 0
  let skipped = 0

  for (let w = 0; w < weekCount; w++) {
    const weekOffset = w * 7
    for (const entry of sourceEntries) {
      const offset = dayOffset(input.sourceFrom, entry.date)
      const newDate = addDays(input.targetFrom, weekOffset + offset)

      const existing = await prisma.employeeScheduleEntry.findUnique({
        where: { userId_date: { userId: entry.userId, date: newDate } },
      })

      if (existing) {
        if (!input.overwrite) {
          skipped++
          continue
        }
        await prisma.employeeScheduleEntry.update({
          where: { id: existing.id },
          data: {
            shiftId: entry.shiftId,
            startTime: entry.startTime,
            endTime: entry.endTime,
            roleLabel: entry.roleLabel,
            notes: entry.notes,
          },
        })
        created++
        continue
      }

      await prisma.employeeScheduleEntry.create({
        data: {
          businessId,
          userId: entry.userId,
          date: newDate,
          shiftId: entry.shiftId,
          startTime: entry.startTime,
          endTime: entry.endTime,
          roleLabel: entry.roleLabel,
          notes: entry.notes,
        },
      })
      created++
    }
  }

  return { created, skipped, weeks: weekCount }
}
