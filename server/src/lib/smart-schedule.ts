/**
 * Planification intelligente — garde-fous couverture rôle, repos, équité.
 * Règles repos lues depuis Business.settings.planning (Prisma) avec repli sur défauts La Z Pizza.
 */

import type { BusinessSettingsJson } from './business-settings';
import { maxDaysForStaff, parsePlanningMeta, isPlanningParticipant } from './seed-pizzeria-staff';
import {
  PIZZERIA_PLANNING_DEFAULTS,
  resolveEmployeeShiftId,
  type ShiftLike,
} from './pizzeria-shifts';

export const PLANNING_ROLE_LABEL: Record<string, string> = {
  CHEF: 'Cuisine',
  DRIVER: 'Livreur',
  CASHIER: 'Caisse',
  WAITER: 'Salle',
  MANAGER: 'Manager',
  ADMIN: 'Gérant',
};

export type SmartShift = {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  days: number;
};

export type SmartEmployee = {
  id: string;
  name: string;
  role: string;
  shiftId: string | null;
  planningMeta?: unknown;
};

export type SmartEntry = {
  userId: string;
  date: string;
  shiftId: string | null;
  roleLabel?: string | null;
};

export type ProposedAssignment = {
  userId: string;
  date: string;
  shiftId: string;
  roleLabel: string;
  reason: 'default' | 'coverage' | 'equity_rest';
};

export type GuardrailIssue = {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  date?: string;
  message: string;
  suggestion?: string;
};

export type ScheduleSuggestion = {
  id: string;
  priority: 'high' | 'medium' | 'low';
  message: string;
  action?: {
    userId: string;
    date: string;
    shiftId: string;
    roleLabel: string;
  };
};

export type SmartScheduleResult = {
  from: string;
  to: string;
  proposed: ProposedAssignment[];
  skippedExisting: number;
  restDays: { userId: string; date: string; reason: string }[];
  issues: GuardrailIssue[];
  suggestions: ScheduleSuggestion[];
  score: number;
  summary: string;
};

export type ScheduleGuardrails = {
  maxDaysPerWeek: number;
  maxConsecutiveDays: number;
  minRestDaysPerWeek: number;
  fullTimeDriverMaxDays: number;
  partTimeDriverMaxDays: number;
  coverage: {
    CHEF: { min: number; roles: readonly string[] };
    FRONT: { min: number; roles: readonly string[] };
    DRIVER: { min: number; max: number; roles: readonly string[]; peakDays: readonly number[] };
  };
  planning?: BusinessSettingsJson['planning'];
};

export const SCHEDULE_GUARDRAILS: ScheduleGuardrails = {
  maxDaysPerWeek: PIZZERIA_PLANNING_DEFAULTS.maxDaysPerWeek,
  maxConsecutiveDays: PIZZERIA_PLANNING_DEFAULTS.maxConsecutiveDays,
  minRestDaysPerWeek: PIZZERIA_PLANNING_DEFAULTS.minRestDaysPerWeek,
  fullTimeDriverMaxDays: 6,
  partTimeDriverMaxDays: 3,
  coverage: {
    CHEF: { min: 1, roles: ['CHEF', 'MANAGER'] },
    FRONT: { min: 1, roles: ['CASHIER', 'WAITER', 'MANAGER'] },
    DRIVER: { min: 1, max: 2, roles: ['DRIVER'], peakDays: [4, 5, 6] },
  },
};

/** Fusionne Business.settings.planning (BDD) avec les défauts métier. */
export function resolveScheduleGuardrails(
  planning?: BusinessSettingsJson['planning']
): ScheduleGuardrails {
  const inHouseDriverDays = planning?.inHouseDriverDays ?? [4, 5, 6];
  return {
    maxDaysPerWeek: planning?.maxDaysPerWeek ?? SCHEDULE_GUARDRAILS.maxDaysPerWeek,
    maxConsecutiveDays: planning?.maxConsecutiveDays ?? SCHEDULE_GUARDRAILS.maxConsecutiveDays,
    minRestDaysPerWeek: planning?.minRestDaysPerWeek ?? SCHEDULE_GUARDRAILS.minRestDaysPerWeek,
    fullTimeDriverMaxDays: planning?.fullTimeDriverMaxDays ?? 6,
    partTimeDriverMaxDays: planning?.partTimeDriverMaxDays ?? 3,
    coverage: {
      CHEF: { min: 1, roles: ['CHEF', 'MANAGER'] },
      FRONT: { min: 1, roles: ['CASHIER', 'WAITER', 'MANAGER'] },
      DRIVER: { min: 1, max: 2, roles: ['DRIVER'], peakDays: inHouseDriverDays },
    },
    planning,
  };
}

