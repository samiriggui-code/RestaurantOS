'use client'

import dynamic from 'next/dynamic'
import type { OpsOrder } from '@/lib/ops-orders'
import type { LatLng } from '@/lib/delivery-map-route'

const DeliveryLiveMapInner = dynamic(
  () => import('@/components/admin/DeliveryLiveMap').then((m) => m.DeliveryLiveMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[min(420px,55vh)] items-center justify-center rounded-xl border border-white/10 bg-charcoal/80">
        <p className="text-sm text-cream/40">Chargement carte…</p>
      </div>
    ),
  },
)

export function DeliveryLiveMapLazy(props: {
  orders: OpsOrder[]
  selectedId: string | null
  onSelect?: (id: string) => void
  liveTrails?: Record<string, LatLng[]>
}) {
  return <DeliveryLiveMapInner {...props} />
}
