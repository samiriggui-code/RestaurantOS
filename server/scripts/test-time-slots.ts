import { prisma } from '../src/lib/prisma'
import { computeAvailableTimeSlots } from '../src/lib/time-slots'
import { getBusinessId } from '../src/lib/business'

async function main() {
  const businessId = getBusinessId()
  console.log('businessId', businessId)
  const result = await computeAvailableTimeSlots(prisma, businessId)
  console.log(JSON.stringify(result, null, 2))
}

main()
  .catch((e) => {
    console.error('FAILED', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
