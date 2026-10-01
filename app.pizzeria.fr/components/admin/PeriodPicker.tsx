'use client'

import { CalendarRange } from 'lucide-react'
import { DASHBOARD_PERIODS, type ArchivePeriod, type CustomRange } from '@/lib/order-period'
import { cn } from '@/lib/cn'

type PeriodPickerProps = {
  period: ArchivePeriod
  custom: CustomRange
  onPeriodChange: (period: ArchivePeriod) => void
  onCustomChange: (range: CustomRange) => void
}

/**
 * Sélecteur de période partagé (jour/semaine/mois/personnalisé) — dashboard, rapports,
 * caisse. Placé en haut à droite des pages qui l'utilisent.
 */
export function PeriodPicker({ period, custom, onPeriodChange, onCustomChange }: PeriodPickerProps) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <div className="flex gap-1 rounded-xl border border-white/10 bg-[#120e0c]/60 p-1" role="group" aria-label="Période">
        {DASHBOARD_PERIODS.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => onPeriodChange(p.value)}
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              period === p.value
                ? 'bg-tomato/20 text-tomato-light'
                : 'text-cream/55 hover:bg-white/[0.04] hover:text-cream',
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {period === 'custom' && (
        <div className="flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.03] px-2 py-1">
          <CalendarRange className="h-4 w-4 text-cream/40" />
          <input
            type="date"
            value={custom.from.slice(0, 10)}
            onChange={(e) => onCustomChange({ ...custom, from: `${e.target.value}T00:00:00.000Z` })}
            className="bg-transparent text-sm text-cream outline-none"
            title="Du"
          />
          <span className="text-cream/30">→</span>
          <input
            type="date"
            value={custom.to.slice(0, 10)}
            onChange={(e) => onCustomChange({ ...custom, to: `${e.target.value}T23:59:59.999Z` })}
            className="bg-transparent text-sm text-cream outline-none"
            title="Au"
          />
        </div>
      )}
    </div>
  )
}

export function defaultCustomRange(): CustomRange {
  const to = new Date()
  const from = new Date(to)
  from.setDate(from.getDate() - 7)
  return { from: from.toISOString(), to: to.toISOString() }
}