type GridCell = { shiftId: string; roleLabel: string } | null;

const KITCHEN_ROLE_LABELS = ['Cuisine', 'Chef', 'Pizzaïolo'];
const FRONT_ROLE_LABELS = ['Caisse', 'Salle'];
const DRIVER_ROLE_LABELS = ['Livreur', 'Livraison'];

function shiftIdForSlug(shifts: ShiftLike[], slug: string): string | undefined {
  return shifts.find(s => s.slug === slug)?.id;
}

function employeeMaxDays(emp: SmartEmployee, guardrails: ScheduleGuardrails): number {
  return maxDaysForStaff(emp.planningMeta, emp.role, {
    maxDaysPerWeek: guardrails.maxDaysPerWeek,
    fullTimeDriverMaxDays: guardrails.fullTimeDriverMaxDays,
    partTimeDriverMaxDays: guardrails.partTimeDriverMaxDays,
  });
}

function isManagerLike(emp: SmartEmployee): boolean {
  return emp.role === 'MANAGER' || emp.role === 'ADMIN';
}

/** Gérant polyvalent — planifiable cuisine / caisse / livraison sans créneau par défaut. */
function isPolyvalentManager(emp: SmartEmployee): boolean {
  if (!isManagerLike(emp)) return false;
  if (emp.role === 'ADMIN') return true;
  return (parsePlanningMeta(emp.planningMeta).canSubstitute?.length ?? 0) > 0;
}

function includedInTeamPlan(emp: SmartEmployee, shifts: ShiftLike[]): boolean {
  if (!isPlanningParticipant(emp)) return false;
  if (isPolyvalentManager(emp)) return true;
  return Boolean(resolveEmployeeShiftId(emp.role, emp.shiftId, shifts));
}

function cellCoversKitchen(emp: SmartEmployee, cell: GridCell): boolean {
  if (!cell?.shiftId) return false;
  if (emp.role === 'CHEF') return true;
  if (isManagerLike(emp)) {
    const label = cell.roleLabel ?? '';
    return KITCHEN_ROLE_LABELS.some(l => label.includes(l));
  }
  return false;
}

function cellCoversFront(emp: SmartEmployee, cell: GridCell): boolean {
  if (!cell?.shiftId) return false;
  if (emp.role === 'CASHIER' || emp.role === 'WAITER') return true;
  if (isManagerLike(emp)) {
    const label = cell.roleLabel ?? '';
    return FRONT_ROLE_LABELS.some(l => label.includes(l));
  }
  return false;
}

function cellCoversDriver(emp: SmartEmployee, cell: GridCell): boolean {
  if (!cell?.shiftId) return false;
  if (emp.role === 'DRIVER') return true;
  if (isManagerLike(emp)) {
    const label = cell.roleLabel ?? '';
    return DRIVER_ROLE_LABELS.some(l => label.includes(l));
  }
  return false;
}

function countDriverOnDate(
  date: string,
  employees: SmartEmployee[],
  grid: Map<string, Map<string, GridCell>>
): number {
  let n = 0;
  for (const emp of employees) {
    if (cellCoversDriver(emp, grid.get(emp.id)?.get(date) ?? null)) n++;
  }
  return n;
}

function proposedHasPost(proposed: ProposedAssignment[], date: string, label: string): boolean {
  return proposed.some(p => p.date === date && p.roleLabel === label);
}

