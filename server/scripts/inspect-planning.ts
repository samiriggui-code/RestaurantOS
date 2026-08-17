import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, name: true, role: true, email: true },
    orderBy: { name: 'asc' },
  })
  console.log('=== USERS ACTIFS ===')
  console.log(JSON.stringify(users, null, 2))

  const entries = await prisma.employeeScheduleEntry.findMany({
    where: { date: { gte: '2026-07-07', lte: '2026-07-13' } },
    include: { user: { select: { name: true, email: true } }, shift: { select: { name: true } } },
    orderBy: [{ date: 'asc' }, { user: { name: 'asc' } }],
  })
  console.log('\n=== PLANNING SEMAINE ===', entries.length, 'entrées')
  for (const e of entries) {
    console.log(e.date, e.user.name, e.shift?.name ?? '—', e.user.email)
  }
}

main()
  .finally(() => prisma.$disconnect())
