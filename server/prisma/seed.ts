import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { ensureSnapshotMenuItem } from '../src/lib/online-order';
import { syncLazPizzaCatalog } from '../src/lib/sync-lazpizza-catalog';
import { syncPizzaSizeModifiers } from '../src/lib/sync-pizza-modifiers';
import { syncMenuFormules } from '../src/lib/sync-menu-formules';
import { seedPizzeriaExpenses, seedPizzeriaStock } from '../src/lib/seed-pizzeria-ops';
import { seedPizzeriaStockRecipes } from '../src/lib/seed-pizzeria-recipes';
import { seedStaffAllBusinesses } from '../src/lib/seed-pizzeria-staff';
import { lazPizzaDefaultBusinessSettings, lazPizzaStaffEmail } from '../src/lib/laz-pizza-identity';
import { parseBusinessSettings } from '../src/lib/business-settings';

const prisma = new PrismaClient();

const BUSINESS_ID = process.env.BUSINESS_ID?.trim() || '00000000-0000-0000-0000-000000000001';

function mergeSeedBusinessSettings(
  existing: unknown
): ReturnType<typeof lazPizzaDefaultBusinessSettings> {
  const fresh = lazPizzaDefaultBusinessSettings();
  const prev = parseBusinessSettings(existing);
  return {
    ...fresh,
    ...prev,
    planning: { ...(fresh.planning ?? {}), ...(prev.planning ?? {}) },
    // Ne jamais effacer jumelage / IP WAN / onboarding au redeploy seed
    devices: prev.devices,
  };
}

/** Compte admin CRM — Atmane Chennit, gérant La Z Pizza (atmane.chennit@lazpizza.fr) */
const ADMIN_EMAIL = lazPizzaStaffEmail('atmane', 'chennit');
/** Ancienne adresse (avant bascule sur lazpizza.fr) — renommée si présente. */
const LEGACY_ADMIN_EMAIL = 'atmane.chennit@lazpizzafarguesainthilaire.com';
const IS_PROD = process.env.NODE_ENV === 'production';
/**
 * Mot de passe / PIN utilisés UNIQUEMENT à la création du compte — jamais réécrits ensuite,
 * sinon chaque redeploy remettrait le mot de passe choisi par le gérant à sa valeur initiale.
 * En prod : ADMIN_PASSWORD obligatoire (pas de défaut) ; ADMIN_PIN optionnel.
 */
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD?.trim() || (IS_PROD ? '' : 'admin123');
const ADMIN_PIN = process.env.ADMIN_PIN?.trim() || (IS_PROD ? null : '2468');

