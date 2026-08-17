'use client'

import { cn } from '@/lib/cn'

export type AppModuleVariant = 'back-office' | 'pos' | 'kds' | 'livraison' | 'kiosk'

const LABELS: Record<AppModuleVariant, string> = {
  'back-office': 'Back-office',
  pos: 'POS',
  kds: 'KDS',
  livraison: 'Livraison',
  kiosk: 'Totem',
}

type Props = {
  variant: AppModuleVariant
  collapsed?: boolean
  subtitle?: string
  className?: string
}

export function AppModuleBrand({ variant, collapsed, subtitle, className }: Props) {
  if (collapsed) {
    return (
      <div className={cn('text-center font-display text-xl text-tomato-light', className)} aria-hidden>
        Z
      </div>
    )
  }

  return (
    <div className={cn('min-w-0', className)}>
      <div className="font-display text-lg leading-none text-cream">
        La <span className="italic text-tomato-light">Z</span> Pizza
      </div>
      <p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.25em] text-cream/40">
        {LABELS[variant]}
      </p>
      {subtitle && <p className="mt-1 truncate text-xs text-cream/50">{subtitle}</p>}
    </div>
  )
}