function countKitchenOnDate(
  date: string,
  employees: SmartEmployee[],
  grid: Map<string, Map<string, GridCell>>
): number {
  let n = 0;
  for (const emp of employees) {
    if (cellCoversKitchen(emp, grid.get(emp.id)?.get(date) ?? null)) n++;
  }
  return n;
}

function countFrontOnDate(
  date: string,
  employees: SmartEmployee[],
  grid: Map<string, Map<string, GridCell>>
): number {
  let n = 0;
  for (const emp of employees) {
    if (cellCoversFront(emp, grid.get(emp.id)?.get(date) ?? null)) n++;
  }
  return n;
}

export function datesBetween(from: string, to: string): string[] {
  const out: string[] = [];
  const cursor = new Date(`${from}T12:00:00`);
  const end = new Date(`${to}T12:00:00`);
  while (cursor <= end) {
    out.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

export function isoDayIndex(iso: string): number {
  const js = new Date(`${iso}T12:00:00`).getDay();
  return js === 0 ? 6 : js - 1;
}

export function shiftAppliesOnDate(shift: SmartShift, date: string): boolean {
  return (shift.days & (1 << isoDayIndex(date))) !== 0;
}

function rolePlanningLabel(role: string): string {
  return PLANNING_ROLE_LABEL[role] ?? role;
}

function isPeakDay(date: string, guardrails: ScheduleGuardrails): boolean {
  return guardrails.coverage.DRIVER.peakDays.includes(isoDayIndex(date));
}

function buildGrid(
  dates: string[],
  employees: SmartEmployee[],
  existing: SmartEntry[],
  proposed: ProposedAssignment[]
): Map<string, Map<string, GridCell>> {
  const grid = new Map<string, Map<string, GridCell>>();
  for (const emp of employees) grid.set(emp.id, new Map());
  for (const e of existing) {
    if (!e.shiftId) continue;
    grid.get(e.userId)?.set(e.date, {
      shiftId: e.shiftId,
      roleLabel:
        e.roleLabel ?? rolePlanningLabel(employees.find(x => x.id === e.userId)?.role ?? ''),
    });
  }
  for (const p of proposed) {
    grid.get(p.userId)?.set(p.date, { shiftId: p.shiftId, roleLabel: p.roleLabel });
  }
  return grid;
}

function countWorkDays(
  userId: string,
  dates: string[],
  grid: Map<string, Map<string, GridCell>>
): number {
  const row = grid.get(userId);
  if (!row) return 0;
  return dates.filter(d => row.get(d)?.shiftId).length;
}

function formatDateFr(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
  });
}

type PostSlot = 'CHEF' | 'CASHIER' | 'DRIVER';

const POST_SHIFT_SLUG: Record<PostSlot, string> = {
  CHEF: 'cuisine',
  CASHIER: 'caisse',
  DRIVER: 'livraison',
};

function isPartTimeDriver(emp: SmartEmployee): boolean {
  return (
    emp.role === 'DRIVER' && parsePlanningMeta(emp.planningMeta).employmentType === 'PART_TIME'
  );
}

function isFullTimeDriver(emp: SmartEmployee): boolean {
  return (
    emp.role === 'DRIVER' &&
    (parsePlanningMeta(emp.planningMeta).employmentType === 'FULL_TIME' ||
      !parsePlanningMeta(emp.planningMeta).employmentType)
  );
}

/** Lucas lun–ven · Amine ven (2e) + sam–dim. */
function driverMayWorkOn(emp: SmartEmployee, dow: number): boolean {
  if (emp.role !== 'DRIVER') return false;
  if (isPartTimeDriver(emp)) return dow >= 4;
  if (isFullTimeDriver(emp)) return dow <= 4;
  return true;
}

function driverMaxDays(emp: SmartEmployee): number {
  if (isPartTimeDriver(emp)) return 3;
  if (isFullTimeDriver(emp)) return 6;
  return 6;
}

function managerCanSubstitute(emp: SmartEmployee, slot: PostSlot): boolean {
  if (!isManagerLike(emp)) return false;
  if (emp.role === 'ADMIN') return true;
  return parsePlanningMeta(emp.planningMeta).canSubstitute?.includes(slot) ?? false;
}

