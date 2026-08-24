'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useFeedbackState } from '@/lib/use-feedback-state'
import Link from 'next/link'
import {
  CalendarCheck,
  CheckCircle2,
  ChevronRight,
  Loader2,
  MapPin,
  Navigation,
  Phone,
  RefreshCw,
  Route,
  Satellite,
  Truck,
  AlertTriangle,
} from 'lucide-react'
import { deliveryQueueStatusLabel } from '@/lib/ops-orders'
import {
  fetchDriverDayRecap,
  fetchDriverStops,
  getStoredDriverUserId,
  type DeliveryStop,
  type DriverDayRecap,
  type DriverStopsResponse,
} from '@/lib/driver-api'
import { NavigationLauncher } from '@/components/delivery/NavigationLauncher'
import { DeliveryTrackingMapLazy } from '@/components/delivery/DeliveryTrackingMapLazy'
import { DriverShell, type DriverShellTab } from '@/components/delivery/DriverShell'
import { useDriverGps } from '@/lib/use-driver-gps'
import { formatEUR } from '@/lib/money'
import {
  addressLine,
  formatDistanceKm,
  googleMapsMultiStopUrl,
  scheduledSlotLabel,
} from '@/lib/route-optimize'
import { PIZZERIA } from '@/lib/pizzeria-content'
import { cn } from '@/lib/cn'

type Tab = 'tour' | 'day'

