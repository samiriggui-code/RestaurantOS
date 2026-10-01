/** Sync identité La Z Pizza → Business.settings + staff emails */
import { PrismaClient } from '@prisma/client';
import { lazPizzaDefaultBusinessSettings } from '../src/lib/laz-pizza-identity';
import { seedStaffAllBusinesses } from '../src/lib/seed-pizzeria-staff';
import { syncPizzeriaShifts } from '../src/lib/pizzeria-shifts';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const defaults = lazPizzaDefaultBusinessSettings();
  const businesses = await prisma.business.findMany({
    select: { id: true, name: true, settings: true },
  });

  for (const b of businesses) {
    const current =
      b.settings && typeof b.settings === 'object' ? (b.settings as Record<string, unknown>) : {};
    await prisma.business.update({
      where: { id: b.id },
      data: {
        settings: {
          ...current,
          ...defaults,
          planning: { ...(current.planning as object), ...defaults.planning },
        },
      },
    });
    await syncPizzeriaShifts(prisma, b.id);
    console.log(`✓ ${b.name} — settings + créneaux`);
  }

  const n = await seedStaffAllBusinesses(prisma);
  console.log(`✓ ${n} établissement(s) — staff @lazpizza.fr`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
