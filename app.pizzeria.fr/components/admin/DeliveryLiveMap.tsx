'use client'

import { useEffect, useMemo, useState } from 'react'
import { PIZZERIA } from '@/lib/pizzeria-content'
import { orderAddressLine, parseDriverTrail, type OpsOrder } from '@/lib/ops-orders'
import { geocodeDeliveryAddress } from '@/lib/geocode-address'
import { DeliveryTrackingMapLazy } from '@/components/delivery/DeliveryTrackingMapLazy'
import type { LatLng } from '@/lib/delivery-map-route'

const DEPOT = {
  lat: PIZZERIA.coordinates.lat,
  lng: PIZZERIA.coordinates.lng,
  label: PIZZERIA.name,
  address: PIZZERIA.fullAddress,
}

type DestinationMap = Record<string, LatLng | null>

type Props = {
  orders: OpsOrder[]
  selectedId: string | null
  onSelect?: (id: string) => void
  /** Trace GPS accumulée côté admin (socket) en complément du trail BDD */
  liveTrails?: Record<string, LatLng[]>
}

export function DeliveryLiveMap({ orders, selectedId, onSelect, liveTrails }: Props) {
  const [destinations, setDestinations] = useState<DestinationMap>({})

  const deliveryOrders = useMemo(
    () => orders.filter((o) => o.type === 'DELIVERY'),
    [orders],
  )

  const focus =
    deliveryOrders.find((o) => o.id === selectedId) ??
    deliveryOrders.find((o) => o.status === 'OUT_FOR_DELIVERY') ??
    deliveryOrders[0]

  useEffect(() => {
    let cancelled = false

    async function resolveDestinations() {
      for (const order of deliveryOrders) {
        setDestinations((prev) => {
          if (prev[order.id] !== undefined) return prev
          if (order.deliveryLat != null && order.deliveryLng != null) {
            return { ...prev, [order.id]: { lat: order.deliveryLat, lng: order.deliveryLng } }
          }
          return prev
        })

        const hasCoords = order.deliveryLat != null && order.deliveryLng != null
        if (hasCoords) continue

        const address = orderAddressLine(order)
        if (!address) {
          setDestinations((prev) =>
            prev[order.id] !== undefined ? prev : { ...prev, [order.id]: null },
          )
          continue
        }

        const coords = await geocodeDeliveryAddress(
          order.deliveryAddress ?? '',
          order.deliveryPostalCode,
          order.deliveryCity,
        )
        if (cancelled) return
        setDestinations((prev) => ({ ...prev, [order.id]: coords }))
      }
    }

    void resolveDestinations()
    return () => {
      cancelled = true
    }
  }, [deliveryOrders])

  const clientStops = deliveryOrders
    .map((o) => {
      const dest = destinations[o.id]
      if (!dest) return null
      return {
        id: o.id,
        lat: dest.lat,
        lng: dest.lng,
        label: `#${o.orderNumber}${o.customerName ? ` — ${o.customerName}` : ''}`,
        address: orderAddressLine(o) ?? undefined,
      }
    })
    .filter(Boolean) as Array<{
    id: string
    lat: number
    lng: number
    label: string
    address?: string
  }>

  const focusDest = focus ? destinations[focus.id] : null
  const dbTrail = focus ? parseDriverTrail(focus.driverTrail) : []
  const socketTrail = focus && liveTrails?.[focus.id] ? liveTrails[focus.id]! : []
  const mergedTrail =
    socketTrail.length >= dbTrail.length
      ? socketTrail
      : [...dbTrail.map((p) => ({ lat: p.lat, lng: p.lng })), ...socketTrail]

  const driverPosition =
    focus?.driverLat != null && focus.driverLng != null
      ? { lat: focus.driverLat, lng: focus.driverLng }
      : null

  return (
    <DeliveryTrackingMapLazy
      depot={DEPOT}
      destination={
        focusDest
          ? {
              lat: focusDest.lat,
              lng: focusDest.lng,
              label: focus ? `#${focus.orderNumber}` : undefined,
              address: focus ? orderAddressLine(focus) ?? undefined : undefined,
            }
          : null
      }
      clientStops={clientStops}
      driverPosition={driverPosition}
      driverTrail={mergedTrail.length > 0 ? mergedTrail : undefined}
      selectedStopId={selectedId}
      onSelectStop={onSelect}
      showAddressBar
      showLegend
    />
  )
}
