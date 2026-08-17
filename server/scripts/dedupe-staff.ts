/**
 * Supprime définitivement les comptes legacy (@lazpizza.fr, admin@cafe.com)
 * après migration des données vers les emails @lazpizzafarguesainthilaire.com
 */
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { lazPizzaStaffEmail, LAZ_PIZZA_LEGAL } from '../src/lib/laz-pizza-identity'
import { assignRoleDefaultShifts, syncPizzeriaShifts } from '../src/lib/pizzeria-shifts'
import { seedPizzeriaStaff } from '../src/lib/seed-pizzeria-staff'
import {
  buildSmartSchedulePlan,
  datesBetween,
  resolveScheduleGuardrails,
} from '../src/lib/smart-schedule'
import { parseBusinessSettings } from '../src/lib/business-settings'
import { isPlanningParticipant } from '../src/lib/seed-pizzeria-staff'

const prisma = new PrismaClient()

const MERGE_MAP: Record<string, string> = {
  'caisse@lazpizza.fr': 'sophie.caissier@lazpizzafarguesainthilaire.com',
  'cuisine@lazpizza.fr': 'marco.cuisinier@lazpizzafarguesainthilaire.com',
  'livreur@lazpizza.fr': 'lucas.livreur@lazpizzafarguesainthilaire.com',
}

const LEGACY_EMAILS = [
  ...Object.keys(MERGE_MAP),
  'admin@cafe.com',
]

async function mergeThenDelete(fromEmail: string, toEmail: string) {
  const from = await prisma.user.findUnique({ where: { email: fromEmail } })
  const to = await prisma.user.findUnique({ where: { email: toEmail } })
  if (!from) return
  if (to && from.id !== to.id) {
    for (const row of await prisma.employeeScheduleEntry.findMany({ where: { userId: from.id } })) {
      const clash = await prisma.employeeScheduleEntry.findUnique({
        where: { userId_date: { userId: to.id, date: row.date } },
      })
      if (clash) await prisma.employeeScheduleEntry.delete({ where: { id: row.id } })
      else await prisma.employeeScheduleEntry.update({ where: { id: row.id }, data: { userId: to.id } })
    }
    const fromAtt = await prisma.attendance.findMany({ where: { userId: from.id } })
    for (const att of fromAtt) {
      const clash = await prisma.attendance.findUnique({
        where: { userId_date: { userId: to.id, date: att.date } },
      })
      if (clash) await prisma.attendance.delete({ where: { id: att.id } })
      else await prisma.attendance.update({ where: { id: att.id }, data: { userId: to.id } })
    }
    await prisma.order.updateMany({ where: { cashierId: from.id }, data: { cashierId: to.id } })
  } else {
    await prisma.attendance.deleteMany({ where: { userId: from.id } })
    await prisma.order.updateMany({ where: { cashierId: from.id }, data: { cashierId: null } })
  }

  await prisma.user.delete({ where: { id: from.id } })
  console.log(`  ✓ Supprimé ${fromEmail}`)
}

async function purgeAllLegacy(businessId: string) {
  const legacyUsers = await prisma.user.findMany({
    where: {
      businessId,
      OR: [
        { email: { in: LEGACY_EMAILS } },
        { email: { endsWith: '@lazpizza.fr' } },
      ],
    },
  })

  for (const u of legacyUsers) {
    const canonical = MERGE_MAP[u.email]
    if (canonical) {
      await mergeThenDelete(u.email, canonical)
    } else {
      await prisma.attendance.deleteMany({ where: { userId: u.id } })
      await prisma.order.updateMany({ where: { cashierId: u.id }, data: { cashierId: null } })
      await prisma.user.delete({ where: { id: u.id } })
      console.log(`  ✓ Supprimé ${u.email}`)
    }
  }
}

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

