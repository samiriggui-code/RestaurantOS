/** Postes planifiables — gérant polyvalent vs rôle fixe. */

export type PlanningPostSlot = 'CHEF' | 'CASHIER' | 'DRIVER'

export type PlanningPostOption = {
  shiftId: string
  roleLabel: string
  shortLabel: string
}

type ShiftRow = { id: string; name: string; slug?: string | null }

type StaffRow = {
  role: string
  shiftId?: string | null
  planningMeta?: unknown
}

const SLOT_LABEL: Record<PlanningPostSlot, string> = {
  CHEF: 'Cuisine',
  CASHIER: 'Caisse',
  DRIVER: 'Livreur',
}

const SLOT_SHIFT_SLUG: Record<PlanningPostSlot, string> = {
  CHEF: 'cuisine',
  CASHIER: 'caisse',
  DRIVER: 'livraison',
}

function parseMeta(raw: unknown): { canSubstitute?: string[] } {
  if (!raw || typeof raw !== 'object') return {}
  return raw as { canSubstitute?: string[] }
}

/** Créneaux qu'un employé peut tenir (clic planning). */
export function substituteSlotsForUser(user: StaffRow): PlanningPostSlot[] {
  if (user.role === 'ADMIN') return ['CHEF', 'CASHIER', 'DRIVER']
  if (user.role === 'MANAGER') {
    const subs = parseMeta(user.planningMeta).canSubstitute ?? ['CHEF', 'CASHIER', 'DRIVER']
    return subs.filter((s): s is PlanningPostSlot =>
      s === 'CHEF' || s === 'CASHIER' || s === 'DRIVER',
    )
  }
  if (user.role === 'CHEF') return ['CHEF']
  if (user.role === 'CASHIER' || user.role === 'WAITER') return ['CASHIER']
  if (user.role === 'DRIVER') return ['DRIVER']
  return []
}

export function planningPostsForEmployee(
  user: StaffRow,
  shifts: ShiftRow[],
): PlanningPostOption[] {
  const slots = substituteSlotsForUser(user)
  const options: PlanningPostOption[] = []

  for (const slot of slots) {
    const slug = SLOT_SHIFT_SLUG[slot]
    const shift =
      shifts.find((s) => s.slug === slug) ??
      shifts.find((s) => s.name.toLowerCase() === slug) ??
      (slots.length === 1 && user.shiftId ? shifts.find((s) => s.id === user.shiftId) : undefined)
    if (!shift) continue
    options.push({
      shiftId: shift.id,
      roleLabel: SLOT_LABEL[slot],
      shortLabel: shift.name,
    })
  }

  if (options.length === 0 && user.shiftId) {
    const shift = shifts.find((s) => s.id === user.shiftId)
    if (shift) {
      options.push({
        shiftId: shift.id,
        roleLabel: SLOT_LABEL[slots[0] ?? 'CASHIER'] ?? shift.name,
        shortLabel: shift.name,
      })
    }
  }

  return options
}

export function isPolyvalentEmployee(user: StaffRow): boolean {
  return substituteSlotsForUser(user).length > 1
}

/** Tooltip court — pas de liste de postes dans l’UI. */
export function polyvalentHint(user: StaffRow): string | null {
  return isPolyvalentEmployee(user) ? 'Clic pour changer de poste' : null
}
