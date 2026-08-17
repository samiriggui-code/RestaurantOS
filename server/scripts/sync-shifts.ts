import { PrismaClient } from '@prisma/client'
import { assignRoleDefaultShifts, syncPizzeriaShifts } from '../src/lib/pizzeria-shifts'

const prisma = new PrismaClient()

async function main() {
  const businesses = await prisma.business.findMany({ select: { id: true, name: true } })
  for (const b of businesses) {
    const r = await syncPizzeriaShifts(prisma, b.id)
    const assigned = await assignRoleDefaultShifts(prisma, b.id)
    console.log(`${b.name}: created=${r.created} updated=${r.updated} deactivated=${r.deactivated} assigned=${assigned}`)
  }
  const shifts = await prisma.shift.findMany({
    select: { slug: true, name: true, startTime: true, endTime: true, isActive: true, targetRoles: true },
    orderBy: [{ isActive: 'desc' }, { sortOrder: 'asc' }],
  })
  console.log('Shifts in DB:', JSON.stringify(shifts, null, 2))
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
