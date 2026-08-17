import dotenv from 'dotenv'
import { PrismaClient } from '@prisma/client'
import { seedPizzeriaExpenses, seedPizzeriaStock } from '../src/lib/seed-pizzeria-ops'

dotenv.config()

const prisma = new PrismaClient()
const businessId = process.env.BUSINESS_ID

async function main() {
  if (!businessId) throw new Error('BUSINESS_ID manquant dans server/.env')
  const stock = await seedPizzeriaStock(prisma, businessId)
  const expenses = await seedPizzeriaExpenses(prisma, businessId)
  console.log('Stock :', stock)
  console.log('Dépenses :', expenses)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => void prisma.$disconnect())
