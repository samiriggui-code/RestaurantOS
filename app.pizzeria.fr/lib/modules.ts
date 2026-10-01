export const ALL_MODULES = [
  'menu',
  'pos',
  'kiosk',
  'kitchen',
  'orders',
  'reports',
  'users',
  'settings',
  'wifi',
  'tables',
  'reservations',
  'shifts',
  'expenses',
  'licenses',
  'loyalty',
] as const

export type AppModule = (typeof ALL_MODULES)[number]

/** Défaut = version une-tablette La Z Pizza (sans pos/kiosk) — aligné sur docker-compose.yml. */
const V1_DEFAULT = 'menu,kitchen,orders,reports,users,settings,expenses,loyalty,shifts'

export function getEnabledModules(): Set<string> {
  const raw =
    (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_ENABLED_MODULES) || V1_DEFAULT
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  )
}

export function isModuleEnabled(module: AppModule): boolean {
  return getEnabledModules().has(module)
}

/** L’API employés/plannings est protégée par le module `users`. */
export function isStaffModuleEnabled(module: AppModule): boolean {
  if (module === 'shifts') {
    return isModuleEnabled('users') || isModuleEnabled('shifts')
  }
  return isModuleEnabled(module)
}

