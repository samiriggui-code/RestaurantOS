'use client'

import { useCallback, useEffect, useState } from 'react'
import { useFeedbackState } from '@/lib/use-feedback-state'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Loader2,
  MapPin,
  Phone,
  User,
} from 'lucide-react'
import { DELIVERY_ISSUE_REASONS } from '@/lib/delivery-handover'

type DeliveryIssueReason = (typeof DELIVERY_ISSUE_REASONS)[number]['value']
import { NavigationLauncher } from '@/components/delivery/NavigationLauncher'
import { DeliveryTrackingMapLazy } from '@/components/delivery/DeliveryTrackingMapLazy'
import { postDriverLocation } from '@/lib/driver-api'
import { fetchDriverStops } from '@/lib/driver-api'
import {
  formatGeolocationError,
  getGeolocationSupport,
  type GeolocationSupport,
} from '@/lib/geolocation-support'
import { PIZZERIA_NAV } from '@/lib/navigation-apps'
import { PIZZERIA } from '@/lib/pizzeria-content'
import { formatEUR } from '@/lib/money'
import { addressLine } from '@/lib/route-optimize'

const ACTIVE_DELIVERY_KEY = 'pizzeria_driver_active_delivery'

type Props = { token: string }

type DriverOrder = {
  orderNumber: number
  status: string
  customerName: string | null
  customerPhone: string | null
  deliveryAddress: string | null
  deliveryPostalCode: string | null
  deliveryCity: string | null
  deliveryLat?: number | null
  deliveryLng?: number | null
  notes: string | null
  total: number
}

