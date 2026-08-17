'use client'

import { Building2, ChevronDown } from 'lucide-react'
import type { StoreInventoryRow } from '@/lib/device-onboarding'
import { cn } from '@/lib/cn'

export function StoreScopeBar({
  stores,
  selectedId,
  onSelect,
  className,
}: {
  stores: StoreInventoryRow[]
  selectedId: string | null
  onSelect: (businessId: string) => void
  className?: string
}) {
  const current = stores.find((s) => s.businessId === selectedId) ?? stores[0]
  const multi = stores.length > 1

  if (!current) return null

  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3',
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-tomato/15">
          <Building2 className="h-5 w-5 text-tomato-light" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-cream/45">
            {multi ? 'Boutique active' : 'Point de vente'}
          </p>
          {multi ? (
            <div className="relative mt-0.5">
              <select
                value={selectedId ?? current.businessId}
                onChange={(e) => onSelect(e.target.value)}
                className="w-full max-w-xs appearance-none rounded-lg border border-white/10 bg-charcoal py-1.5 pl-3 pr-8 text-sm font-medium text-cream focus:border-tomato/40 focus:outline-none"
              >
                {stores.map((store) => (
                  <option key={store.businessId} value={store.businessId}>
                    {store.businessName}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-cream/40" />
            </div>
          ) : (
            <p className="truncate font-display text-lg font-bold text-cream">{current.businessName}</p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <ScopePill label="IP boutique" value={current.wanIp?.split('/')[0] ?? 'Non configurée'} warn={!current.wanIp} />
        <ScopePill label="Terminaux" value={`${current.pairedCount} jumelé(s)`} />
      </div>
    </div>
  )
}

function ScopePill({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <span
      className={cn(
        'rounded-full border px-2.5 py-1 tabular-nums',
        warn ? 'border-amber-500/30 bg-amber-500/10 text-amber-200' : 'border-white/10 bg-black/20 text-cream/70',
      )}
    >
      <span className="text-cream/45">{label} · </span>
      <span className="font-mono">{value}</span>
    </span>
  )
}