function canCoverPost(emp: SmartEmployee, slot: PostSlot): boolean {
  if (slot === 'CHEF' && emp.role === 'CHEF') return true;
  if (slot === 'CASHIER' && (emp.role === 'CASHIER' || emp.role === 'WAITER')) return true;
  if (slot === 'DRIVER' && emp.role === 'DRIVER') return true;
  return managerCanSubstitute(emp, slot);
}

function isOnRest(userId: string, date: string, grid: Map<string, Map<string, GridCell>>): boolean {
  return !grid.get(userId)?.get(date)?.shiftId;
}

function countPostOnDate(
  slot: PostSlot,
  date: string,
  employees: SmartEmployee[],
  grid: Map<string, Map<string, GridCell>>
): number {
  if (slot === 'CHEF') return countKitchenOnDate(date, employees, grid);
  if (slot === 'CASHIER') return countFrontOnDate(date, employees, grid);
  return countDriverOnDate(date, employees, grid);
}

function primaryForPost(slot: PostSlot, employees: SmartEmployee[]): SmartEmployee | undefined {
  if (slot === 'CHEF') return employees.find(e => e.role === 'CHEF');
  if (slot === 'CASHIER') return employees.find(e => e.role === 'CASHIER');
  const ft = employees.find(
    e =>
      e.role === 'DRIVER' &&
      (parsePlanningMeta(e.planningMeta).employmentType === 'FULL_TIME' ||
        !parsePlanningMeta(e.planningMeta).employmentType)
  );
  const pt = employees.find(
    e => e.role === 'DRIVER' && parsePlanningMeta(e.planningMeta).employmentType === 'PART_TIME'
  );
  return ft ?? pt;
}

/** Remplaçant : collègue au repos, titulaire, ou gérant polyvalent (même en repos). */
function findReplacementForPost(
  slot: PostSlot,
  date: string,
  employees: SmartEmployee[],
  dates: string[],
  grid: Map<string, Map<string, GridCell>>
): { emp: SmartEmployee; viaRest: boolean } | null {
  const primary = primaryForPost(slot, employees);
  const pool: SmartEmployee[] = [];

  for (const e of employees) {
    if (!canCoverPost(e, slot)) continue;
    if (!isOnRest(e.id, date, grid)) continue;
    if (e.id === primary?.id) continue;
    if (slot === 'DRIVER' && !driverMayWorkOn(e, isoDayIndex(date))) continue;
    pool.push(e);
  }

  if (primary && isOnRest(primary.id, date, grid)) {
    pool.unshift(primary);
  }

  const manager = employees.find(e => isPolyvalentManager(e) && managerCanSubstitute(e, slot));
  if (manager && isOnRest(manager.id, date, grid) && !pool.some(e => e.id === manager.id)) {
    pool.push(manager);
  }

  if (!pool.length) {
    if (manager && managerCanSubstitute(manager, slot)) {
      return { emp: manager, viaRest: isOnRest(manager.id, date, grid) };
    }
    return null;
  }

  pool.sort((a, b) => countWorkDays(a.id, dates, grid) - countWorkDays(b.id, dates, grid));
  const pick = pool[0]!;
  return { emp: pick, viaRest: true };
}

