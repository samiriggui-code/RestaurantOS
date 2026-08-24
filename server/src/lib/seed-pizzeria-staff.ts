import type { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { assignRoleDefaultShifts, syncPizzeriaShifts } from './pizzeria-shifts';
import { lazPizzaStaffEmail } from './laz-pizza-identity';

const STAFF_PASSWORD = 'staff123';

export type StaffPlanningMeta = {
  employmentType?: 'FULL_TIME' | 'PART_TIME';
  maxDaysPerWeek?: number;
  canSubstitute?: string[];
};

export type SeedStaffResult = {
  created: number;
  updated: number;
  pins: { name: string; role: string; pin: string; email: string }[];
};

/** Équipe opérationnelle — le gérant (ADMIN) est créé dans seed.ts */
const STAFF_TEMPLATE = [
  {
    prenom: 'marco',
    nom: 'cuisinier',
    name: 'Marco Cuisinier',
    role: 'CHEF',
    pin: '5678',
    phone: '06.00.00.02.02',
    planningMeta: { employmentType: 'FULL_TIME', maxDaysPerWeek: 6 } satisfies StaffPlanningMeta,
  },
  {
    prenom: 'sophie',
    nom: 'caissier',
    name: 'Sophie Caissier',
    role: 'CASHIER',
    pin: '1234',
    phone: '06.00.00.01.01',
    planningMeta: { employmentType: 'FULL_TIME', maxDaysPerWeek: 6 } satisfies StaffPlanningMeta,
  },
  {
    prenom: 'lucas',
    nom: 'livreur',
    name: 'Lucas Livreur',
    role: 'DRIVER',
    pin: '3456',
    phone: '06.00.00.03.03',
    planningMeta: { employmentType: 'FULL_TIME', maxDaysPerWeek: 6 } satisfies StaffPlanningMeta,
  },
  {
    prenom: 'amine',
    nom: 'livreur',
    name: 'Amine Livreur',
    role: 'DRIVER',
    pin: '7890',
    phone: '06.00.00.04.04',
    planningMeta: { employmentType: 'PART_TIME', maxDaysPerWeek: 3 } satisfies StaffPlanningMeta,
  },
] as const;

const LEGACY_STAFF_EMAILS = [
  'caisse@lazpizza.fr',
  'cuisine@lazpizza.fr',
  'livreur@lazpizza.fr',
  'admin@cafe.com',
];

/** Supprime définitivement les comptes legacy (emails @lazpizza.fr, admin@cafe.com). */
export async function purgeLegacyStaff(prisma: PrismaClient, businessId: string): Promise<number> {
  const legacy = await prisma.user.findMany({
    where: {
      businessId,
      OR: [{ email: { in: LEGACY_STAFF_EMAILS } }, { email: { endsWith: '@lazpizza.fr' } }],
    },
    select: { id: true, email: true },
  });

  for (const u of legacy) {
    await prisma.attendance.deleteMany({ where: { userId: u.id } });
    await prisma.order.updateMany({ where: { cashierId: u.id }, data: { cashierId: null } });
    await prisma.user.delete({ where: { id: u.id } });
  }

  return legacy.length;
}

/** @deprecated use purgeLegacyStaff */
export function deactivateLegacyStaff(
  prisma: PrismaClient,
  businessId: string
): ReturnType<typeof purgeLegacyStaff> {
  return purgeLegacyStaff(prisma, businessId);
}

/** Employés opérationnels — idempotent via upsert email. */
export async function seedPizzeriaStaff(
  prisma: PrismaClient,
  businessId: string
): Promise<SeedStaffResult> {
  const hashedPassword = await bcrypt.hash(STAFF_PASSWORD, 12);

  let created = 0;
  let updated = 0;
  const pins: SeedStaffResult['pins'] = [];

  for (const member of STAFF_TEMPLATE) {
    const email = lazPizzaStaffEmail(member.prenom, member.nom);
    const existing = await prisma.user.findUnique({ where: { email } });
    await prisma.user.upsert({
      where: { email },
      update: {
        businessId,
        name: member.name,
        role: member.role,
        pin: member.pin,
        phone: member.phone,
        isActive: true,
        planningMeta: member.planningMeta,
      },
      create: {
        businessId,
        name: member.name,
        email,
        password: hashedPassword,
        role: member.role,
        pin: member.pin,
        phone: member.phone,
        isActive: true,
        planningMeta: member.planningMeta,
      },
    });
    if (existing) updated++;
    else created++;
    pins.push({ name: member.name, role: member.role, pin: member.pin, email });
  }

  await purgeLegacyStaff(prisma, businessId);

  return { created, updated, pins };
}

/** @deprecated use syncPizzeriaShifts */
export async function seedPizzeriaShifts(
  prisma: PrismaClient,
  businessId: string
): Promise<{ created: number }> {
  const { created, updated } = await syncPizzeriaShifts(prisma, businessId);
  await assignRoleDefaultShifts(prisma, businessId);
  return { created: created + updated };
}

/** Seed staff + créneaux métier pour chaque établissement. */
export async function seedStaffAllBusinesses(prisma: PrismaClient): Promise<number> {
  const businesses = await prisma.business.findMany({ select: { id: true, name: true } });

  for (const biz of businesses) {
    await seedPizzeriaStaff(prisma, biz.id);
    await syncPizzeriaShifts(prisma, biz.id);
    await assignRoleDefaultShifts(prisma, biz.id);
  }

  return businesses.length;
}

export function parsePlanningMeta(raw: unknown): StaffPlanningMeta {
  if (!raw || typeof raw !== 'object') return {};
  return raw as StaffPlanningMeta;
}

export function isPlanningParticipant(user: { role: string; planningMeta?: unknown }): boolean {
  if (user.role !== 'ADMIN') return true;
  const meta = parsePlanningMeta(user.planningMeta);
  return (meta.canSubstitute?.length ?? 0) > 0;
}

export function maxDaysForStaff(
  planningMeta: unknown,
  role: string,
  defaults: {
    maxDaysPerWeek: number;
    fullTimeDriverMaxDays?: number;
    partTimeDriverMaxDays?: number;
  }
): number {
  const meta = parsePlanningMeta(planningMeta);
  if (meta.maxDaysPerWeek != null) return meta.maxDaysPerWeek;
  if (role === 'DRIVER') {
    if (meta.employmentType === 'PART_TIME') return defaults.partTimeDriverMaxDays ?? 3;
    if (meta.employmentType === 'FULL_TIME') return defaults.fullTimeDriverMaxDays ?? 6;
  }
  return defaults.maxDaysPerWeek;
}
