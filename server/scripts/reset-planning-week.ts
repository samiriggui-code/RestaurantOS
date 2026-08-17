/**
 * Supprime le planning auto-généré de la semaine courante et le régénère (couverture min).
 * Usage: npx tsx scripts/reset-planning-week.ts [--keep]
 */
import { PrismaClient } from '@prisma/client'
import { buildSmartSchedulePlan, datesBetween } from '../src/lib/smart-schedule'
import { resolveScheduleGuardrails } from '../src/lib/smart-schedule'
import { isPlanningParticipant } from '../src/lib/seed-pizzeria-staff'
import { parseBusinessSettings } from '../src/lib/business-settings'

const prisma = new PrismaClient()
const keep = process.argv.includes('--keep')
const BUSINESS_ID = process.env.BUSINESS_ID?.trim() || '00000000-0000-0000-0000-000000000001'

function weekBounds(date = new Date()) {
  const d = new Date(date)
  d.setHours(12, 0, 0, 0)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  const from = d.toISOString().slice(0, 10)
  const end = new Date(d)
  end.setDate(end.getDate() + 6)
  return { from, to: end.toISOString().slice(0, 10) }
}

async function main() {
  const business = await prisma.business.findUnique({ where: { id: BUSINESS_ID } })
  if (!business) throw new Error(`Établissement introuvable (${BUSINESS_ID})`)

  const { from, to } = weekBounds()
  console.log(`Semaine ${from} → ${to}`)

  if (!keep) {
    const deleted = await prisma.employeeScheduleEntry.deleteMany({
      where: { businessId: business.id, date: { gte: from, lte: to } },
    })
    console.log(`Supprimé ${deleted.count} entrées`)
  }

  const settings = parseBusinessSettings(business.settings)
  const guardrails = resolveScheduleGuardrails(settings.planning)

  const [employees, shifts, existing] = await Promise.all([
    prisma.user.findMany({
      where: { businessId: business.id, isActive: true },
      select: { id: true, name: true, role: true, shiftId: true, planningMeta: true },
    }),
    prisma.shift.findMany({
      where: { businessId: business.id, isActive: true },
      select: { id: true, name: true, startTime: true, endTime: true, days: true, slug: true },
    }),
    prisma.employeeScheduleEntry.findMany({
      where: { businessId: business.id, date: { gte: from, lte: to } },
      select: { userId: true, date: true, shiftId: true, roleLabel: true },
    }),
  ])

  const plan = buildSmartSchedulePlan({
    from,
    to,
    employees: employees.filter(isPlanningParticipant),
    shifts,
    existing: [],
    guardrails,
  })

  const staffIds = employees.filter(isPlanningParticipant).map((e) => e.id)
  const dates = datesBetween(from, to)
  const byKey = new Map(plan.proposed.map((p) => [`${p.userId}:${p.date}`, p]))
  let upserted = 0

  for (const empId of staffIds) {
    for (const date of dates) {
      const assignment = byKey.get(`${empId}:${date}`)
      await prisma.employeeScheduleEntry.upsert({
        where: { userId_date: { userId: empId, date } },
        create: {
          businessId: business.id,
          userId: empId,
          date,
          shiftId: assignment?.shiftId ?? null,
          roleLabel: assignment?.roleLabel ?? null,
        },
        update: {
          shiftId: assignment?.shiftId ?? null,
          roleLabel: assignment?.roleLabel ?? null,
        },
      })
      upserted++
    }
  }

  console.log(`Synchronisé ${upserted} cellules · ${plan.proposed.length} services · score ${plan.score}`)
  for (const date of datesBetween(from, to)) {
    const dayEntries = plan.proposed.filter((p) => p.date === date)
    const names = dayEntries.map((p) => {
      const u = employees.find((e) => e.id === p.userId)
      return `${u?.name.split(' ')[0]} (${p.roleLabel})`
    })
    console.log(`  ${date}: ${names.join(', ') || '—'}`)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
