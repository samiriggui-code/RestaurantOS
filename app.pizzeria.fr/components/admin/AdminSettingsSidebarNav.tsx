'use client'

import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'

export type SettingsNavItem<T extends string> = {
  id: T
  label: string
  icon?: LucideIcon
}

export type SettingsNavGroup<T extends string> = {
  label: string
  itemIds: T[]
}

type Props<T extends string> = {
  tabs: SettingsNavItem<T>[]
  groups: SettingsNavGroup<T>[]
  active: T
  onChange: (id: T) => void
  className?: string
}

export function AdminSettingsSidebarNav<T extends string>({
  tabs,
  groups,
  active,
  onChange,
  className,
}: Props<T>) {
  const tabMap = new Map(tabs.map((t) => [t.id, t]))

  return (
    <aside className={cn('hidden w-[220px] shrink-0 lg:block', className)}>
      <nav
        className="sticky top-4 max-h-[calc(100dvh-7rem)] overflow-y-auto rounded-xl border border-white/10 bg-[#141010] p-2"
        aria-label="Sections paramètres"
      >
        {groups.map((group) => {
          const items = group.itemIds.map((id) => tabMap.get(id)).filter(Boolean) as SettingsNavItem<T>[]
          if (items.length === 0) return null

          return (
            <div key={group.label} className="mb-3 last:mb-0">
              <p className="mb-1 px-2.5 text-[9px] font-semibold uppercase tracking-[0.2em] text-cream/30">
                {group.label}
              </p>
              <ul className="space-y-0.5">
                {items.map((item) => {
                  const Icon = item.icon
                  const isActive = active === item.id
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => onChange(item.id)}
                        className={cn(
                          'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors',
                          isActive
                            ? 'bg-tomato/15 font-medium text-tomato-light'
                            : 'text-cream/55 hover:bg-white/[0.04] hover:text-cream',
                        )}
                      >
                        {Icon && <Icon className="h-4 w-4 shrink-0 opacity-80" />}
                        <span className="truncate">{item.label}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </nav>
    </aside>
  )
}
