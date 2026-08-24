/**
 * Créneaux La Z Pizza — source métier (sync → table Prisma Shift).
 * Cuisine 16h · Caisse & livraison 18h · fermeture 22h · 7j/7.
 */

import type { PrismaClient } from '@prisma/client';
import { lazPizzaDefaultBusinessSettings } from './laz-pizza-identity';

export const PIZZERIA_SHIFT_DAYS = 127; // lun–dim (tous les jours)

export const PIZZERIA_PLANNING_DEFAULTS = {
  maxDaysPerWeek: 6,
  maxConsecutiveDays: 6,
  minRestDaysPerWeek: 1,
  kitchenStart: '16:00',
  serviceStart: '18:00',
  closeTime: '22:00',
} as const;

export const PIZZERIA_SHIFTS = [
  {
    slug: 'cuisine',
    name: 'Cuisine',
    startTime: '16:00',
    endTime: '22:00',
    days: PIZZERIA_SHIFT_DAYS,
    sortOrder: 1,
    roles: ['CHEF', 'MANAGER', 'ADMIN'] as const,
  },
  {
    slug: 'caisse',
    name: 'Caisse',
    startTime: '18:00',
    endTime: '22:00',
    days: PIZZERIA_SHIFT_DAYS,
    sortOrder: 2,
    roles: ['CASHIER', 'WAITER', 'MANAGER', 'ADMIN'] as const,
  },
  {
    slug: 'livraison',
    name: 'Livraison',
    startTime: '18:00',
    endTime: '22:00',
    days: PIZZERIA_SHIFT_DAYS,
    sortOrder: 3,
    roles: ['DRIVER', 'MANAGER', 'ADMIN'] as const,
  },
] as const;

export type PizzeriaShiftDef = (typeof PIZZERIA_SHIFTS)[number];

export type ShiftLike = {
  id: string;
  slug?: string | null;
  name: string;
  startTime: string;
  endTime: string;
  days: number;
  targetRoles?: unknown;
};

export const CANONICAL_SHIFT_SLUGS = PIZZERIA_SHIFTS.map(s => s.slug);
export const CANONICAL_SHIFT_NAMES = PIZZERIA_SHIFTS.map(s => s.name);
export const LEGACY_SHIFT_NAMES = ['Midi', 'Soir'] as const;

const ROLE_TO_SHIFT_SLUG: Record<string, string> = {
  CHEF: 'cuisine',
  MANAGER: 'caisse',
  ADMIN: 'caisse',
  CASHIER: 'caisse',
  WAITER: 'caisse',
  DRIVER: 'livraison',
};

/** Gérant — pas de créneau par défaut unique (polyvalent). */
const POLYVALENT_ROLES = new Set(['ADMIN', 'MANAGER']);

export function shiftSlugForRole(role: string): string | undefined {
  return ROLE_TO_SHIFT_SLUG[role];
}

export function shiftNameForRole(role: string): string | undefined {
  const slug = shiftSlugForRole(role);
  return PIZZERIA_SHIFTS.find(s => s.slug === slug)?.name;
}

export function getShiftForRole(role: string, shifts: ShiftLike[]): ShiftLike | undefined {
  const slug = shiftSlugForRole(role);
  if (slug) {
    const bySlug = shifts.find(s => s.slug === slug);
    if (bySlug) return bySlug;
  }
  const name = shiftNameForRole(role);
  if (name) return shifts.find(s => s.name === name);
  return shifts[0];
}

export function resolveEmployeeShiftId(
  role: string,
  shiftId: string | null,
  shifts: ShiftLike[]
): string | null {
  if (POLYVALENT_ROLES.has(role)) {
    if (shiftId && shifts.some(s => s.id === shiftId)) return shiftId;
    return null;
  }
  if (shiftId) {
    const current = shifts.find(s => s.id === shiftId);
    const expectedSlug = shiftSlugForRole(role);
    if (
      current &&
      (!expectedSlug || current.slug === expectedSlug || current.name === shiftNameForRole(role))
    ) {
      return shiftId;
    }
  }
  return getShiftForRole(role, shifts)?.id ?? shiftId;
}