export function DriverHubView() {
  const [shellTab, setShellTab] = useState<DriverShellTab>('tour')
  const [tab, setTab] = useState<Tab>('tour')
  const [data, setData] = useState<DriverStopsResponse | null>(null)
  const [recap, setRecap] = useState<DriverDayRecap | null>(null)
  const [loading, setLoading] = useState(true)
  const [recapLoading, setRecapLoading] = useState(false)
  const { error, setError } = useFeedbackState()
  const [reoptimizing, setReoptimizing] = useState(false)
  const [activeDeliveryToken, setActiveDeliveryToken] = useState<string | null>(null)
  const loadRef = useRef<(lat?: number, lng?: number) => Promise<void>>(async () => {})

  useEffect(() => {
    const t = sessionStorage.getItem('pizzeria_driver_active_delivery')
    setActiveDeliveryToken(t)
  }, [])

  const loadStops = useCallback(async (driverLat?: number, driverLng?: number) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchDriverStops(
        driverLat != null && driverLng != null ? { driverLat, driverLng } : undefined,
      )
      setData(res)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setLoading(false)
      setReoptimizing(false)
    }
  }, [])

  loadRef.current = loadStops

  const onGpsMove = useCallback((pos: { lat: number; lng: number }) => {
    setReoptimizing(true)
    void loadRef.current(pos.lat, pos.lng)
  }, [])

  const gps = useDriverGps({ onSignificantMove: onGpsMove, moveThresholdMeters: 150 })

  useEffect(() => {
    void loadStops()
    const id = window.setInterval(() => {
      void loadStops(gps.position?.lat, gps.position?.lng)
    }, 45_000)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- interval stable
  }, [loadStops])

  const loadRecap = useCallback(async () => {
    setRecapLoading(true)
    try {
      setRecap(await fetchDriverDayRecap())
    } catch {
      setRecap(null)
    } finally {
      setRecapLoading(false)
    }
  }, [])

  useEffect(() => {
    if (tab === 'day') void loadRecap()
    const id = window.setInterval(() => {
      if (tab === 'day') void loadRecap()
    }, 30_000)
    return () => window.clearInterval(id)
  }, [tab, loadRecap])

  const stops = data?.stops ?? []
  const nextStop = stops[0]
  const origin = data?.origin ?? gps.position ?? data?.depot

  const fullRouteUrl = useMemo(() => {
    const pts = stops
      .filter((s) => s.deliveryLat != null && s.deliveryLng != null)
      .map((s) => ({ lat: s.deliveryLat!, lng: s.deliveryLng! }))
    if (!origin || pts.length === 0) return null
    return googleMapsMultiStopUrl(origin, pts)
  }, [stops, origin])

  useEffect(() => {
    if (shellTab === 'tour') setTab('tour')
    if (shellTab === 'day') setTab('day')
  }, [shellTab])

  const driverId = getStoredDriverUserId()

  return (
    <DriverShell active={shellTab} onChange={setShellTab} driverName={driverId ? `Livreur ${driverId.slice(0, 6)}` : 'Livreur'} online={!error}>
      <div className="mx-auto max-w-lg space-y-4 px-4 pb-10 pt-4">
        {shellTab === 'gps' && (
          <GpsStatusBar
            active={gps.active}
            position={gps.position}
            error={gps.error}
            devHttpsUrl={gps.support?.devHttpsUrl}
            originFromGps={data?.originFromGps}
            onToggle={() => (gps.active ? gps.stop() : gps.start())}
          />
        )}

        {shellTab === 'aide' && (
          <div className="space-y-3 rounded-xl border border-white/10 bg-charcoal/80 p-4 text-sm">
            <h2 className="font-display text-lg text-cream">Aide livreur</h2>
            <p className="text-cream/60">
              Activez le GPS avant de lancer la tournée. Utilisez « Reprendre la livraison » si vous avez quitté l&apos;écran
              en cours de route.
            </p>
            <a href={`tel:${PIZZERIA.phone}`} className="block font-semibold text-violet-300">
              Appeler la pizzeria — {PIZZERIA.phone}
            </a>
          </div>
        )}

        {(shellTab === 'tour' || shellTab === 'day') && (
          <>
            {shellTab === 'tour' && (
              <GpsStatusBar
                active={gps.active}
                position={gps.position}
                error={gps.error}
                devHttpsUrl={gps.support?.devHttpsUrl}
                originFromGps={data?.originFromGps}
                onToggle={() => (gps.active ? gps.stop() : gps.start())}
              />
            )}

            {activeDeliveryToken && shellTab === 'tour' && (
              <Link
                href={`/livreur/${activeDeliveryToken}?hub=1`}
                className="flex items-center justify-center gap-2 rounded-xl border border-tomato/40 bg-tomato/10 py-3 text-sm font-bold text-tomato-light"
              >
                Reprendre la livraison en cours
                <ChevronRight className="h-4 w-4" />
              </Link>
            )}

            {shellTab === 'tour' && tab === 'tour' ? (
              <TourTab
                data={data}
                stops={stops}
                nextStop={nextStop}
                origin={origin}
                driverPosition={gps.position}
                loading={loading}
                reoptimizing={reoptimizing}
                error={error}
                fullRouteUrl={fullRouteUrl}
                onRefresh={() => void loadStops(gps.position?.lat, gps.position?.lng)}
                onReoptimize={() => {
                  if (gps.position) {
                    setReoptimizing(true)
                    void loadStops(gps.position.lat, gps.position.lng)
                  } else {
                    setError('Activez le GPS pour optimiser depuis votre position')
                  }
                }}
              />
            ) : shellTab === 'day' ? (
              <DayRecapTab recap={recap} loading={recapLoading} onRefresh={() => void loadRecap()} />
            ) : null}
          </>
        )}
      </div>
    </DriverShell>
  )
}

