'use client'

import dynamic from 'next/dynamic'
import type { ComponentProps } from 'react'

const DeliveryTrackingMapInner = dynamic(
  () =>
    import('@/components/delivery/DeliveryTrackingMap').then((m) => m.DeliveryTrackingMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[min(420px,55vh)] items-center justify-center rounded-xl border border-white/10 bg-charcoal/80">
        <p className="text-sm text-cream/40">Chargement carte…</p>
      </div>
    ),
  },
)

export function DeliveryTrackingMapLazy(
  props: ComponentProps<typeof DeliveryTrackingMapInner>,
) {
  return <DeliveryTrackingMapInner {...props} />
}
