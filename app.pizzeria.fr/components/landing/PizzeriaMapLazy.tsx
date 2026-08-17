'use client'

import dynamic from 'next/dynamic'

const PizzeriaMapInner = dynamic(
  () => import('@/components/landing/PizzeriaMap').then((m) => m.PizzeriaMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[300px] w-full items-center justify-center rounded-2xl border border-white/10 bg-charcoal/80 lg:min-h-full lg:h-full">
        <p className="text-sm text-cream/40">Chargement de la carte…</p>
      </div>
    ),
  }
)

type PizzeriaMapLazyProps = {
  className?: string
}

export function PizzeriaMapLazy({ className }: PizzeriaMapLazyProps) {
  return <PizzeriaMapInner className={className} />
}