function suggestPostCoverage(
  slot: PostSlot,
  date: string,
  employees: SmartEmployee[],
  dates: string[],
  shifts: SmartShift[],
  grid: Map<string, Map<string, GridCell>>,
  severity: GuardrailIssue['severity'],
  penalty: number
): { issue?: GuardrailIssue; suggestion?: ScheduleSuggestion; penalty: number } {
  const shiftId = shiftIdForSlug(shifts, POST_SHIFT_SLUG[slot]);
  if (!shiftId) return { penalty };

  const label = rolePlanningLabel(slot);
  const count = countPostOnDate(slot, date, employees, grid);
  const primary = primaryForPost(slot, employees);
  let extraPenalty = 0;

  if (count >= 1) return { penalty };

  extraPenalty = severity === 'critical' ? 30 : 20;
  const postName = slot === 'CHEF' ? 'cuisine' : slot === 'CASHIER' ? 'caisse' : 'livraison';
  const issue: GuardrailIssue = {
    id: `no-${postName}-${date}`,
    severity,
    date,
    message: `${formatDateFr(date)} : poste ${postName} non couvert.`,
    suggestion:
      slot === 'DRIVER'
        ? 'Planifiez Lucas (lun–ven) ou Amine (sam–dim), ou le gérant en livraison.'
        : `Planifiez le titulaire ou le gérant en ${postName}.`,
  };

  const replacement = findReplacementForPost(slot, date, employees, dates, grid);
  if (!replacement) return { issue, penalty: penalty + extraPenalty };

  const viaLabel = replacement.viaRest ? ' (repos)' : '';
  const primaryNote =
    primary && isOnRest(primary.id, date, grid) ? ` — ${primary.name.split(' ')[0]} absent` : '';

  const suggestion: ScheduleSuggestion = {
    id: `fix-${postName}-${replacement.emp.id}-${date}`,
    priority: severity === 'critical' ? 'high' : 'medium',
    message: `${replacement.emp.name.split(' ')[0]}${viaLabel} → ${label}${primaryNote} (${formatDateFr(date)})`,
    action: {
      userId: replacement.emp.id,
      date,
      shiftId,
      roleLabel: label,
    },
  };

  return { issue, suggestion, penalty: penalty + extraPenalty };
}

export function analyzeSchedule(input: {
  from: string;
  to: string;
  employees: SmartEmployee[];
  shifts: SmartShift[];
  existing: SmartEntry[];
  proposed?: ProposedAssignment[];
  guardrails?: ScheduleGuardrails;
}): { issues: GuardrailIssue[]; suggestions: ScheduleSuggestion[]; score: number } {
  const guardrails = input.guardrails ?? SCHEDULE_GUARDRAILS;
  const dates = datesBetween(input.from, input.to);
  const grid = buildGrid(dates, input.employees, input.existing, input.proposed ?? []);

  const issues: GuardrailIssue[] = [];
  const suggestions: ScheduleSuggestion[] = [];
  let penalty = 0;

  for (const emp of input.employees) {
    const days = countWorkDays(emp.id, dates, grid);
    const maxDays = employeeMaxDays(emp, guardrails);
    if (days > maxDays) {
      penalty += 15;
      issues.push({
        id: `overwork-${emp.id}`,
        severity: 'warning',
        message: `${emp.name} : ${days} jours planifiés (max ${maxDays} recommandé).`,
        suggestion: `Accordez au moins ${guardrails.minRestDaysPerWeek} jour de repos.`,
      });
    }
    if (days === 7) {
      penalty += 25;
      issues.push({
        id: `no-rest-${emp.id}`,
        severity: 'critical',
        message: `${emp.name} : aucun repos sur la semaine.`,
        suggestion: 'Bloquez un jour off (lundi ou mardi conseillé).',
      });
    }
  }

  for (const date of dates) {
    const anyService = input.employees.some(e => grid.get(e.id)?.get(date)?.shiftId);
    if (!anyService) continue;

    for (const slot of ['CHEF', 'CASHIER', 'DRIVER'] as const) {
      const sev = slot === 'DRIVER' ? 'warning' : slot === 'CHEF' ? 'critical' : 'warning';
      const result = suggestPostCoverage(
        slot,
        date,
        input.employees,
        dates,
        input.shifts,
        grid,
        sev,
        penalty
      );
      if (result.issue) issues.push(result.issue);
      if (result.suggestion) suggestions.push(result.suggestion);
      penalty = result.penalty;
    }

    const driverCount = countDriverOnDate(date, input.employees, grid);
    const driverMax = guardrails.coverage.DRIVER.max;
    if (isPeakDay(date, guardrails) && driverCount >= 1 && driverCount < driverMax) {
      const livraisonShiftId = shiftIdForSlug(input.shifts, 'livraison');
      const second = input.employees.find(e => {
        if (!canCoverPost(e, 'DRIVER')) return false;
        if (!isOnRest(e.id, date, grid)) return false;
        if (!driverMayWorkOn(e, isoDayIndex(date))) return false;
        return !cellCoversDriver(e, grid.get(e.id)?.get(date) ?? null);
      });
      if (second && livraisonShiftId) {
        suggestions.push({
          id: `fix-driver-2-${second.id}-${date}`,
          priority: 'medium',
          message: `2e livreur : ${second.name.split(' ')[0]} (${formatDateFr(date)})`,
          action: {
            userId: second.id,
            date,
            shiftId: livraisonShiftId,
            roleLabel: rolePlanningLabel('DRIVER'),
          },
        });
      }
    }
  }

  return { issues, suggestions, score: Math.max(0, Math.min(100, 100 - penalty)) };
}

