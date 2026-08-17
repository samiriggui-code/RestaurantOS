import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { ensureSnapshotMenuItem } from '../src/lib/online-order'
import { syncLazPizzaCatalog, syncLazPizzaDeliveryZones } from '../src/lib/sync-lazpizza-catalog'
import { syncPizzaSizeModifiers } from '../src/lib/sync-pizza-modifiers'
import { syncMenuFormules } from '../src/lib/sync-menu-formules'
import { seedPizzeriaExpenses, seedPizzeriaStock } from '../src/lib/seed-pizzeria-ops'
import { seedPizzeriaStockRecipes } from '../src/lib/seed-pizzeria-recipes'
import { seedPizzeriaShifts, seedStaffAllBusinesses } from '../src/lib/seed-pizzeria-staff'
import { lazPizzaDefaultBusinessSettings, lazPizzaStaffEmail } from '../src/lib/laz-pizza-identity'
import { parseBusinessSettings } from '../src/lib/business-settings'

const prisma = new PrismaClient()

const BUSINESS_ID = process.env.BUSINESS_ID?.trim() || '00000000-0000-0000-0000-000000000001'

function mergeSeedBusinessSettings(existing: unknown) {
  const fresh = lazPizzaDefaultBusinessSettings()
  const prev = parseBusinessSettings(existing)
  return {
    ...fresh,
    ...prev,
    planning: { ...(fresh.planning ?? {}), ...(prev.planning ?? {}) },
    // Ne jamais effacer jumelage / IP WAN / onboarding au redeploy seed
    devices: prev.devices,
  }
}

/** Compte admin CRM — Atmane Chennit, gérant La Z Pizza */
const ADMIN_EMAIL = lazPizzaStaffEmail('atmane', 'chennit')
const ADMIN_PASSWORD = 'admin123'

async function main() {
  const existingBiz = await prisma.business.findUnique({
    where: { id: BUSINESS_ID },
    select: { settings: true },
  })
  const bizSettings = mergeSeedBusinessSettings(existingBiz?.settings)
  const business = await prisma.business.upsert({
    where: { id: BUSINESS_ID },
    update: {
      name: 'La Z Pizza',
      nameAr: null,
      currency: 'EUR',
      taxRate: 10,
      serviceChargeRate: 0,
      settings: bizSettings,
    },
    create: {
      id: BUSINESS_ID,
      name: 'La Z Pizza',
      taxRate: 10,
      serviceChargeRate: 0,
      currency: 'EUR',
      wifiDuration: 120,
      settings: bizSettings,
    },
  })

  const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 12)

  const ATMANE_PLANNING_META = {
    employmentType: 'FULL_TIME' as const,
    maxDaysPerWeek: 6,
    canSubstitute: ['CHEF', 'CASHIER', 'DRIVER'],
  }

  await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {
      businessId: business.id,
      name: 'Atmane Chennit',
      role: 'ADMIN',
      isActive: true,
      phone: bizSettings.phone,
      pin: '2468',
      password: hashedPassword,
      planningMeta: ATMANE_PLANNING_META,
    },
    create: {
      name: 'Atmane Chennit',
      email: ADMIN_EMAIL,
      password: hashedPassword,
      role: 'ADMIN',
      pin: '2468',
      businessId: business.id,
      phone: bizSettings.phone,
      planningMeta: ATMANE_PLANNING_META,
    },
  })

  console.log('👥 Employés opérationnels…')
  const bizCount = await seedStaffAllBusinesses(prisma)
  await prisma.user.updateMany({
    where: { role: 'ADMIN', isActive: true },
    data: { shiftId: null },
  })
  console.log(`   ${bizCount} établissement(s) — Atmane (2468), Marco (5678), Lucas TP (3456), Amine TP partiel (7890), Sophie (1234)`)

  await ensureSnapshotMenuItem(prisma, business.id)

  console.log('📦 Sync catalogue La Z Pizza → PostgreSQL…')
  await syncLazPizzaCatalog(prisma, business.id)
  await syncLazPizzaDeliveryZones(prisma, business.id)
  const modResult = await syncPizzaSizeModifiers(prisma, business.id)
  console.log(`   Modificateurs taille pizza : ${modResult.pizzas} pizzas, ${modResult.options} options`)
  const formulesResult = await syncMenuFormules(prisma, business.id)
  console.log(
    `   Formules menu : ${formulesResult.drinkModifiers} boissons, ${formulesResult.dessertModifiers} desserts`
  )

  for (let day = 0; day <= 6; day++) {
    const existing = await prisma.timeSlot.findFirst({
      where: { businessId: business.id, dayOfWeek: day },
    })
    if (existing) {
      await prisma.timeSlot.update({
        where: { id: existing.id },
        data: { startTime: '18:00', endTime: '22:00', capacity: 10, isActive: true },
      })
    } else {
      await prisma.timeSlot.create({
        data: {
          businessId: business.id,
          dayOfWeek: day,
          startTime: '18:00',
          endTime: '22:00',
          capacity: 10,
        },
      })
    }
  }

  console.log('📦 Stock & dépenses pizzeria…')
  const stock = await seedPizzeriaStock(prisma, business.id)
  const expenses = await seedPizzeriaExpenses(prisma, business.id)
  console.log(`   Stock : ${stock.created} créés, ${stock.updated} mis à jour (${stock.total} articles)`)
  const recipes = await seedPizzeriaStockRecipes(prisma, business.id)
  console.log(`   Recettes BOM : ${recipes.recipes} lignes, ${recipes.linked} boissons liées`)
  console.log(
    expenses.skipped
      ? '   Dépenses démo déjà présentes — skip'
      : `   Dépenses : ${expenses.created} charges démo ajoutées`
  )

  const menuCount = await prisma.menuCategory.count({
    where: { businessId: business.id, slug: { not: null } },
  })
  if (menuCount === 0) {
    console.warn('⚠️ Catalogue vide après sync — vérifier sync-lazpizza-catalog.ts')
  }

  console.log('✅ Seed La Z Pizza OK')
  await prisma.fiscalSequence.upsert({
    where: { businessId: business.id },
    create: {
      businessId: business.id,
      softwareVersion: process.env.FISCAL_SOFTWARE_VERSION ?? '1.0.0',
    },
    update: {},
  })
  console.log('📜 Séquence fiscale ISCA initialisée')
  console.log(`📧 Admin CRM : ${ADMIN_EMAIL} / ${ADMIN_PASSWORD} (PIN 2468)`)
  console.log('🧾 Caisse PIN : 1234 · Cuisine PIN : 5678 · Livreur PIN : 3456')
  console.log(`🏪 Business ID : ${business.id}`)
  console.log('💶 Montants en centimes EUR dans la base')
}

main()
  .catch((e) => {
    console.error('Seed error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
