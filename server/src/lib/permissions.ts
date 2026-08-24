import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import { ROLE } from './roles';

/**
 * Permissions produit (RBAC) — au-dessus de requireRole pour les zones sensibles.
 * Source de vérité : reports / loyalty / orders (passe A).
 */

export const PERMISSION = {
  REPORTS_READ: 'reports:read',
  LOYALTY_READ: 'loyalty:read',
  LOYALTY_WRITE: 'loyalty:write',
  LOYALTY_ADJUST: 'loyalty:adjust',
  /** Liste / détail / reçu */
  ORDERS_READ: 'orders:read',
  /** Statut, items cuisine, ajout items, print */
  ORDERS_WRITE: 'orders:write',
  /** Encaissement, payment, pos-settle, split */
  ORDERS_PAYMENT: 'orders:payment',
  ORDERS_CANCEL: 'orders:cancel',
  ORDERS_ASSIGN_DRIVER: 'orders:assign_driver',
  /** Lookup client par téléphone (PII) */
  ORDERS_CUSTOMER_PII: 'orders:customer_pii',
  /** Lecture paramètres boutique / horaires / intégrations */
  SETTINGS_READ: 'settings:read',
  /** Écriture paramètres boutique / horaires */
  SETTINGS_WRITE: 'settings:write',
  /** CRM devices — lecture onboarding / jumelage */
  DEVICES_READ: 'devices:read',
  /** CRM devices — jumelage, IP WAN, imprimantes */
  DEVICES_WRITE: 'devices:write',
  /** Mise en service / reset onboarding */
  DEVICES_ONBOARDING: 'devices:onboarding',
  /** Test impression LAN (cuisine / caisse) */
  DEVICES_PRINT: 'devices:print',
} as const;

export type Permission = (typeof PERMISSION)[keyof typeof PERMISSION];

const ALL_ORDERS: Permission[] = [
  PERMISSION.ORDERS_READ,
  PERMISSION.ORDERS_WRITE,
  PERMISSION.ORDERS_PAYMENT,
  PERMISSION.ORDERS_CANCEL,
  PERMISSION.ORDERS_ASSIGN_DRIVER,
  PERMISSION.ORDERS_CUSTOMER_PII,
];

const ADMIN_MANAGER_SETTINGS: Permission[] = [
  PERMISSION.SETTINGS_READ,
  PERMISSION.DEVICES_READ,
  PERMISSION.DEVICES_WRITE,
];

const ROLE_PERMISSIONS: Record<string, ReadonlySet<Permission>> = {
  [ROLE.ADMIN]: new Set([
    PERMISSION.REPORTS_READ,
    PERMISSION.LOYALTY_READ,
    PERMISSION.LOYALTY_WRITE,
    PERMISSION.LOYALTY_ADJUST,
    ...ALL_ORDERS,
    ...ADMIN_MANAGER_SETTINGS,
    PERMISSION.SETTINGS_WRITE,
    PERMISSION.DEVICES_ONBOARDING,
    PERMISSION.DEVICES_PRINT,
  ]),
  [ROLE.MANAGER]: new Set([
    PERMISSION.REPORTS_READ,
    PERMISSION.LOYALTY_READ,
    PERMISSION.LOYALTY_WRITE,
    PERMISSION.LOYALTY_ADJUST,
    ...ALL_ORDERS,
    ...ADMIN_MANAGER_SETTINGS,
    PERMISSION.DEVICES_PRINT,
  ]),
  [ROLE.CASHIER]: new Set([
    PERMISSION.LOYALTY_READ,
    PERMISSION.LOYALTY_WRITE,
    PERMISSION.ORDERS_READ,
    PERMISSION.ORDERS_WRITE,
    PERMISSION.ORDERS_PAYMENT,
    PERMISSION.ORDERS_CANCEL,
    PERMISSION.ORDERS_CUSTOMER_PII,
    PERMISSION.DEVICES_PRINT,
  ]),
  [ROLE.WAITER]: new Set([
    PERMISSION.LOYALTY_READ,
    PERMISSION.ORDERS_READ,
    PERMISSION.ORDERS_WRITE,
  ]),
  [ROLE.CHEF]: new Set([
    PERMISSION.ORDERS_READ,
    PERMISSION.ORDERS_WRITE,
    PERMISSION.ORDERS_CANCEL,
    PERMISSION.DEVICES_PRINT,
  ]),
  [ROLE.DRIVER]: new Set([PERMISSION.ORDERS_READ]),
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