/** Planning La Z Pizza — règles métier explicites du gérant. */
function buildLazPizzaTeamPlan(input: {
  dates: string[];
  employees: SmartEmployee[];
  cuisineShiftId: string | undefined;
  caisseShiftId: string | undefined;
  livraisonShiftId: string | undefined;
}): { proposed: ProposedAssignment[]; restDays: SmartScheduleResult['restDays'] } {
  const { dates, employees, cuisineShiftId, caisseShiftId, livraisonShiftId } = input;
  const proposed: ProposedAssignment[] = [];
  const restDays: SmartScheduleResult['restDays'] = [];

  const chef = employees.find(e => e.role === 'CHEF');
  const cashier = employees.find(e => e.role === 'CASHIER');
  const manager = employees.find(
    e =>
      isManagerLike(e) &&
      (managerCanSubstitute(e, 'CHEF') ||
        managerCanSubstitute(e, 'CASHIER') ||
        managerCanSubstitute(e, 'DRIVER'))
  );
  const driverFt = employees.find(
    e =>
      e.role === 'DRIVER' &&
      (parsePlanningMeta(e.planningMeta).employmentType === 'FULL_TIME' ||
        !parsePlanningMeta(e.planningMeta).employmentType)
  );
  const driverPt = employees.find(
    e => e.role === 'DRIVER' && parsePlanningMeta(e.planningMeta).employmentType === 'PART_TIME'
  );

  /** Repos : Marco mardi, Sophie mercredi · Lucas sam–dim · Amine lun–jeu. */
  const marcoRest = dates.find(d => isoDayIndex(d) === 1);
  const sophieRest = dates.find(d => isoDayIndex(d) === 2);
  if (chef && marcoRest)
    restDays.push({ userId: chef.id, date: marcoRest, reason: 'Repos hebdomadaire' });
  if (cashier && sophieRest)
    restDays.push({ userId: cashier.id, date: sophieRest, reason: 'Repos hebdomadaire' });
  for (const d of dates) {
    const dow = isoDayIndex(d);
    if (driverFt && dow >= 5) {
      restDays.push({ userId: driverFt.id, date: d, reason: 'Repos — livreur lun–ven' });
    }
    if (driverPt && dow <= 3) {
      restDays.push({ userId: driverPt.id, date: d, reason: 'Repos — livreur sam–dim' });
    }
  }

  function countFor(empId: string): number {
    return proposed.filter(p => p.userId === empId).length;
  }

  function assign(
    emp: SmartEmployee,
    date: string,
    shiftId: string,
    roleLabel: string,
    reason: ProposedAssignment['reason']
  ): void {
    if (proposed.some(p => p.userId === emp.id && p.date === date)) return;
    const dow = isoDayIndex(date);
    if (emp.role === 'DRIVER') {
      if (!driverMayWorkOn(emp, dow)) return;
      if (countFor(emp.id) >= driverMaxDays(emp)) return;
    }
    proposed.push({ userId: emp.id, date, shiftId, roleLabel, reason });
  }

  for (const date of dates) {
    const dow = isoDayIndex(date);
    const isSunday = dow === 6;

    if (cuisineShiftId) {
      if (date === marcoRest && manager && !isSunday) {
        assign(manager, date, cuisineShiftId, rolePlanningLabel('CHEF'), 'coverage');
      } else if (chef && date !== marcoRest) {
        assign(chef, date, cuisineShiftId, rolePlanningLabel('CHEF'), 'default');
      }
    }

    if (caisseShiftId) {
      if (date === sophieRest && manager && !isSunday) {
        assign(manager, date, caisseShiftId, rolePlanningLabel('CASHIER'), 'coverage');
      } else if (cashier && date !== sophieRest) {
        assign(cashier, date, caisseShiftId, rolePlanningLabel('CASHIER'), 'default');
      }
    }

    if (livraisonShiftId) {
      /** Lucas = livreur lun–ven (max 6 j). */
      if (driverFt && dow <= 4) {
        assign(driverFt, date, livraisonShiftId, rolePlanningLabel('DRIVER'), 'default');
      }
      /** Amine = livreur sam–dim (max 3 j). */
      if (driverPt && dow >= 5) {
        assign(driverPt, date, livraisonShiftId, rolePlanningLabel('DRIVER'), 'default');
      }
      /** Vendredi : 2 livreurs (Lucas + Amine renfort). */
      if (dow === 4 && driverFt && driverPt) {
        const ftOn = proposed.some(p => p.userId === driverFt.id && p.date === date);
        const ptOn = proposed.some(p => p.userId === driverPt.id && p.date === date);
        if (ftOn && !ptOn) {
          assign(driverPt, date, livraisonShiftId, rolePlanningLabel('DRIVER'), 'coverage');
        }
      }
    }

    /** Combler les trous : 1 cuisine + 1 caisse + 1 livreur — gérant en renfort (priorité cuisine). */
    if (manager && !isSunday && !proposed.some(p => p.userId === manager.id && p.date === date)) {
      const chefLabel = rolePlanningLabel('CHEF');
      const caisseLabel = rolePlanningLabel('CASHIER');
      const driverLabel = rolePlanningLabel('DRIVER');

      if (
        cuisineShiftId &&
        !proposedHasPost(proposed, date, chefLabel) &&
        managerCanSubstitute(manager, 'CHEF')
      ) {
        assign(manager, date, cuisineShiftId, chefLabel, 'coverage');
      } else if (
        caisseShiftId &&
        !proposedHasPost(proposed, date, caisseLabel) &&
        managerCanSubstitute(manager, 'CASHIER')
      ) {
        assign(manager, date, caisseShiftId, caisseLabel, 'coverage');
      } else if (
        livraisonShiftId &&
        !proposedHasPost(proposed, date, driverLabel) &&
        managerCanSubstitute(manager, 'DRIVER')
      ) {
        assign(manager, date, livraisonShiftId, driverLabel, 'coverage');
      }
    }
  }

  return { proposed, restDays };
}

