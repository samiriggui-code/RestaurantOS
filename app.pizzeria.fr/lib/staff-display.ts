import { ROLE_LABEL } from '@/lib/roles'

export type ShiftSummary = {
  id: string
  name: string
  startTime: string
  endTime: string
}

export type StaffMember = {
  id: string
  name: string
  email: string
  phone?: string | null
  role: string
  isActive: boolean
  shiftId?: string | null
  shift?: ShiftSummary | null
}

export const ROLE_STYLE: Record<string, { badge: string; dot: string }> = {
  ADMIN: { badge: 'bg-violet-500/15 text-violet-200 ring-violet-500/25', dot: 'bg-violet-400' },
  MANAGER: { badge: 'bg-indigo-500/15 text-indigo-200 ring-indigo-500/25', dot: 'bg-indigo-400' },
  CHEF: { badge: 'bg-orange-500/15 text-orange-200 ring-orange-500/25', dot: 'bg-orange-400' },
  DRIVER: { badge: 'bg-sky-500/15 text-sky-200 ring-sky-500/25', dot: 'bg-sky-400' },
  CASHIER: { badge: 'bg-emerald-500/15 text-emerald-200 ring-emerald-500/25', dot: 'bg-emerald-400' },
  WAITER: { badge: 'bg-amber-500/15 text-amber-200 ring-amber-500/25', dot: 'bg-amber-400' },
}

export function roleLabel(role: string): string {
  return ROLE_LABEL[role] ?? role
}

export function roleStyle(role: string) {
  return ROLE_STYLE[role] ?? { badge: 'bg-white/10 text-cream/70 ring-white/15', dot: 'bg-cream/40' }
}

export function staffInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return (parts[0]?.slice(0, 2) ?? '?').toUpperCase()
}

export function defaultRoleLabelForPlanning(role: string): string {
  return roleLabel(role)
}

export function shiftTimeLabel(shift?: ShiftSummary | null): string {
  if (!shift) return ''
  return `${shift.startTime} – ${shift.endTime}`
}
