'use client'

import dynamic from 'next/dynamic'
import type { ApexOptions } from 'apexcharts'
import { formatEUR } from '@/lib/money'
import { cn } from '@/lib/cn'

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false })

export type DonutSlice = { label: string; value: number; color: string }

type ApexDonutChartProps = {
  slices: DonutSlice[]
  size?: number
  centerLabel?: string
  valueFormat?: 'eur' | 'number'
  className?: string
}

/**
 * Donut (anneau seul, sans légende Apex intégrée — elle écrasait le texte dans une case
 * trop étroite dès qu'un libellé était un peu long) + une vraie liste HTML en dessous,
 * pleine largeur de carte, une ligne par tranche.
 */
export function ApexDonutChart({
  slices,
  size = 160,
  centerLabel,
  valueFormat = 'number',
  className,
}: ApexDonutChartProps) {
  const filtered = slices.filter((s) => s.value > 0)
  const total = filtered.reduce((s, x) => s + x.value, 0)
  const format = (v: number) => (valueFormat === 'eur' ? formatEUR(v) : String(v))

  if (filtered.length === 0) {
    return (
      <div className={cn('flex items-center justify-center', className)} style={{ minHeight: size }}>
        <p className="text-sm text-cream/40">Aucune donnée</p>
      </div>
    )
  }

  const valueFontSize = Math.max(13, Math.round(size * 0.1))
  const labelFontSize = Math.max(9, Math.round(size * 0.065))

  const options: ApexOptions = {
    chart: { type: 'donut', background: 'transparent', fontFamily: 'inherit' },
    theme: { mode: 'dark' },
    labels: filtered.map((s) => s.label),
    colors: filtered.map((s) => s.color),
    stroke: { width: 2, colors: ['#1A1412'] },
    dataLabels: { enabled: false },
    legend: { show: false },
    plotOptions: {
      pie: {
        donut: {
          size: '72%',
          labels: {
            show: true,
            total: {
              show: true,
              label: centerLabel ?? '',
              color: 'rgba(245,235,224,0.75)',
              fontSize: `${labelFontSize}px`,
              formatter: (w) => format(w.globals.seriesTotals.reduce((a: number, b: number) => a + b, 0)),
            },
            value: { color: '#F5EBE0', fontSize: `${valueFontSize}px`, fontWeight: 700, offsetY: 4 },
          },
        },
      },
    },
    tooltip: { theme: 'dark', y: { formatter: (v: number) => format(v) } },
  }

  return (
    <div className={cn('flex flex-col items-center gap-4', className)}>
      <Chart options={options} series={filtered.map((s) => s.value)} type="donut" width={size} height={size} />
      <ul className="w-full space-y-1.5">
        {filtered.map((slice) => {
          const pct = total > 0 ? Math.round((slice.value / total) * 100) : 0
          return (
            <li key={slice.label} className="flex items-center justify-between gap-3 text-sm">
              <span className="flex min-w-0 items-center gap-2 text-cream/70">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: slice.color }} />
                <span className="truncate">{slice.label}</span>
              </span>
              <span className="shrink-0 tabular-nums text-cream/50">
                {format(slice.value)} <span className="text-cream/30">({pct}%)</span>
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