export function buildSmartSchedulePlan(input: {
  from: string;
  to: string;
  employees: SmartEmployee[];
  shifts: SmartShift[];
  existing: SmartEntry[];
  userId?: string;
  guardrails?: ScheduleGuardrails;
}): SmartScheduleResult {
  const guardrails = input.guardrails ?? SCHEDULE_GUARDRAILS;
  const dates = datesBetween(input.from, input.to);
  const cuisineShiftId = shiftIdForSlug(input.shifts, 'cuisine');
  const caisseShiftId = shiftIdForSlug(input.shifts, 'caisse');
  const livraisonShiftId = shiftIdForSlug(input.shifts, 'livraison');
  const skippedExisting = input.existing.length;

  if (!input.userId) {
    const staff = input.employees.filter(e => includedInTeamPlan(e, input.shifts));
    const { proposed, restDays } = buildLazPizzaTeamPlan({
      dates,
      employees: staff,
      cuisineShiftId,
      caisseShiftId,
      livraisonShiftId,
    });

    const analysis = analyzeSchedule({
      from: input.from,
      to: input.to,
      employees: input.employees,
      shifts: input.shifts,
      existing: input.existing,
      proposed,
      guardrails,
    });

    return {
      from: input.from,
      to: input.to,
      proposed,
      skippedExisting,
      restDays,
      issues: analysis.issues,
      suggestions: analysis.suggestions,
      score: analysis.score,
      summary:
        'Planning La Z Pizza — Lucas lun–ven, Amine sam–dim, Atmane cuisine/caisse/livraison (lun–sam), repos Marco & Sophie.',
    };
  }

  const emp = input.employees.find(e => e.id === input.userId);
  const proposed: ProposedAssignment[] = [];
  const shiftId = emp ? resolveEmployeeShiftId(emp.role, emp.shiftId, input.shifts) : null;
  if (emp && shiftId) {
    for (const date of dates) {
      proposed.push({
        userId: emp.id,
        date,
        shiftId,
        roleLabel: rolePlanningLabel(emp.role),
        reason: 'default',
      });
    }
  }

  const analysis = analyzeSchedule({
    from: input.from,
    to: input.to,
    employees: input.employees,
    shifts: input.shifts,
    existing: input.existing,
    proposed,
    guardrails,
  });

  return {
    from: input.from,
    to: input.to,
    proposed,
    skippedExisting,
    restDays: [],
    issues: analysis.issues,
    suggestions: analysis.suggestions,
    score: analysis.score,
    summary: 'Prévisualisation employé',
  };
}