export function DriverCourierView({ token }: Props) {
  const searchParams = useSearchParams()
  const fromHub = searchParams.get('hub') === '1'

  const [order, setOrder] = useState<DriverOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [gpsActive, setGpsActive] = useState(false)
  const { error, setError } = useFeedbackState()
  const [lastSent, setLastSent] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [issueOpen, setIssueOpen] = useState(false)
  const [issueReason, setIssueReason] = useState<DeliveryIssueReason>(DELIVERY_ISSUE_REASONS[0].value)
  const [issueNote, setIssueNote] = useState('')
  const [issueSending, setIssueSending] = useState(false)
  const [done, setDone] = useState<'delivered' | 'issue' | null>(null)
  const [nextToken, setNextToken] = useState<string | null>(null)
  const [driverPos, setDriverPos] = useState<{ lat: number; lng: number } | null>(null)
  const [driverTrail, setDriverTrail] = useState<Array<{ lat: number; lng: number }>>([])
  const [geoSupport, setGeoSupport] = useState<GeolocationSupport | null>(null)

  useEffect(() => {
    setGeoSupport(getGeolocationSupport())
  }, [])

  const fetchOrder = useCallback(async () => {
    try {
      sessionStorage.setItem(ACTIVE_DELIVERY_KEY, token)
      const res = await fetch(`/api/public/orders/track-token/${encodeURIComponent(token)}/driver`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Commande introuvable')
      setOrder(data.order)
      if (data.order.status === 'DELIVERED') setDone('delivered')
      if (data.order.status === 'DELIVERY_ISSUE') setDone('issue')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chargement impossible')
    } finally {
      setLoading(false)
    }
  }, [token])

  const loadNextStop = useCallback(async () => {
    try {
      const data = await fetchDriverStops(
        driverPos ? { driverLat: driverPos.lat, driverLng: driverPos.lng } : undefined,
      )
      const next = data.stops.find((s) => s.trackingToken && s.trackingToken !== token)
      setNextToken(next?.trackingToken ?? null)
    } catch {
      setNextToken(null)
    }
  }, [token, driverPos])

  useEffect(() => {
    void fetchOrder()
  }, [fetchOrder])

  useEffect(() => {
    if (done) void loadNextStop()
  }, [done, loadNextStop])

  useEffect(() => {
    if (!gpsActive) return

    const support = getGeolocationSupport()
    if (!support.available) {
      setError(support.message)
      setGpsActive(false)
      return
    }

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setDriverPos(coords)
        setDriverTrail((prev) => {
          const last = prev[prev.length - 1]
          if (last && Math.abs(last.lat - coords.lat) < 0.00015 && Math.abs(last.lng - coords.lng) < 0.00015) {
            return prev
          }
          return [...prev, coords].slice(-400)
        })
        void postDriverLocation(token, coords)
          .then((data) => {
            setLastSent(new Date().toLocaleTimeString('fr-FR'))
            setError(null)
            if (data.order?.status) {
              setOrder((prev) => (prev ? { ...prev, status: data.order!.status } : prev))
            }
          })
          .catch((e) => setError(e instanceof Error ? e.message : 'Envoi impossible'))
      },
      (err) => setError(formatGeolocationError(err)),
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 },
    )

    return () => navigator.geolocation.clearWatch(id)
  }, [gpsActive, token])

  function toggleGps() {
    if (gpsActive) {
      setGpsActive(false)
      return
    }
    const support = getGeolocationSupport()
    setGeoSupport(support)
    if (!support.available) {
      setError(support.message)
      return
    }
    setError(null)
    setGpsActive(true)
  }

  function onNavigationLaunched() {
    if (gpsActive) return
    const support = getGeolocationSupport()
    setGeoSupport(support)
    if (!support.available) {
      setError(support.message)
      return
    }
    setError(null)
    setGpsActive(true)
  }

  const addr = order
    ? addressLine(order.deliveryAddress, order.deliveryPostalCode, order.deliveryCity)
    : ''

  const navDest = order
    ? {
        lat: order.deliveryLat,
        lng: order.deliveryLng,
        address: addr,
        label: order.customerName ? `${order.customerName} — #${order.orderNumber}` : `#${order.orderNumber}`,
      }
    : null

  async function confirmDelivery() {
    setConfirming(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/public/orders/track-token/${encodeURIComponent(token)}/driver-confirm`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) },
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Confirmation impossible')
      setDone('delivered')
      setGpsActive(false)
      sessionStorage.removeItem(ACTIVE_DELIVERY_KEY)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setConfirming(false)
    }
  }

  async function reportIssue() {
    setIssueSending(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/public/orders/track-token/${encodeURIComponent(token)}/driver-issue`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: issueReason, note: issueNote }),
        },
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Envoi impossible')
      setDone('issue')
      setIssueOpen(false)
      setGpsActive(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setIssueSending(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-6">
        <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
      </div>
    )
  }

  if (done === 'delivered') {
    return (
      <div className="mx-auto max-w-md space-y-5 p-6 pb-10 text-center">
        <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-400" />
        <h1 className="font-display text-2xl font-bold text-cream">Livraison confirmée</h1>
        <p className="text-sm text-cream/55">
          Commande #{order?.orderNumber} — cuisine et caisse notifiées.
        </p>
        {nextToken ? (
          <Link
            href={`/livreur/${nextToken}?hub=1`}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-tomato py-4 text-sm font-bold text-white"
          >
            Livraison suivante
            <ChevronRight className="h-5 w-5" />
          </Link>
        ) : (
          <>
            <p className="text-sm text-cream/50">Tournée terminée — retour pizzeria ?</p>
            <NavigationLauncher destination={PIZZERIA_NAV} variant="button" />
            <Link
              href="/livreur"
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 py-3 text-sm text-cream/70"
            >
              Retour à la tournée
            </Link>
          </>
        )}
      </div>
    )
  }

  if (done === 'issue') {
    return (
      <div className="mx-auto max-w-md space-y-5 p-6 pb-10 text-center">
        <AlertTriangle className="mx-auto h-14 w-14 text-amber-400" />
        <h1 className="font-display text-2xl font-bold text-cream">Problème signalé</h1>
        <p className="text-sm text-cream/55">
          Retournez à la pizzeria — commande #{order?.orderNumber} reprise en cuisine.
        </p>
        <Link
          href="/livreur"
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-600 py-3 text-sm font-bold text-white"
        >
          Voir la tournée
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto min-h-[100dvh] max-w-md space-y-4 px-4 pb-10 pt-2">
      <div className="flex items-center gap-2">
        <Link
          href={fromHub ? '/livreur' : '/livreur'}
          className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-cream/60"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Tournée
        </Link>
        {order && (
          <span className="ml-auto text-sm font-bold text-tomato-light">
            #{order.orderNumber} · {formatEUR(order.total / 100)}
          </span>
        )}
      </div>

      {error && (
        <p className="rounded-xl border border-red-500/30 bg-red-950/40 px-4 py-2 text-sm text-red-200">
          {error}
        </p>
      )}

      {order && navDest && (
        <DeliveryTrackingMapLazy
          depot={{
            lat: PIZZERIA.coordinates.lat,
            lng: PIZZERIA.coordinates.lng,
            label: PIZZERIA.name,
            address: PIZZERIA.fullAddress,
          }}
          destination={
            order.deliveryLat != null && order.deliveryLng != null
              ? {
                  lat: order.deliveryLat,
                  lng: order.deliveryLng,
                  label: order.customerName
                    ? `${order.customerName} — #${order.orderNumber}`
                    : `#${order.orderNumber}`,
                  address: addr || undefined,
                }
              : null
          }
          driverPosition={driverPos}
          driverTrail={driverTrail.length > 0 ? driverTrail : undefined}
          heightClass="h-[min(280px,40vh)]"
          showAddressBar
        />
      )}

      {geoSupport?.devHttpsUrl && (
        <div className="rounded-xl border border-violet-500/30 bg-violet-950/30 px-4 py-3 text-xs text-cream/80">
          <p className="font-medium text-violet-200">GPS bloqué en HTTP</p>
          <p className="mt-1 text-cream/60">
            Sur le PC : <code className="rounded bg-black/30 px-1">npm run dev:mobile</code>, puis ouvrez :
          </p>
          <a href={geoSupport.devHttpsUrl} className="mt-2 block break-all font-mono text-violet-300 underline">
            {geoSupport.devHttpsUrl}
          </a>
        </div>
      )}

      {order && navDest && (
        <div className="space-y-3 rounded-xl border border-white/10 bg-charcoal/80 p-4 text-sm">
          <p className="text-[10px] font-bold uppercase tracking-wide text-violet-300/80">
            Étape 1 — Aller chez le client
          </p>
          {order.customerName && (
            <p className="flex items-center gap-2 text-lg font-semibold text-cream">
              <User className="h-4 w-4 text-cream/50" />
              {order.customerName}
            </p>
          )}
          {order.customerPhone && (
            <a
              href={`tel:${order.customerPhone}`}
              className="flex items-center justify-center gap-2 rounded-xl bg-tomato/15 py-3 text-base font-bold text-tomato-light"
            >
              <Phone className="h-5 w-5" />
              Appeler le client
            </a>
          )}
          {addr && (
            <p className="flex items-start gap-2 text-cream/80">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
              {addr}
            </p>
          )}
          <NavigationLauncher
            destination={navDest}
            origin={driverPos}
            onLaunched={onNavigationLaunched}
          />
        </div>
      )}

      <div className="rounded-xl border border-white/10 bg-charcoal/60 px-3 py-2 text-center text-[11px] text-cream/45">
        Après navigation : revenez sur <strong className="text-cream/70">cette page</strong> (onglet
        navigateur) pour le code client.
      </div>

      <button
        type="button"
        onClick={toggleGps}
        className={`flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold ${
          gpsActive ? 'bg-red-600 text-white' : 'border border-violet-500/40 bg-violet-500/15 text-violet-100'
        }`}
      >
        {gpsActive ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            GPS actif — arrêter
          </>
        ) : (
          <>
            <MapPin className="h-4 w-4" />
            Activer le suivi GPS client
          </>
        )}
      </button>
      {lastSent && (
        <p className="text-center text-xs text-cream/45">Position envoyée à {lastSent}</p>
      )}

      {(order?.status === 'OUT_FOR_DELIVERY' || order?.status === 'READY') && (
        <div className="space-y-3 rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4">
          <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-300/80">
            Étape 2 — Sur place : code client
          </p>
          <p className="text-sm font-semibold text-emerald-100">Confirmer la livraison</p>
          <p className="text-xs text-emerald-100/80">
            Demandez le code à 4 chiffres au client avant de valider.
          </p>
          <input
            type="text"
            inputMode="numeric"
            maxLength={4}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="••••"
            className="w-full rounded-xl border border-white/15 bg-charcoal px-4 py-4 text-center text-3xl font-bold tracking-[0.45em] text-cream"
          />
          <button
            type="button"
            disabled={code.length !== 4 || confirming || order.status !== 'OUT_FOR_DELIVERY'}
            onClick={() => void confirmDelivery()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-4 text-sm font-bold text-white disabled:opacity-40"
          >
            {confirming ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Livraison effectuée
          </button>
          {order.status === 'READY' && (
            <p className="text-center text-[11px] text-cream/45">
              Activez le GPS pour passer en « en route », puis validez avec le code.
            </p>
          )}
        </div>
      )}

      {order?.status === 'OUT_FOR_DELIVERY' && (
        <button
          type="button"
          onClick={() => setIssueOpen(true)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 py-3 text-sm font-semibold text-amber-100"
        >
          <AlertTriangle className="h-4 w-4" />
          Problème — retour pizzeria
        </button>
      )}

      {issueOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#1A1412] p-5">
            <h2 className="font-display text-lg font-bold text-cream">Signaler un problème</h2>
            <select
              value={issueReason}
              onChange={(e) => setIssueReason(e.target.value as DeliveryIssueReason)}
              className="mb-3 mt-3 w-full rounded-xl border border-white/10 bg-charcoal px-3 py-2.5 text-sm text-cream"
            >
              {DELIVERY_ISSUE_REASONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
            <textarea
              value={issueNote}
              onChange={(e) => setIssueNote(e.target.value)}
              placeholder="Précision (optionnel)"
              rows={2}
              className="mb-4 w-full rounded-xl border border-white/10 bg-charcoal px-3 py-2 text-sm text-cream"
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => setIssueOpen(false)} className="flex-1 rounded-xl border border-white/15 py-2.5 text-sm text-cream/70">
                Annuler
              </button>
              <button type="button" disabled={issueSending} onClick={() => void reportIssue()} className="flex-1 rounded-xl bg-amber-600 py-2.5 text-sm font-bold text-white">
                {issueSending ? 'Envoi…' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
