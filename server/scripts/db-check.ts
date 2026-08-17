import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const [business, categories, items, users, orders, zones] = await Promise.all([
    prisma.business.count(),
    prisma.menuCategory.count({ where: { isActive: true } }),
    prisma.menuItem.count({ where: { isActive: true, slug: { not: '__snapshot__' } } }),
    prisma.user.count(),
    prisma.order.count(),
    prisma.deliveryZone.count(),
  ])

  console.log('Base PostgreSQL : restaurantos @ localhost:5432')
  console.log('---')
  console.log(`Business (pizzeria) : ${business}`)
  console.log(`Utilisateurs        : ${users}`)
  console.log(`Catégories menu     : ${categories}`)
  console.log(`Produits menu       : ${items}`)
  console.log(`Commandes           : ${orders}`)
  console.log(`Zones livraison     : ${zones}`)
}

main()
  .catch((e) => {
    console.error('Connexion impossible :', e.message)
    process.exit(1)
  })
  .finally(() => void prisma.$disconnect())
