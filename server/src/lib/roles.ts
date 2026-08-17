export const ROLE = {
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  CASHIER: 'CASHIER',
  CHEF: 'CHEF',
  WAITER: 'WAITER',
  DRIVER: 'DRIVER',
} as const

const ADMIN_ROLES = new Set<string>([ROLE.ADMIN, ROLE.MANAGER])
const POS_ROLES = new Set<string>([ROLE.ADMIN, ROLE.MANAGER, ROLE.CASHIER, ROLE.WAITER])
const KITCHEN_ROLES = new Set<string>([ROLE.ADMIN, ROLE.MANAGER, ROLE.CHEF, ROLE.WAITER])
const DRIVER_ROLES = new Set<string>([ROLE.ADMIN, ROLE.MANAGER, ROLE.DRIVER])

export function canAccessAdmin(role: string): boolean {
  return ADMIN_ROLES.has(role)
}

export function canAccessPos(role: string): boolean {
  return POS_ROLES.has(role)
}

export function canAccessKitchen(role: string): boolean {
  return KITCHEN_ROLES.has(role)
}

export function canAccessDriver(role: string): boolean {
  return DRIVER_ROLES.has(role)
}

export function canAccessDevice(role: string, device: 'pos' | 'kitchen'): boolean {
  return device === 'pos' ? canAccessPos(role) : canAccessKitchen(role)
}