async function regeneratePlanning(businessId: string) {
  const { from, to } = weekBounds()
  await prisma.employeeScheduleEntry.deleteMany({
    where: { businessId, date: { gte: from, lte: to } },
  })

  const business = await prisma.business.findUnique({ where: { id: businessId } })
  const guardrails = resolveScheduleGuardrails(parseBusinessSettings(business?.settings).planning)

  const [employees, shifts] = await Promise.all([
    prisma.user.findMany({
      where: { businessId, isActive: true },
      select: { id: true, name: true, role: true, shiftId: true, planningMeta: true },
    }),
    prisma.shift.findMany({
      where: { businessId, isActive: true },
      select: { id: true, name: true, startTime: true, endTime: true, days: true, slug: true },
    }),
  ])

  const staff = employees.filter(isPlanningParticipant)
  const plan = buildSmartSchedulePlan({
    from,
    to,
    employees: staff,
    shifts,
    existing: [],
    guardrails,
  })

  const staffIds = staff.map((e) => e.id)
  const dates = datesBetween(from, to)
  const byKey = new Map(plan.proposed.map((p) => [`${p.userId}:${p.date}`, p]))

  for (const empId of staffIds) {
    for (const date of dates) {
      const assignment = byKey.get(`${empId}:${date}`)
      await prisma.employeeScheduleEntry.create({
        data: {
          businessId,
          userId: empId,
          date,
          shiftId: assignment?.shiftId ?? null,
          roleLabel: assignment?.roleLabel ?? null,
        },
      })
    }
  }

  console.log(`\nPlanning ${from} → ${to} · ${plan.proposed.length} services · score ${plan.score}`)
  for (const date of dates) {
    const day = plan.proposed.filter((p) => p.date === date)
    const names = day.map((p) => {
      const u = staff.find((e) => e.id === p.userId)
      return `${u?.name.split(' ')[0]} (${p.roleLabel})`
    })
    console.log(`  ${date}: ${names.join(', ') || '—'}`)
  }
}

async function main() {
  const business = await prisma.business.findFirst()
  if (!business) throw new Error('Aucun établissement')

  console.log('1. Suppression comptes legacy…')
  await purgeAllLegacy(business.id)

  console.log('\n2. Compte gérant unique…')
  const adminEmail = lazPizzaStaffEmail('atmane', 'chennit')
  const hashed = await bcrypt.hash('admin123', 12)
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      businessId: business.id,
      name: 'Atmane Chennit',
      role: 'ADMIN',
      isActive: true,
      phone: LAZ_PIZZA_LEGAL.phone,
      pin: '2468',
      password: hashed,
      planningMeta: {
        employmentType: 'FULL_TIME',
        maxDaysPerWeek: 6,
        canSubstitute: ['CHEF', 'CASHIER', 'DRIVER'],
      },
    },
    create: {
      businessId: business.id,
      name: 'Atmane Chennit',
      email: adminEmail,
      password: hashed,
      role: 'ADMIN',
      pin: '2468',
      phone: LAZ_PIZZA_LEGAL.phone,
      planningMeta: {
        employmentType: 'FULL_TIME',
        maxDaysPerWeek: 6,
        canSubstitute: ['CHEF', 'CASHIER', 'DRIVER'],
      },
    },
  })
  console.log(`  ✓ ${adminEmail}`)

  console.log('\n3. Équipe canonique (2 livreurs, 1 caissier, 1 cuisinier)…')
  await seedPizzeriaStaff(prisma, business.id)
  await syncPizzeriaShifts(prisma, business.id)
  await assignRoleDefaultShifts(prisma, business.id)

  const active = await prisma.user.findMany({
    where: { businessId: business.id, isActive: true },
    select: { name: true, email: true, role: true },
    orderBy: { name: 'asc' },
  })
  console.log('\nUtilisateurs actifs:')
  for (const u of active) console.log(`  · ${u.name} — ${u.email} (${u.role})`)

  console.log('\n4. Planning semaine…')
  await regeneratePlanning(business.id)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
