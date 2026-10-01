import { Request, Response, NextFunction } from 'express';

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
] as const;

export type AppModule = (typeof ALL_MODULES)[number];

const V1_DEFAULT = 'menu,pos,kitchen,orders,reports,users,settings';

let cached: Set<string> | null = null;

export function getEnabledModules(): Set<string> {
  if (cached) return cached;
  const raw = process.env.ENABLED_MODULES ?? V1_DEFAULT;
  cached = new Set(
    raw
      .split(',')
      .map(s => s.trim().toLowerCase())
      .filter(Boolean)
  );
  return cached;
}

export function isModuleEnabled(module: AppModule): boolean {
  return getEnabledModules().has(module);
}

/** Express middleware — 404 si module désactivé (CDC §6.4). */
export function requireModule(
  module: AppModule
): (req: Request, res: Response, next: NextFunction) => Response | void {
  return (_req: Request, res: Response, next: NextFunction): Response | void => {
    if (!isModuleEnabled(module)) {
      return res.status(404).json({ error: 'Not found' });
    }
    next();
  };
}

export function resetModulesCache(): void {
  cached = null;
}