function GpsStatusBar({
  active,
  position,
  error,
  devHttpsUrl,
  originFromGps,
  onToggle,
}: {
  active: boolean
  position: { lat: number; lng: number; accuracy: number } | null
  error: string | null
  devHttpsUrl?: string | null
  originFromGps?: boolean
  onToggle: () => void
}) {
  return (
    <div
      className={cn(
        'rounded-xl border px-4 py-3 text-sm',
        active && position
          ? 'border-emerald-500/35 bg-emerald-950/25'
          : 'border-amber-500/30 bg-amber-950/20',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Satellite className={cn('h-4 w-4', active && position ? 'text-emerald-400' : 'text-amber-400')} />
          <span className="font-medium text-cream">
            {active && position ? 'GPS actif' : 'GPS inactif'}
          </span>
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="text-xs font-semibold text-violet-300 underline"
        >
          {active ? 'Couper' : 'Activer'}
        </button>
      </div>
      {position && (
        <p className="mt-1 text-xs text-cream/50">
          Précision ~{Math.round(position.accuracy)} m
          {originFromGps ? ' · tournée calculée depuis vous' : ' · en attente position…'}
        </p>
      )}
      {!active && !error && !devHttpsUrl && (
        <p className="mt-1 text-xs text-cream/50">
          Activez le GPS pour optimiser la tournée depuis votre position.
        </p>
      )}
      {error && <p className="mt-1 text-xs text-red-300">{error}</p>}
      {devHttpsUrl && (
        <div className="mt-2 rounded-lg border border-violet-500/30 bg-violet-950/30 px-3 py-2 text-xs text-cream/80">
          <p className="font-medium text-violet-200">Test téléphone en HTTPS</p>
          <p className="mt-1 text-cream/60">
            Arrêtez le serveur, lancez{' '}
            <code className="rounded bg-black/30 px-1">npm run dev:mobile</code> sur le PC, puis ouvrez :
          </p>
          <a
            href={devHttpsUrl}
            className="mt-2 block break-all font-mono text-violet-300 underline"
          >
            {devHttpsUrl}
          </a>
          <p className="mt-1 text-cream/50">Acceptez l&apos;avertissement de certificat sur le téléphone.</p>
        </div>
      )}
    </div>
  )
}

function TourTab({
  data,
  stops,
  nextStop,
  origin,
  driverPosition,
  loading,
  reoptimizing,
  error,
  fullRouteUrl,
  onRefresh,
  onReoptimize,
}: {
  data: DriverStopsResponse | null
  stops: DeliveryStop[]
  nextStop: DeliveryStop | undefined
  origin: { lat: number; lng: number } | null | undefined
  driverPosition?: { lat: number; lng: number } | null
  loading: boolean
  reoptimizing: boolean
  error: string | null
  fullRouteUrl: string | null
  onRefresh: () => void
  onReoptimize: () => void
}) {
  const depot = {
    lat: PIZZERIA.coordinates.lat,
    lng: PIZZERIA.coordinates.lng,
    label: PIZZERIA.name,
    address: PIZZERIA.fullAddress,
  }

  const clientStops = stops
    .filter((s) => s.deliveryLat != null && s.deliveryLng != null)
    .map((s) => ({
      id: s.id,
      lat: s.deliveryLat!,
      lng: s.deliveryLng!,
      label: `#${s.orderNumber}${s.customerName ? ` — ${s.customerName}` : ''}`,
      address: addressLine(s.deliveryAddress, s.deliveryPostalCode, s.deliveryCity) || undefined,
    }))

  const focusStop = nextStop
  const focusDest =
    focusStop?.deliveryLat != null && focusStop.deliveryLng != null
      ? {
          lat: focusStop.deliveryLat,
          lng: focusStop.deliveryLng,
          label: `#${focusStop.orderNumber}`,
          address:
            addressLine(
              focusStop.deliveryAddress,
              focusStop.deliveryPostalCode,
              focusStop.deliveryCity,
            ) || undefined,
        }
      : null

  return (
    <>
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-xl border border-white/10 bg-charcoal/80 py-3">
          <p className="text-2xl font-bold text-cream">{data?.totalStops ?? '—'}</p>
          <p className="text-cream/45">Arrêts</p>
        </div>
        <div className="rounded-xl border border-emerald-500/25 bg-emerald-950/20 py-3">
          <p className="text-2xl font-bold text-emerald-200">{data?.ready ?? '—'}</p>
          <p className="text-cream/45">Prêtes</p>
        </div>
        <div className="rounded-xl border border-violet-500/25 bg-violet-950/20 py-3">
          <p className="text-2xl font-bold text-violet-200">{data?.enRoute ?? '—'}</p>
          <p className="text-cream/45">En route</p>
        </div>
      </div>

      {data?.routeTotalKm != null && data.routeTotalKm > 0 && (
        <p className="text-center text-xs text-cream/40">
          Parcours optimisé · ~{formatDistanceKm(data.routeTotalKm)} au total
          {data.originFromGps ? ' depuis votre position' : ' depuis la pizzeria'}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onRefresh}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/15 py-2.5 text-sm text-cream/70"
        >
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          Actualiser
        </button>
        <button
          type="button"
          onClick={onReoptimize}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-violet-600 py-2.5 text-sm font-bold text-white"
        >
          {reoptimizing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Route className="h-4 w-4" />}
          Ré-optimiser
        </button>
      </div>

      {fullRouteUrl && stops.length > 1 && (
        <a
          href={fullRouteUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-violet-500/40 bg-violet-500/15 py-3 text-sm font-bold text-violet-100"
        >
          <Navigation className="h-4 w-4" />
          Tournée complète — Google Maps (tous les arrêts)
        </a>
      )}

      {error && (
        <p className="rounded-xl border border-red-500/30 bg-red-950/40 px-4 py-2 text-sm text-red-200">
          {error}
        </p>
      )}

      {stops.length > 0 && (
        <DeliveryTrackingMapLazy
          depot={depot}
          destination={focusDest}
          clientStops={clientStops}
          driverPosition={driverPosition ?? origin ?? null}
          selectedStopId={focusStop?.id}
          heightClass="h-[min(300px,45vh)]"
          showAddressBar
        />
      )}

      {loading && stops.length === 0 ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
        </div>
      ) : stops.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-charcoal/60 py-12 text-center">
          <Navigation className="mx-auto h-10 w-10 text-cream/25" />
          <p className="mt-3 text-sm text-cream/50">Aucune livraison en cours</p>
        </div>
      ) : (
        <ol className="space-y-3">
          {stops.map((stop, idx) => (
            <StopCard key={stop.id} stop={stop} isNext={idx === 0} origin={origin} />
          ))}
        </ol>
      )}

      {nextStop?.trackingToken && (
        <Link
          href={`/livreur/${nextStop.trackingToken}?hub=1`}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-tomato py-4 text-sm font-bold text-white shadow-lg shadow-tomato/20"
        >
          Livraison suivante — #{nextStop.orderNumber}
          <ChevronRight className="h-5 w-5" />
        </Link>
      )}
    </>
  )
}

function DayRecapTab({
  recap,
  loading,
  onRefresh,
}: {
  recap: DriverDayRecap | null
  loading: boolean
  onRefresh: () => void
}) {
  if (loading && !recap) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
      </div>
    )
  }

  if (!recap) {
    return <p className="py-12 text-center text-sm text-cream/50">Récap indisponible</p>
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm capitalize text-cream/60">{recap.dateLabel}</p>
        <button type="button" onClick={onRefresh} className="text-xs text-violet-300 underline">
          Actualiser
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/25 py-3">
          <p className="text-2xl font-bold text-emerald-200">{recap.deliveredCount}</p>
          <p className="text-cream/45">Livrées</p>
        </div>
        <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 py-3">
          <p className="text-2xl font-bold text-amber-200">{recap.issueCount}</p>
          <p className="text-cream/45">Problèmes</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-charcoal/80 py-3">
          <p className="text-lg font-bold text-cream">{formatEUR(recap.totalRevenueCents)}</p>
          <p className="text-cream/45">CA livré</p>
        </div>
      </div>

      {recap.items.length === 0 ? (
        <p className="py-10 text-center text-sm text-cream/45">Aucune livraison clôturée aujourd&apos;hui</p>
      ) : (
        <ul className="space-y-2">
          {recap.items.map((item) => (
            <li
              key={item.id}
              className={cn(
                'rounded-xl border px-4 py-3 text-sm',
                item.status === 'DELIVERED'
                  ? 'border-emerald-500/25 bg-emerald-950/15'
                  : 'border-amber-500/25 bg-amber-950/15',
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-bold text-cream">#{item.orderNumber}</p>
                  <p className="text-cream/70">{item.customerName ?? 'Client'}</p>
                  {item.deliveryCity && (
                    <p className="text-xs text-cream/45">{item.deliveryCity}</p>
                  )}
                </div>
                <div className="text-right">
                  {item.status === 'DELIVERED' ? (
                    <CheckCircle2 className="ml-auto h-4 w-4 text-emerald-400" />
                  ) : (
                    <AlertTriangle className="ml-auto h-4 w-4 text-amber-400" />
                  )}
                  <p className="mt-1 text-xs font-semibold text-cream/80">
                    {formatEUR(item.total)}
                  </p>
                  <p className="text-[10px] text-cream/40">
                    {new Date(item.completedAt).toLocaleTimeString('fr-FR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
              {item.issueReason && (
                <p className="mt-1 text-xs text-amber-200/90">{item.issueReason}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

function StopCard({
  stop,
  isNext,
  origin,
}: {
  stop: DeliveryStop
  isNext: boolean
  origin?: { lat: number; lng: number } | null
}) {
  const addr = addressLine(stop.deliveryAddress, stop.deliveryPostalCode, stop.deliveryCity)
  const slot = scheduledSlotLabel(stop.scheduledAt)
  const legKm = stop.legDistanceKm ?? stop.distanceKm
  const myDriverId = getStoredDriverUserId()
  const assignedToMe = Boolean(stop.driverId && stop.driverId === myDriverId)
  const navDest = {
    lat: stop.deliveryLat,
    lng: stop.deliveryLng,
    address: addr,
    label: stop.customerName ? `${stop.customerName} — #${stop.orderNumber}` : `#${stop.orderNumber}`,
  }

  const content = (
    <article
      className={cn(
        'rounded-xl border p-4 transition',
        isNext
          ? 'border-tomato/40 bg-tomato/10 shadow-md shadow-tomato/10'
          : 'border-white/10 bg-charcoal/80',
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold',
            isNext ? 'bg-tomato text-white' : 'bg-white/10 text-cream/60',
          )}
        >
          {stop.routePosition}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="font-bold text-cream">#{stop.orderNumber}</p>
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                stop.status === 'OUT_FOR_DELIVERY'
                  ? 'bg-violet-500/20 text-violet-200'
                  : 'bg-emerald-500/20 text-emerald-200',
              )}
            >
              {deliveryQueueStatusLabel(stop.status)}
            </span>
          </div>
          <p className="text-sm text-cream/75">{stop.customerName ?? 'Client'}</p>
          {assignedToMe && (
            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-300">
              Attribuée par la cuisine
            </p>
          )}
          {stop.customerPhone && (
            <a
              href={`tel:${stop.customerPhone}`}
              onClick={(e) => e.stopPropagation()}
              className="mt-0.5 flex items-center gap-1 text-xs font-medium text-tomato-light"
            >
              <Phone className="h-3 w-3" />
              {stop.customerPhone}
            </a>
          )}
          <p className="mt-1 flex items-start gap-1 text-xs text-cream/55">
            <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
            {addr}
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-cream/45">
            <span>{formatEUR(stop.total)}</span>
            {legKm != null && <span>· {formatDistanceKm(legKm)} depuis {isNext ? 'vous' : 'arrêt préc.'}</span>}
            {slot && <span>· Créneau {slot}</span>}
          </div>
        </div>
        <ChevronRight className="h-5 w-5 shrink-0 text-cream/30" />
      </div>
      <NavigationLauncher destination={navDest} origin={origin} variant="inline" />
      {stop.trackingToken && (
        <Link
          href={`/livreur/${stop.trackingToken}?hub=1`}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-tomato/15 py-2.5 text-xs font-bold text-tomato-light"
        >
          Ouvrir la fiche livraison
          <ChevronRight className="h-4 w-4" />
        </Link>
      )}
    </article>
  )

  return content
}
