'use client'

import { X } from 'lucide-react'
import { formatEUR, centsToEuros, eurosToCents } from '@/lib/money'
import { PIZZA_SIZES, priceForPizzaSize, type PizzaSizeId } from '@/lib/pizza-sizes'
import { cn } from '@/lib/cn'

type PosPizzaSizeSheetProps = {
  itemName: string
  basePriceCents: number
  onPick: (sizeId: PizzaSizeId, unitPriceCents: number) => void
  onClose: () => void
}

export function PosPizzaSizeSheet({
  itemName,
  basePriceCents,
  onPick,
  onClose,
}: PosPizzaSizeSheetProps) {
  const baseEuros = centsToEuros(basePriceCents)

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#1A1412] shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-white/10 p-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-cream/40">Choisir la taille</p>
            <h3 className="font-display text-xl font-bold text-cream">{itemName}</h3>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-cream/50 hover:bg-white/10">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="grid gap-2 p-4">
          {PIZZA_SIZES.map((size) => {
            const priceCents = eurosToCents(priceForPizzaSize(baseEuros, size.id))
            return (
              <button
                key={size.id}
                type="button"
                onClick={() => onPick(size.id, priceCents)}
                className={cn(
                  'flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3',
                  'text-left transition hover:border-tomato/40 hover:bg-tomato/10 active:scale-[0.99]'
                )}
              >
                <div>
                  <p className="font-semibold text-cream">{size.label}</p>
                  {size.seniorLabel ? (
                    <p className="text-xs text-cream/45">{size.seniorLabel}</p>
                  ) : null}
                </div>
                <span className="shrink-0 font-bold text-tomato-light">{formatEUR(priceCents)}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
