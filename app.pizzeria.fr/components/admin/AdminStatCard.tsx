'use client'

import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'

/** Grille harmonisée — 4 cartes sur dashboard, rapports, stock, dépenses. */
export const ADMIN_STAT_GRID = 'grid gap-3 sm:grid-cols-2 lg:grid-cols-4'

type AdminStatCardProps = {
  label: string
  value: string | number
  sub?: string
  icon?: LucideIcon
  tone?: string
}

export function AdminStatCard({ label, value, sub, icon: Icon, tone = 'text-cream' }: AdminStatCardProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#1A1412] p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-cream/40">{label}</p>
        {Icon && <Icon className="h-4 w-4 shrink-0 text-cream/20" />}
      </div>
      <p className={cn('mt-2 text-2xl font-bold tabular-nums', tone)}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-cream/35">{sub}</p>}
    </div>
  )
}
