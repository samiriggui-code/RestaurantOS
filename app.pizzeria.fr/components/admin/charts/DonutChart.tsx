'use client'

import { formatEUR } from '@/lib/money'
import { cn } from '@/lib/cn'

export type DonutSlice = {
  label: string
  value: number
  color: string
}

type DonutChartProps = {
  slices: DonutSlice[]
  size?: number
  centerLabel?: string
  centerValue?: string
  valueFormat?: 'eur' | 'number'
  className?: string
}

export function DonutChart({
  slices,
  size = 160,
  centerLabel,
  centerValue,
  valueFormat = 'number',
  className,
}: DonutChartProps) {
  const total = slices.reduce((s, x) => s + x.value, 0)
  const r = 42
  const c = 2 * Math.PI * r
  let offset = 0

  const arcs = slices
    .filter((s) => s.value > 0)
    .map((slice) => {
      const pct = total > 0 ? slice.value / total : 0
      const dash = pct * c
      const arc = { ...slice, dash, gap: c - dash, offset: -offset }
      offset += dash
      return arc
    })

  const displayCenter =
    centerValue ??
    (total > 0
      ? valueFormat === 'eur'
        ? formatEUR(total)
        : String(total)
      : '—')

  return (
    <div className={cn('flex flex-col items-center gap-4 sm:flex-row sm:items-start', className)}>
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
          <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="12" />
          {arcs.map((arc) => (
            <circle
              key={arc.label}
              cx="50"
              cy="50"
              r={r}
              fill="none"
              stroke={arc.color}
              strokeWidth="12"
              strokeDasharray={`${arc.dash} ${arc.gap}`}
              strokeDashoffset={arc.offset}
              strokeLinecap="round"
              className="transition-all duration-500"
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          {centerLabel && <span className="text-[10px] uppercase tracking-wide text-cream/40">{centerLabel}</span>}
          <span className="text-sm font-bold tabular-nums text-cream">{displayCenter}</span>
        </div>
      </div>
      <ul className="min-w-0 flex-1 space-y-2">
        {slices.map((slice) => {
          const pct = total > 0 ? Math.round((slice.value / total) * 100) : 0
          return (
            <li key={slice.label} className="flex items-center justify-between gap-2 text-xs">
              <span className="flex min-w-0 items-center gap-2 text-cream/70">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: slice.color }} />
                <span className="truncate">{slice.label}</span>
              </span>
              <span className="shrink-0 tabular-nums text-cream/50">
                {valueFormat === 'eur' ? formatEUR(slice.value) : slice.value}
                <span className="ml-1 text-cream/30">({pct}%)</span>
              </span>
            </li>
          )
        })}
        {total === 0 && <li className="text-xs text-cream/35">Aucune donnée</li>}
      </ul>
    </div>
  )
}
