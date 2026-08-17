'use client'

import type { LucideIcon } from 'lucide-react'
import { openMonitorWindow } from '@/lib/monitor-window'
import { cn } from '@/lib/cn'

export type AdminTabItem<T extends string> = {
  id: T
  label: string
  icon?: LucideIcon
  badge?: string | number
}

export function AdminSectionTabs<T extends string>({
  tabs,
  active,
  onChange,
  className,
}: {
  tabs: AdminTabItem<T>[]
  active: T
  onChange: (id: T) => void
  className?: string
}) {
  return (
    <div
      className={cn(
        'admin-scroll-x flex flex-wrap gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1',
        className,
      )}
    >
      {tabs.map(({ id, label, icon: Icon, badge }) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
            active === id
              ? 'bg-tomato/20 text-tomato-light'
              : 'text-cream/55 hover:bg-white/[0.04] hover:text-cream',
          )}
        >
          {Icon && <Icon className="h-4 w-4 shrink-0" />}
          {label}
          {badge !== undefined && (
            <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] tabular-nums text-cream/70">
              {badge}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

export function AdminPageHeader({
  title,
  description,
  subtitle,
  actions,
}: {
  title: string
  description?: string
  /** @deprecated utiliser description */
  subtitle?: string
  actions?: React.ReactNode
}) {
  const desc = description ?? subtitle
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="admin-page-title">{title}</h1>
        {desc && <p className="admin-page-subtitle mt-1 max-w-2xl">{desc}</p>}
      </div>
      {actions}
    </div>
  )
}

/** Enveloppe standard — centrage, max-width, espacement (padding géré par .admin-main). */
export function AdminPageShell({
  children,
  className,
  maxWidth = '7xl',
  compact = false,
}: {
  children: React.ReactNode
  className?: string
  maxWidth?: '5xl' | '6xl' | '7xl' | 'full'
  compact?: boolean
}) {
  const maxClass =
    maxWidth === 'full'
      ? 'max-w-none'
      : maxWidth === '5xl'
        ? 'max-w-5xl'
        : maxWidth === '6xl'
          ? 'max-w-6xl'
          : 'max-w-7xl'
  return (
    <div className={cn('admin-page-shell', compact && 'admin-page-shell--compact', maxClass, className)}>
      {children}
    </div>
  )
}

type AdminSettingsNavProps<T extends string> = {
  tabs: AdminTabItem<T>[]
  active: T
  onChange: (id: T) => void
}

/** Navigation latérale (volets) pour pages paramètres / réglages. */
export function AdminSettingsNav<T extends string>({ tabs, active, onChange }: AdminSettingsNavProps<T>) {
  return (
    <nav
      className="admin-scroll-x flex shrink-0 gap-1 overflow-x-auto rounded-xl border border-white/10 bg-white/[0.03] p-1 lg:block lg:w-52 lg:space-y-0.5 lg:overflow-visible lg:p-2"
      aria-label="Sections paramètres"
    >
      {tabs.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={cn(
            'flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors lg:w-full',
            active === id
              ? 'bg-tomato/20 text-tomato-light'
              : 'text-cream/55 hover:bg-white/[0.04] hover:text-cream',
          )}
        >
          {Icon && <Icon className="h-4 w-4 shrink-0" />}
          <span className="whitespace-nowrap">{label}</span>
        </button>
      ))}
    </nav>
  )
}

export function AdminMonitorBanner({
  href,
  title,
  description,
  icon: Icon,
}: {
  href: '/monitor/kitchen' | '/monitor/pos'
  title: string
  description: string
  icon: LucideIcon
}) {
  return (
    <button
      type="button"
      onClick={() => openMonitorWindow(href, href.replace(/\//g, '-'))}
      className="group flex w-full flex-wrap items-center justify-between gap-4 rounded-2xl border border-tomato/30 bg-gradient-to-br from-tomato/15 to-transparent p-5 text-left transition hover:border-tomato/50 hover:from-tomato/20"
    >
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-tomato/20 text-tomato-light">
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <p className="font-semibold text-cream group-hover:text-white">{title}</p>
          <p className="mt-0.5 text-sm text-cream/55">{description}</p>
        </div>
      </div>
      <span className="rounded-xl bg-tomato px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-tomato/20">
        Ouvrir en fenêtre ↗
      </span>
    </button>
  )
}
