import type { LucideIcon } from 'lucide-react'
import {
  BarChart3,
  Bike,
  Calculator,
  CalendarDays,
  ChefHat,
  Clock,
  FileText,
  LayoutDashboard,
  Medal,
  Menu,
  MonitorSmartphone,
  Package,
  Plug,
  Receipt,
  Scale,
  Settings,
  ShoppingBag,
  Smartphone,
  Store,
  Table2,
  TrendingDown,
  Truck,
  UserCog,
  Users,
  Wifi,
} from 'lucide-react'
import type { AppModule } from '@/lib/modules'

export type AdminNavItem = {
  href: string
  label: string
  icon: LucideIcon
  exact?: boolean
  module?: AppModule
  roles?: string[]
  external?: boolean
}

export type AdminNavGroup = {
  label: string
  items: AdminNavItem[]
}

/**
 * Liens apps boutique (plein écran) — section Devices de la sidebar.
 * POS et Totem retirés : matériel désactivé, une seule tablette boutique désormais
 * (backoffice + bascule KDS / supervision livraison).
 */
export const DEVICE_APP_LINKS: AdminNavItem[] = [
  { href: '/kitchen', label: 'KDS cuisine', icon: ChefHat, external: true },
  { href: '/livreur', label: 'App livreur', icon: Bike, external: true },
]

/** Navigation back-office CRM — groupée (parité Lovable). */
export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    label: 'Pilotage',
    items: [
      { href: '/admin', label: 'Tableau de bord', icon: LayoutDashboard, exact: true },
      { href: '/admin/orders', label: 'Commandes', icon: ShoppingBag, module: 'orders' },
      { href: '/admin/clients', label: 'Clients', icon: Users, module: 'orders', roles: ['ADMIN', 'MANAGER'] },
      { href: '/admin/kitchen', label: 'Suivi cuisine', icon: ChefHat, module: 'kitchen', roles: ['ADMIN', 'MANAGER'] },
      { href: '/admin/pos', label: 'Suivi caisse', icon: Store, roles: ['ADMIN', 'MANAGER'] },
    ],
  },
  {
    label: 'Métier',
    items: [
      { href: '/admin/menu', label: 'Carte & produits', icon: Menu, module: 'menu', roles: ['ADMIN', 'MANAGER'] },
      { href: '/admin/stock', label: 'Stock & recettes', icon: Package, module: 'expenses', roles: ['ADMIN', 'MANAGER'] },
      { href: '/admin/delivery', label: 'Livraison', icon: Truck, module: 'settings', roles: ['ADMIN', 'MANAGER'] },
      { href: '/admin/tables', label: 'Tables', icon: Table2, module: 'tables' },
      { href: '/admin/reservations', label: 'Réservations', icon: CalendarDays, module: 'reservations' },
      { href: '/admin/loyalty', label: 'Fidélité', icon: Medal, module: 'loyalty', roles: ['ADMIN', 'MANAGER'] },
    ],
  },
  {
    label: 'RH',
    items: [
      { href: '/admin/employees', label: 'Employés', icon: Users, module: 'users' },
      { href: '/admin/planning', label: 'Planning équipe', icon: CalendarDays, module: 'shifts' },
      { href: '/admin/planning/heures', label: 'Heures mensuelles', icon: Clock, module: 'shifts', roles: ['ADMIN', 'MANAGER'] },
      { href: '/admin/shifts', label: 'Créneaux équipe', icon: Clock, module: 'shifts' },
    ],
  },
  {
    label: 'Finance',
    items: [
      { href: '/admin/caisse', label: 'Caisse & Z du jour', icon: Receipt, module: 'reports', roles: ['ADMIN', 'MANAGER'] },
      { href: '/admin/fiscal', label: 'Fiscal ISCA', icon: Scale, module: 'reports', roles: ['ADMIN', 'MANAGER'] },
      { href: '/admin/invoices', label: 'Facturation', icon: FileText, module: 'reports', roles: ['ADMIN', 'MANAGER'] },
      { href: '/admin/expenses', label: 'Dépenses', icon: TrendingDown, module: 'expenses', roles: ['ADMIN', 'MANAGER'] },
      { href: '/admin/reports', label: 'Rapports', icon: BarChart3, module: 'reports', roles: ['ADMIN', 'MANAGER'] },
    ],
  },
  {
    label: 'Devices (déploiement)',
    items: DEVICE_APP_LINKS,
  },
  {
    label: 'Infra',
    items: [
      { href: '/admin/devices', label: 'Devices & boutiques', icon: MonitorSmartphone, module: 'settings', roles: ['ADMIN', 'MANAGER'] },
      { href: '/admin/integrations', label: 'Intégrations', icon: Plug, module: 'settings', roles: ['ADMIN', 'MANAGER'] },
      { href: '/admin/wifi', label: 'WiFi invité', icon: Wifi, module: 'wifi', roles: ['ADMIN', 'MANAGER'] },
      { href: '/admin/users', label: 'Utilisateurs', icon: UserCog, module: 'users', roles: ['ADMIN'] },
      { href: '/admin/settings', label: 'Paramètres', icon: Settings, module: 'settings', roles: ['ADMIN'] },
    ],
  },
]

/** Liste plate — compat rétro (tests, recherche). */
export const ADMIN_NAV: AdminNavItem[] = ADMIN_NAV_GROUPS.flatMap((g) => g.items)

/**
 * Canaux commande (filtres admin + stats). POS et Totem retirés — matériel désactivé (une
 * seule tablette boutique désormais) : ces canaux ne créent plus aucune commande. Deliveroo
 * et Uber Eats retirés aussi — intégrations abandonnées (décidé le 2026-09-21) : aucune
 * commande ne prendra jamais ce canal, filtrer dessus ne renverrait qu'une liste vide.
 *
 * Pas de "Caisse SumUp" ici : les ventes comptoir SumUp ne créent aucune Commande (pas
 * d'items/client, cache SumupTransaction à part) — leur suivi/filtrage vit uniquement dans
 * Suivi caisse (AdminPosHub), pas dans ce filtre par canal de commandes. ORDER_CHANNEL_COLORS
 * garde tout de même une entrée SUMUP_COUNTER, utilisée par AdminCaisseView pour sa
 * répartition de CA par canal (un usage différent, agrégé, pas un filtre de liste ici).
 */
export const ORDER_CHANNEL_OPTIONS = [
  { value: '', label: 'Tous canaux' },
  { value: 'WEB', label: 'Site web' },
] as const

export const ORDER_CHANNEL_COLORS: Record<string, string> = {
  WEB: '#3b82f6',
  DELIVEROO: '#00ccbc',
  UBER_EATS: '#06c167',
  SUMUP_COUNTER: '#f59e0b',
}

export function orderChannelDisplayLabel(channel: string | null | undefined, isOnlineOrder?: boolean): string {
  if (channel === 'DELIVEROO') return 'Deliveroo'
  if (channel === 'UBER_EATS') return 'Uber Eats'
  if (channel === 'WEB' || isOnlineOrder) return 'Site web'
  if (channel === 'SUMUP_COUNTER') return 'Caisse SumUp'
  if (channel === 'POS') return 'Comptoir'
  return isOnlineOrder ? 'Site web' : 'Comptoir'
}