async function main(): Promise<void> {
  const existingBiz = await prisma.business.findUnique({
    where: { id: BUSINESS_ID },
    select: { settings: true },
  });
  const bizSettings = mergeSeedBusinessSettings(existingBiz?.settings);
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
  });

  const ATMANE_PLANNING_META = {
    employmentType: 'FULL_TIME' as const,
    maxDaysPerWeek: 6,
    canSubstitute: ['CHEF', 'CASHIER', 'DRIVER'],
  };

  // Bascule de domaine : renomme l'ancien compte au lieu d'en créer un second.
  const [legacyAdmin, currentAdmin] = await Promise.all([
    prisma.user.findUnique({ where: { email: LEGACY_ADMIN_EMAIL }, select: { id: true } }),
    prisma.user.findUnique({ where: { email: ADMIN_EMAIL }, select: { id: true } }),
  ]);
  if (legacyAdmin && !currentAdmin) {
    await prisma.user.update({ where: { id: legacyAdmin.id }, data: { email: ADMIN_EMAIL } });
    console.log(`👤 Admin renommé → ${ADMIN_EMAIL}`);
  }

  const adminExists = Boolean(currentAdmin || legacyAdmin);
  if (!adminExists && !ADMIN_PASSWORD) {
    throw new Error(
      `ADMIN_PASSWORD requis pour créer le compte admin ${ADMIN_EMAIL} en production.`
    );
  }

  await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {
      businessId: business.id,
      name: 'Atmane Chennit',
      role: 'ADMIN',
      isActive: true,
      phone: bizSettings.phone,
      planningMeta: ATMANE_PLANNING_META,
    },
    create: {
      name: 'Atmane Chennit',
      email: ADMIN_EMAIL,
      password: await bcrypt.hash(ADMIN_PASSWORD, 12),
      role: 'ADMIN',
      pin: ADMIN_PIN,
      businessId: business.id,
      phone: bizSettings.phone,
      planningMeta: ATMANE_PLANNING_META,
    },
  });

  // Équipe démo (Marco/Sophie/Lucas/Amine) : uniquement à la demande (SEED_DEMO_DATA=true).
  // seedPizzeriaStaff() upserte ces 4 comptes avec isActive: true à chaque appel — sur un
  // déploiement normal ça réactivait un compte désactivé à la main à chaque redeploy.
  if (process.env.SEED_DEMO_DATA === 'true') {
    console.log('👥 Employés opérationnels démo…');
    const bizCount = await seedStaffAllBusinesses(prisma);
    console.log(`   ${bizCount} établissement(s) — équipe seed OK (PIN non loggés)`);
  } else {
    console.log('👥 Équipe démo ignorée (SEED_DEMO_DATA≠true)');
  }
  await prisma.user.updateMany({
    where: { role: 'ADMIN', isActive: true },
    data: { shiftId: null },
  });

  await ensureSnapshotMenuItem(prisma, business.id);

  console.log('📦 Sync catalogue La Z Pizza → PostgreSQL…');
  await syncLazPizzaCatalog(prisma, business.id);
  // Zones de livraison : gérées dans l'admin (repli flyer dans delivery-quote) — non écrasées au seed.
  const modResult = await syncPizzaSizeModifiers(prisma, business.id);
  console.log(
    `   Modificateurs taille pizza : ${modResult.pizzas} pizzas, ${modResult.options} options`
  );
  const formulesResult = await syncMenuFormules(prisma, business.id);
  console.log(
    `   Formules menu : ${formulesResult.drinkModifiers} boissons, ${formulesResult.dessertModifiers} desserts`
  );

  for (let day = 0; day <= 6; day++) {
    const existing = await prisma.timeSlot.findFirst({
      where: { businessId: business.id, dayOfWeek: day },
    });
    if (existing) {
      await prisma.timeSlot.update({
        where: { id: existing.id },
        data: { startTime: '18:00', endTime: '22:00', capacity: 10, isActive: true },
      });
    } else {
      await prisma.timeSlot.create({
        data: {
          businessId: business.id,
          dayOfWeek: day,
          startTime: '18:00',
          endTime: '22:00',
          capacity: 10,
        },
      });
    }
  }

  // Stock / recettes / dépenses de DÉMO : uniquement à la demande (SEED_DEMO_DATA=true).
  // Sinon chaque déploiement injectait de faux articles et de fausses charges dans la prod/préprod
  // (et dans le tableau ventes vs dépenses).
  if (process.env.SEED_DEMO_DATA === 'true') {
    console.log('📦 Stock & dépenses pizzeria…');
    const stock = await seedPizzeriaStock(prisma, business.id);
    const expenses = await seedPizzeriaExpenses(prisma, business.id);
    console.log(
      `   Stock : ${stock.created} créés, ${stock.updated} mis à jour (${stock.total} articles)`
    );
    const recipes = await seedPizzeriaStockRecipes(prisma, business.id);
    console.log(`   Recettes BOM : ${recipes.recipes} lignes, ${recipes.linked} boissons liées`);
    console.log(
      expenses.skipped
        ? '   Dépenses démo déjà présentes — skip'
        : `   Dépenses : ${expenses.created} charges démo ajoutées`
    );
  } else {
    console.log('📦 Stock & dépenses démo ignorés (SEED_DEMO_DATA≠true)');
  }

  const menuCount = await prisma.menuCategory.count({
    where: { businessId: business.id, slug: { not: null } },
  });
  if (menuCount === 0) {
    console.warn('⚠️ Catalogue vide après sync — vérifier sync-lazpizza-catalog.ts');
  }

  console.log('✅ Seed La Z Pizza OK');
  await prisma.fiscalSequence.upsert({
    where: { businessId: business.id },
    create: {
      businessId: business.id,
      softwareVersion: process.env.FISCAL_SOFTWARE_VERSION ?? '1.0.0',
    },
    update: {},
  });
  console.log('📜 Séquence fiscale ISCA initialisée');
  console.log(
    `📧 Admin CRM créé : ${ADMIN_EMAIL} (mot de passe / PIN : voir seed local, jamais en log)`
  );
  console.log(`🏪 Business ID : ${business.id}`);
  console.log('💶 Montants en centimes EUR dans la base');
}

main()
  .catch(e => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
