'use client'

import type { LucideIcon } from 'lucide-react'
import { CalendarCheck, LifeBuoy, Route, Satellite } from 'lucide-react'
import { AppModuleBrand } from '@/components/brand/AppModuleBrand'
import { SidebarToggleButton } from '@/components/ui/sidebar-toggle'
import { useCollapsibleSidebar } from '@/lib/use-collapsible-sidebar'
import { cn } from '@/lib/cn'

export type DriverShellTab = 'tour' | 'day' | 'gps' | 'aide'

const TABS: { id: DriverShellTab; label: string; icon: LucideIcon }[] = [
  { id: 'tour', label: 'Ma tournée', icon: Route },
  { id: 'day', label: 'Ma journée', icon: CalendarCheck },
  { id: 'gps', label: 'GPS & position', icon: Satellite },
  { id: 'aide', label: 'Aide & contact', icon: LifeBuoy },
]

type Props = {
  active: DriverShellTab
  onChange: (tab: DriverShellTab) => void
  driverName?: string | null
  online?: boolean
  children: React.ReactNode
}

export function DriverShell({ active, onChange, driverName, online = true, children }: Props) {
  const { collapsed, toggle } = useCollapsibleSidebar('livreur')

  return (
    <div className="flex min-h-[100dvh] bg-[#0a0a0a] text-cream">
      <aside
        className={cn(
          'relative hidden shrink-0 flex-col border-r border-white/10 bg-[#0d0d0d] transition-[width] duration-200 ease-linear sm:flex',
          collapsed ? 'w-[3rem]' : 'w-[220px]',
        )}
      >
        <div className="relative border-b border-white/10 px-2 py-3">
          <div className={cn('flex items-center', collapsed && 'justify-center')}>
            <AppModuleBrand variant="livraison" collapsed={collapsed} subtitle={driverName ?? undefined} />
          </div>
          <SidebarToggleButton collapsed={collapsed} onToggle={toggle} variant="rail" />
        </div>
        <nav className="flex-1 space-y-0.5 p-2">
          {TABS.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                type="button"
                title={tab.label}
                onClick={() => onChange(tab.id)}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors',
                  active === tab.id
                    ? 'bg-violet-600/20 text-violet-200'
                    : 'text-cream/55 hover:bg-white/[0.04] hover:text-cream',
                  collapsed && 'justify-center px-2',
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span>{tab.label}</span>}
              </button>
            )
          })}
        </nav>
        {!collapsed && (
          <div className="border-t border-white/10 p-3">
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase',
                online ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/10 text-cream/40',
              )}
            >
              <span className={cn('h-1.5 w-1.5 rounded-full', online ? 'bg-emerald-400' : 'bg-cream/30')} />
              {online ? 'En ligne' : 'Hors ligne'}
            </span>
          </div>
        )}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-white/10 bg-[#0d0d0d]/95 px-3 sm:px-4">
          <SidebarToggleButton collapsed={collapsed} onToggle={toggle} className="hidden sm:inline-flex" />
          <div className="min-w-0 flex-1 sm:hidden">
            <AppModuleBrand variant="livraison" subtitle={driverName ?? undefined} />
          </div>
          <div className="hidden text-sm font-medium text-cream/70 sm:block">
            {TABS.find((t) => t.id === active)?.label}
          </div>
          <span
            className={cn(
              'ml-auto inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase sm:hidden',
              online ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/10 text-cream/40',
            )}
          >
            {online ? 'En ligne' : 'Off'}
          </span>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  )
}
