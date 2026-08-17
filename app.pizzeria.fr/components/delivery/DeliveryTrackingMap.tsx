'use client'

import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { fetchDrivingRoute, type LatLng } from '@/lib/delivery-map-route'
import { cn } from '@/lib/cn'

function markerIcon(color: string, emoji: string, pulse = false) {
  return L.divIcon({
    className: 'delivery-leaflet-marker',
    html: `<div class="delivery-marker-pin${pulse ? ' delivery-marker-pulse' : ''}" style="--pin:${color}">${emoji}</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  })
}

const depotIcon = markerIcon('#C23B22', '🍕')
const clientIcon = markerIcon('#3b82f6', '🏠')
const driverIcon = markerIcon('#8b5cf6', '🛵', true)

export type TrackingDestination = LatLng & {
  label?: string
  address?: string
}

export type TrackingClientStop = TrackingDestination & { id: string }

type Props = {
  depot: TrackingDestination
  destination?: TrackingDestination | null
  /** Plusieurs arrêts (tournée livreur) */
  clientStops?: TrackingClientStop[]
  driverPosition?: LatLng | null
  driverTrail?: LatLng[]
  selectedStopId?: string | null
  onSelectStop?: (id: string) => void
  heightClass?: string
  showLegend?: boolean
  showAddressBar?: boolean
  className?: string
}

export function DeliveryTrackingMap({
  depot,
  destination,
  clientStops,
  driverPosition,
  driverTrail,
  selectedStopId,
  onSelectStop,
  heightClass = 'h-[min(420px,55vh)]',
  showLegend = true,
  showAddressBar = true,
  className,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layerRef = useRef<L.LayerGroup | null>(null)
  const [route, setRoute] = useState<LatLng[] | null>(null)

  const stops = clientStops?.length
    ? clientStops
    : destination
      ? [{ ...destination, id: 'main' }]
      : []

  const focusStop =
    stops.find((s) => s.id === selectedStopId) ??
    stops[0] ??
    null

  const routeFrom = driverPosition ?? depot
  const routeTo = focusStop

  useEffect(() => {
    let cancelled = false
    async function loadRoute() {
      if (!routeTo) {
        setRoute(null)
        return
      }
      const r = await fetchDrivingRoute(routeFrom, routeTo)
      if (!cancelled) setRoute(r)
    }
    void loadRoute()
    return () => {
      cancelled = true
    }
  }, [routeFrom.lat, routeFrom.lng, routeTo?.lat, routeTo?.lng])

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current, {
      center: [depot.lat, depot.lng],
      zoom: 13,
      scrollWheelZoom: true,
    })

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(map)

    const layer = L.layerGroup().addTo(map)
    mapRef.current = map
    layerRef.current = layer

    return () => {
      map.remove()
      mapRef.current = null
      layerRef.current = null
    }
  }, [depot.lat, depot.lng])

  useEffect(() => {
    const map = mapRef.current
    const layer = layerRef.current
    if (!map || !layer) return

    layer.clearLayers()
    const bounds = L.latLngBounds([depot.lat, depot.lng], [depot.lat, depot.lng])

    L.marker([depot.lat, depot.lng], { icon: depotIcon })
      .addTo(layer)
      .bindPopup(
        `<strong>${depot.label ?? 'Pizzeria'}</strong><br/>${depot.address ?? 'Départ livraisons'}`,
      )
    bounds.extend([depot.lat, depot.lng])

    for (const stop of stops) {
      const isFocus = stop.id === (selectedStopId ?? focusStop?.id)
      const marker = L.marker([stop.lat, stop.lng], {
        icon: clientIcon,
        opacity: selectedStopId && !isFocus ? 0.55 : 1,
      })
        .addTo(layer)
        .bindPopup(
          `<strong>${stop.label ?? 'Client'}</strong><br/>${stop.address ?? ''}`,
        )
      marker.on('click', () => onSelectStop?.(stop.id))
      bounds.extend([stop.lat, stop.lng])
    }

    if (driverTrail && driverTrail.length > 1) {
      L.polyline(
        driverTrail.map((p) => [p.lat, p.lng] as [number, number]),
        { color: '#a78bfa', weight: 4, opacity: 0.75 },
      ).addTo(layer)
      for (const p of driverTrail) bounds.extend([p.lat, p.lng])
    }

    if (route?.length && routeTo) {
      L.polyline(
        route.map((p) => [p.lat, p.lng] as [number, number]),
        { color: '#22c55e', weight: 5, opacity: 0.9 },
      ).addTo(layer)
    } else if (routeTo && driverPosition) {
      L.polyline(
        [
          [driverPosition.lat, driverPosition.lng],
          [routeTo.lat, routeTo.lng],
        ],
        { color: '#22c55e', weight: 3, dashArray: '6 6', opacity: 0.7 },
      ).addTo(layer)
    } else if (routeTo) {
      L.polyline(
        [
          [depot.lat, depot.lng],
          [routeTo.lat, routeTo.lng],
        ],
        { color: '#64748b', weight: 3, dashArray: '8 8', opacity: 0.55 },
      ).addTo(layer)
    }

    if (driverPosition) {
      L.marker([driverPosition.lat, driverPosition.lng], {
        icon: driverIcon,
        zIndexOffset: 1000,
      })
        .addTo(layer)
        .bindPopup('<strong>Livreur</strong><br/>Position temps réel')
      bounds.extend([driverPosition.lat, driverPosition.lng])
    }

    if (stops.length > 0 || driverPosition) {
      map.fitBounds(bounds.pad(0.15), { maxZoom: 15, animate: true })
    } else {
      map.setView([depot.lat, depot.lng], 13)
    }
  }, [
    depot,
    stops,
    driverPosition,
    driverTrail,
    route,
    routeTo,
    selectedStopId,
    focusStop?.id,
    onSelectStop,
  ])

  const departLabel = driverPosition ? 'Position livreur' : depot.label ?? 'Pizzeria'
  const departAddr = driverPosition
    ? `${driverPosition.lat.toFixed(5)}, ${driverPosition.lng.toFixed(5)}`
    : depot.address

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border border-white/10 bg-charcoal/80',
        className,
      )}
    >
      {showAddressBar && focusStop && (
        <div className="border-b border-white/10 bg-charcoal/95 px-3 py-2 text-xs">
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <p className="text-cream/90">
              <span className="font-semibold text-tomato-light">Départ ·</span>{' '}
              {departLabel}
              {departAddr && <span className="text-cream/50"> — {departAddr}</span>}
            </p>
            <p className="text-cream/90">
              <span className="font-semibold text-sky-300">Arrivée ·</span>{' '}
              {focusStop.label ?? 'Client'}
              {focusStop.address && (
                <span className="text-cream/50"> — {focusStop.address}</span>
              )}
            </p>
          </div>
          {driverTrail && driverTrail.length > 1 && (
            <p className="mt-1 text-[10px] text-violet-300/80">
              Trace parcours · {driverTrail.length} points GPS
            </p>
          )}
        </div>
      )}
      <div ref={containerRef} className={cn('w-full', heightClass)} />
      {showLegend && (
        <div className="pointer-events-none absolute bottom-3 left-3 flex flex-wrap gap-2 text-[10px] font-medium text-cream/80">
          <span className="rounded-full bg-charcoal/90 px-2 py-1 backdrop-blur">🍕 Départ</span>
          <span className="rounded-full bg-charcoal/90 px-2 py-1 backdrop-blur">🏠 Client</span>
          <span className="rounded-full bg-charcoal/90 px-2 py-1 backdrop-blur">🛵 Live</span>
          <span className="rounded-full bg-charcoal/90 px-2 py-1 backdrop-blur">━ Itinéraire</span>
        </div>
      )}
    </div>
  )
}
