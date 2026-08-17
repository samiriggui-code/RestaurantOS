'use client'

import { cn } from '@/lib/cn'
import { CHECKOUT_STEP_LABELS, type CheckoutStepId } from '@/lib/checkout-flow'

type CheckoutStepBarProps = {
  steps: CheckoutStepId[]
  current: CheckoutStepId
}

export function CheckoutStepBar({ steps, current }: CheckoutStepBarProps) {
  const currentIdx = steps.indexOf(current)

  return (
    <nav aria-label="Étapes de commande" className="mb-8">
      <ol className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none sm:gap-2">
        {steps.map((step, i) => {
          const done = i < currentIdx
          const active = step === current
          return (
            <li key={step} className="flex shrink-0 items-center gap-1 sm:gap-2">
              <span
                className={cn(
                  'flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition sm:text-sm',
                  active && 'bg-tomato text-white',
                  done && !active && 'bg-emerald-500/15 text-emerald-300',
                  !active && !done && 'bg-white/5 text-cream/40'
                )}
              >
                <span
                  className={cn(
                    'flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold',
                    active && 'bg-white/20',
                    done && !active && 'bg-emerald-500/30',
                    !active && !done && 'bg-white/10'
                  )}
                >
                  {done && !active ? '✓' : i + 1}
                </span>
                <span className="whitespace-nowrap">{CHECKOUT_STEP_LABELS[step]}</span>
              </span>
              {i < steps.length - 1 && (
                <span className="hidden h-px w-4 bg-white/10 sm:block" aria-hidden />
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
