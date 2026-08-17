'use client'

import type { LucideIcon } from 'lucide-react'
import {
  CalendarCheck,
  ChefHat,
  Lock,
  Monitor,
  Package,
  Settings2,
  ShoppingBag,
  Smartphone,
  UtensilsCrossed,
  Wifi,
} from 'lucide-react'
import { AppModuleBrand } from '@/components/brand/AppModuleBrand'
import { SidebarToggleButton } from '@/components/ui/sidebar-toggle'
import { useCollapsibleSidebar } from '@/lib/use-collapsible-sidebar'
import { cn } from '@/lib/cn'

export type PosSuperTab =
  | 'commande'
  | 'cuisine'
  | 'salles'
  | 'reservations'
  | 'wifi'
  | 'stock'
  | 'params'

export const POS_SUPER_TABS: {
  id: PosSuperTab
  label: string
  icon: LucideIcon
  phoneHidden?: boolean
}[] = [
  { id: 'commande', label: 'Nouvelle vente', icon: ShoppingBag },
  { id: 'cuisine', label: 'File cuisine', icon: ChefHat },
  { id: 'salles', label: 'Salles & tables', icon: UtensilsCrossed },
  { id: 'reservations', label: 'Réservations', icon: CalendarCheck },
  { id: 'wifi', label: 'WiFi invité', icon: Wifi, phoneHidden: true },
  { id: 'stock', label: 'Stock live', icon: Package, phoneHidden: true },
  { id: 'params', label: 'Périphériques', icon: Settings2, phoneHidden: true },
]

type Props = {
  active: PosSuperTab
  onChange: (tab: PosSuperTab) => void
  view: 'tablet' | 'phone'
  onToggleView: () => void
  operatorName: string | null
  onLock: () => void
  children: React.ReactNode
}

export function PosSuperSidebar({
  active,
  onChange,
  view,
  onToggleView,
  operatorName,
  onLock,
  children,
}: Props) {
  const { collapsed, toggle } = useCollapsibleSidebar('pos')
  const isPhone = view === 'phone'
  const visibleTabs = POS_SUPER_TABS.filter((t) => !isPhone || !t.phoneHidden)

  if (isPhone) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
        <nav className="flex shrink-0 border-t border-white/10 bg-[#0d0a09]">
          {visibleTabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onChange(tab.id)}
                className={cn(
                  'flex flex-1 flex-col items-center gap-0.5 py-2 text-[9px] font-semibold',
                  active === tab.id ? 'text-tomato-light' : 'text-cream/40',
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="max-w-[4.5rem] truncate">{tab.label.split(' ')[0]}</span>
              </button>
            )
          })}
        </nav>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1">
      <aside
        className={cn(
          'relative flex shrink-0 flex-col border-r border-white/10 bg-[#0d0a09] transition-[width] duration-200 ease-linear',
          collapsed ? 'w-[3rem]' : 'w-[220px]',
        )}
      >
        <div className="relative border-b border-white/10 px-2 py-3">
          <div className={cn('flex items-center', collapsed && 'justify-center')}>
            <AppModuleBrand variant="pos" collapsed={collapsed} subtitle={operatorName ?? undefined} />
          </div>
          <SidebarToggleButton collapsed={collapsed} onToggle={toggle} variant="rail" />
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto overflow-x-hidden p-1.5">
          {POS_SUPER_TABS.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onChange(tab.id)}
                title={tab.label}
                className={cn(
                  'flex w-full items-center rounded-xl text-left text-sm font-medium transition-colors',
                  active === tab.id
                    ? 'bg-tomato/15 text-tomato-light'
                    : 'text-cream/55 hover:bg-white/[0.04] hover:text-cream',
                  collapsed ? 'justify-center px-2 py-2.5' : 'gap-2.5 px-3 py-2.5',
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span className="truncate">{tab.label}</span>}
              </button>
            )
          })}
        </nav>
        <div className="space-y-1 border-t border-white/10 p-1.5">
          <button
            type="button"
            onClick={onToggleView}
            title={view === 'tablet' ? 'Vue Sunmi / smartphone' : 'Vue tablette'}
            className={cn(
              'flex w-full items-center rounded-xl text-xs text-cream/50 hover:bg-white/[0.04]',
              collapsed ? 'justify-center px-2 py-2' : 'gap-2 px-3 py-2',
            )}
          >
            {view === 'tablet' ? <Smartphone className="h-4 w-4 shrink-0" /> : <Monitor className="h-4 w-4 shrink-0" />}
            {!collapsed && (view === 'tablet' ? 'Vue Sunmi / smartphone' : 'Vue tablette')}
          </button>
          <button
            type="button"
            onClick={onLock}
            title="Verrouiller session"
            className={cn(
              'flex w-full items-center rounded-xl text-xs text-amber-200/80 hover:bg-amber-500/10',
              collapsed ? 'justify-center px-2 py-2' : 'gap-2 px-3 py-2',
            )}
          >
            <Lock className="h-4 w-4 shrink-0" />
            {!collapsed && 'Verrouiller session'}
          </button>
        </div>
      </aside>
      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex h-10 shrink-0 items-center gap-2 border-b border-white/10 bg-charcoal/80 px-3">
          <SidebarToggleButton collapsed={collapsed} onToggle={toggle} />
          <span className="truncate text-xs text-cream/45">
            {POS_SUPER_TABS.find((t) => t.id === active)?.label}
          </span>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
      </main>
    </div>
  )
}
