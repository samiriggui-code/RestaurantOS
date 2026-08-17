'use client'

import { cn } from '@/lib/cn'

export type BarDatum = {
  label: string
  value: number
  color?: string
}

type MiniBarChartProps = {
  data: BarDatum[]
  height?: number
  formatValue?: (v: number) => string
  className?: string
}

export function MiniBarChart({
  data,
  height = 140,
  formatValue = (v) => String(v),
  className,
}: MiniBarChartProps) {
  const max = Math.max(...data.map((d) => d.value), 1)

  return (
    <div className={cn('flex items-end gap-1', className)} style={{ height }}>
      {data.map((d) => {
        const pct = (d.value / max) * 100
        return (
          <div key={d.label} className="group flex flex-1 flex-col items-center gap-1">
            <span className="text-[9px] tabular-nums text-cream/30 opacity-0 transition group-hover:opacity-100">
              {formatValue(d.value)}
            </span>
            <div className="relative w-full flex-1 min-h-[4px] rounded-t-md bg-white/5">
              <div
                className="absolute bottom-0 w-full rounded-t-md transition-all duration-500"
                style={{
                  height: `${Math.max(pct, d.value > 0 ? 4 : 0)}%`,
                  backgroundColor: d.color ?? '#E85D4C',
                }}
              />
            </div>
            <span className="max-w-full truncate text-[9px] text-cream/40">{d.label}</span>
          </div>
        )
      })}
    </div>
  )
}