export type ScheduleGuardrailViolation = { code: string; message: string };

/**
 * Vérifie qu'assigner (ou retirer) un employé sur une date ne viole pas les garde-fous
 * (max jours/semaine, max jours consécutifs) — appelé à l'écriture manuelle
 * (PUT /employees/schedule), contrairement à analyzeSchedule qui n'audite qu'a posteriori
 * sur toute une grille déjà posée.
 */
export function checkScheduleWriteGuardrails(params: {
  employee: { role: string; planningMeta?: unknown };
  date: string;
  isWorkingDay: boolean;
  /** Dates (YYYY-MM-DD) déjà travaillées par cet employé, hors `date`, dans une fenêtre ±7j. */
  otherWorkedDates: string[];
  guardrails: ScheduleGuardrails;
}): ScheduleGuardrailViolation[] {
  if (!params.isWorkingDay) return [];

  const violations: ScheduleGuardrailViolation[] = [];
  const workedDates = new Set(params.otherWorkedDates);
  workedDates.add(params.date);

  const dayIdx = isoDayIndex(params.date);
  const monday = new Date(`${params.date}T12:00:00`);
  monday.setDate(monday.getDate() - dayIdx);
  let daysThisWeek = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    if (workedDates.has(d.toISOString().slice(0, 10))) daysThisWeek++;
  }

  const maxDays = maxDaysForStaff(params.employee.planningMeta, params.employee.role, {
    maxDaysPerWeek: params.guardrails.maxDaysPerWeek,
    fullTimeDriverMaxDays: params.guardrails.fullTimeDriverMaxDays,
    partTimeDriverMaxDays: params.guardrails.partTimeDriverMaxDays,
  });
  const effectiveMax = Math.min(maxDays, 7 - params.guardrails.minRestDaysPerWeek);
  if (daysThisWeek > effectiveMax) {
    violations.push({
      code: 'MAX_DAYS_PER_WEEK',
      message: `${daysThisWeek} jours travaillés cette semaine — maximum ${effectiveMax} (repos minimum ${params.guardrails.minRestDaysPerWeek} j/semaine).`,
    });
  }

  let consecutive = 1;
  const back = new Date(`${params.date}T12:00:00`);
  for (;;) {
    back.setDate(back.getDate() - 1);
    if (!workedDates.has(back.toISOString().slice(0, 10))) break;
    consecutive++;
  }
  const fwd = new Date(`${params.date}T12:00:00`);
  for (;;) {
    fwd.setDate(fwd.getDate() + 1);
    if (!workedDates.has(fwd.toISOString().slice(0, 10))) break;
    consecutive++;
  }
  if (consecutive > params.guardrails.maxConsecutiveDays) {
    violations.push({
      code: 'MAX_CONSECUTIVE_DAYS',
      message: `${consecutive} jours consécutifs travaillés — maximum ${params.guardrails.maxConsecutiveDays}.`,
    });
  }

  return violations;
}
