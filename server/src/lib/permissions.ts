import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import { ROLE } from './roles';

/**
 * Permissions produit (RBAC) — couches au-dessus de requireRole pour les zones sensibles.
 * Les rôles mapés ici sont la source de vérité P0 reports / loyalty.
 */

export const PERMISSION = {
  REPORTS_READ: 'reports:read',
  LOYALTY_READ: 'loyalty:read',
  LOYALTY_WRITE: 'loyalty:write',
  LOYALTY_ADJUST: 'loyalty:adjust',
} as const;

export type Permission = (typeof PERMISSION)[keyof typeof PERMISSION];

const ROLE_PERMISSIONS: Record<string, ReadonlySet<Permission>> = {
  [ROLE.ADMIN]: new Set([
    PERMISSION.REPORTS_READ,
    PERMISSION.LOYALTY_READ,
    PERMISSION.LOYALTY_WRITE,
    PERMISSION.LOYALTY_ADJUST,
  ]),
  [ROLE.MANAGER]: new Set([
    PERMISSION.REPORTS_READ,
    PERMISSION.LOYALTY_READ,
    PERMISSION.LOYALTY_WRITE,
    PERMISSION.LOYALTY_ADJUST,
  ]),
  [ROLE.CASHIER]: new Set([PERMISSION.LOYALTY_READ, PERMISSION.LOYALTY_WRITE]),
  [ROLE.WAITER]: new Set([PERMISSION.LOYALTY_READ]),
  [ROLE.CHEF]: new Set(),
  [ROLE.DRIVER]: new Set(),
};

export function hasPermission(role: string, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.has(permission) ?? false;
}

export function requirePermission(...needed: Permission[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    const role = req.user?.role;
    if (!role || !needed.every(p => hasPermission(role, p))) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    next();
  };
}