/** Crée ou met à jour les 3 créneaux métier en BDD (Prisma Shift). */
export async function syncPizzeriaShifts(
  prisma: PrismaClient,
  businessId: string
): Promise<{ created: number; updated: number; deactivated: number }> {
  let created = 0;
  let updated = 0;

  for (const def of PIZZERIA_SHIFTS) {
    const existing = await prisma.shift.findFirst({
      where: { businessId, slug: def.slug },
    });
    const data = {
      name: def.name,
      slug: def.slug,
      startTime: def.startTime,
      endTime: def.endTime,
      days: def.days,
      sortOrder: def.sortOrder,
      targetRoles: [...def.roles],
      isActive: true,
    };
    if (existing) {
      await prisma.shift.update({ where: { id: existing.id }, data });
      updated++;
    } else {
      await prisma.shift.create({ data: { businessId, ...data } });
      created++;
    }
  }

  const activeShifts = await prisma.shift.findMany({
    where: { businessId, isActive: true, slug: { in: [...CANONICAL_SHIFT_SLUGS] } },
    select: { id: true, slug: true, name: true },
  });
  const bySlug = new Map(activeShifts.map(s => [s.slug!, s.id]));

  const obsolete = await prisma.shift.findMany({
    where: {
      businessId,
      OR: [{ slug: null }, { slug: { notIn: [...CANONICAL_SHIFT_SLUGS] } }],
    },
    select: { id: true },
  });
  if (obsolete.length) {
    const obsoleteIds = obsolete.map(s => s.id);
    const stuckUsers = await prisma.user.findMany({
      where: { businessId, shiftId: { in: obsoleteIds } },
      select: { id: true, role: true },
    });
    for (const u of stuckUsers) {
      const slug = shiftSlugForRole(u.role);
      const targetId = slug ? bySlug.get(slug) : undefined;
      if (targetId) await prisma.user.update({ where: { id: u.id }, data: { shiftId: targetId } });
    }
  }

  const deactivated = await prisma.shift.updateMany({
    where: {
      businessId,
      OR: [{ slug: null }, { slug: { notIn: [...CANONICAL_SHIFT_SLUGS] } }],
    },
    data: { isActive: false },
  });

  const business = await prisma.business.findUnique({ where: { id: businessId } });
  const settings =
    business?.settings && typeof business.settings === 'object'
      ? (business.settings as Record<string, unknown>)
      : {};
  await prisma.business.update({
    where: { id: businessId },
    data: {
      settings: {
        ...settings,
        ...lazPizzaDefaultBusinessSettings(),
        hours: { open: 18, close: 22, daysOpen: 7 },
        planning: {
          ...lazPizzaDefaultBusinessSettings().planning,
        },
      },
    },
  });

  return { created, updated, deactivated: deactivated.count };
}

/** Lie chaque employé actif au créneau Prisma correspondant à son rôle. */
export async function assignRoleDefaultShifts(
  prisma: PrismaClient,
  businessId: string
): Promise<number> {
  const shifts = await prisma.shift.findMany({
    where: { businessId, isActive: true, slug: { in: [...CANONICAL_SHIFT_SLUGS] } },
    select: { id: true, slug: true, targetRoles: true },
  });

  let assigned = 0;
  const POLYVALENT = new Set(['ADMIN', 'MANAGER']);
  for (const shift of shifts) {
    const roles = Array.isArray(shift.targetRoles) ? (shift.targetRoles as string[]) : [];
    for (const role of roles) {
      if (POLYVALENT.has(role)) continue;
      const result = await prisma.user.updateMany({
        where: { businessId, role, isActive: true },
        data: { shiftId: shift.id },
      });
      assigned += result.count;
    }
  }
  return assigned;
}
