import dotenv from 'dotenv'
import { PrismaClient } from '@prisma/client'
import { syncLazPizzaCatalog } from '../src/lib/sync-lazpizza-catalog'
import { syncPizzaSizeModifiers } from '../src/lib/sync-pizza-modifiers'
import { syncMenuFormules } from '../src/lib/sync-menu-formules'

dotenv.config()

const prisma = new PrismaClient()
const businessId = process.env.BUSINESS_ID

async function main() {
  if (!businessId) {
    throw new Error('BUSINESS_ID manquant dans server/.env')
  }
  const result = await syncLazPizzaCatalog(prisma, businessId)
  const modifiers = await syncPizzaSizeModifiers(prisma, businessId)
  const formules = await syncMenuFormules(prisma, businessId)
  console.log('Catalogue flyer importé :')
  console.log(`  ${result.items}/${result.expectedItems} produits`)
  console.log(`  ${result.categories}/${result.expectedCategories} catégories`)
  console.log(`  Tailles pizza : ${modifiers.pizzas} articles, ${modifiers.options} options`)
  console.log(`  Formules : ${formules.drinkModifiers} boissons, ${formules.dessertModifiers} desserts`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => void prisma.$disconnect())
