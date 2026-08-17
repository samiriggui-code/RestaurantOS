/** Rôles staff — alignés sur le schéma User.role (Express). */

export const ROLE = {
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  CASHIER: 'CASHIER',
  CHEF: 'CHEF',
  WAITER: 'WAITER',
  DRIVER: 'DRIVER',
} as const

export type StaffRole = (typeof ROLE)[keyof typeof ROLE]

const ADMIN_ROLES: StaffRole[] = [ROLE.ADMIN, ROLE.MANAGER]
const POS_ROLES: StaffRole[] = [ROLE.ADMIN, ROLE.MANAGER, ROLE.CASHIER, ROLE.WAITER]
const KITCHEN_ROLES: StaffRole[] = [ROLE.ADMIN, ROLE.MANAGER, ROLE.CHEF, ROLE.WAITER]
const DRIVER_ROLES: StaffRole[] = [ROLE.ADMIN, ROLE.MANAGER, ROLE.DRIVER]

export function canAccessAdmin(role: string): boolean {
  return ADMIN_ROLES.includes(role as StaffRole)
}

export function canAccessPos(role: string): boolean {
  return POS_ROLES.includes(role as StaffRole)
}

export function canAccessKitchen(role: string): boolean {
  return KITCHEN_ROLES.includes(role as StaffRole)
}

export function canAccessDriver(role: string): boolean {
  return DRIVER_ROLES.includes(role as StaffRole)
}

export function homeRouteForRole(role: string): string {
  if (canAccessAdmin(role)) return '/admin'
  if (role === ROLE.CHEF) return '/kitchen'
  if (canAccessPos(role)) return '/pos'
  return '/login'
}

export const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'Administrateur',
  MANAGER: 'Manager',
  CASHIER: 'Caissier',
  CHEF: 'Cuisine',
  WAITER: 'Serveur',
  DRIVER: 'Livreur',
}

/** Rôles créables pour le personnel opérationnel (pas admin CRM). */
export const OPERATIONAL_ROLES: StaffRole[] = [
  ROLE.CASHIER,
  ROLE.CHEF,
  ROLE.WAITER,
  ROLE.DRIVER,
  ROLE.MANAGER,
]
