'use client'

import type { CheckoutStepId } from '@/lib/checkout-flow'
import { CHECKOUT_STEP_LABELS } from '@/lib/checkout-flow'
import { cn } from '@/lib/cn'

type Props = {
  steps: CheckoutStepId[]
  current: CheckoutStepId
  className?: string
}

export function CheckoutSheetStepper({ steps, current, className }: Props) {
  const currentIdx = steps.indexOf(current)

  return (
    <nav aria-label="Étapes commande" className={cn('shrink-0 border-b border-white/5 px-4 py-2.5', className)}>
      <ol className="flex items-center gap-1">
        {steps.map((id, idx) => {
          const done = currentIdx > idx
          const active = id === current
          return (
            <li key={id} className="flex min-w-0 flex-1 items-center gap-1">
              {idx > 0 && (
                <span
                  className={cn('h-px flex-1', done || active ? 'bg-tomato/50' : 'bg-white/10')}
                  aria-hidden
                />
              )}
              <div className="flex min-w-0 flex-col items-center gap-0.5">
                <span
                  className={cn(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold',
                    active
                      ? 'bg-tomato text-white'
                      : done
                        ? 'bg-tomato/25 text-tomato-light'
                        : 'bg-white/10 text-cream/35',
                  )}
                >
                  {done ? '✓' : idx + 1}
                </span>
                <span
                  className={cn(
                    'max-w-[3.25rem] truncate text-[8px] font-medium uppercase tracking-wide',
                    active ? 'text-tomato-light' : done ? 'text-cream/50' : 'text-cream/30',
                  )}
                >
                  {CHECKOUT_STEP_LABELS[id]}
                </span>
              </div>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
