'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useAppFeedback } from '@/components/feedback/AppFeedbackProvider'
import {
  formatGeolocationError,
  getGeolocationSupport,
  type GeolocationSupport,
} from '@/lib/geolocation-support'

export type DriverGpsPosition = {
  lat: number
  lng: number
  accuracy: number
  at: Date
}

function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}

type Options = {
  onSignificantMove?: (pos: DriverGpsPosition) => void
  moveThresholdMeters?: number
}

export function useDriverGps(options: Options = {}) {
  const { notifyError } = useAppFeedback()
  const { onSignificantMove, moveThresholdMeters = 120 } = options
  const [active, setActive] = useState(false)
  const [position, setPosition] = useState<DriverGpsPosition | null>(null)
  const [error, setErrorRaw] = useState<string | null>(null)
  const [support, setSupport] = useState<GeolocationSupport | null>(null)
  const lastTriggerRef = useRef<{ lat: number; lng: number } | null>(null)
  const onMoveRef = useRef(onSignificantMove)
  onMoveRef.current = onSignificantMove

  const setError = useCallback(
    (msg: string | null) => {
      setErrorRaw(msg)
      if (msg) notifyError(msg)
    },
    [notifyError],
  )

  useEffect(() => {
    setSupport(getGeolocationSupport())
  }, [])

  const start = useCallback(() => {
    const next = getGeolocationSupport()
    setSupport(next)
    if (!next.available) {
      setError(next.message)
      setActive(false)
      return
    }
    setError(null)
    setActive(true)
  }, [setError])

  const stop = useCallback(() => setActive(false), [])

  useEffect(() => {
    if (!active) return

    const geoSupport = getGeolocationSupport()
    if (!geoSupport.available) {
      setError(geoSupport.message)
      setActive(false)
      return
    }

    setError(null)
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const next: DriverGpsPosition = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          at: new Date(pos.timestamp),
        }
        setPosition(next)

        const prev = lastTriggerRef.current
        if (!prev) {
          lastTriggerRef.current = { lat: next.lat, lng: next.lng }
          onMoveRef.current?.(next)
          return
        }
        if (distanceMeters(prev, next) >= moveThresholdMeters) {
          lastTriggerRef.current = { lat: next.lat, lng: next.lng }
          onMoveRef.current?.(next)
        }
      },
      (err) => setError(formatGeolocationError(err)),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 },
    )

    return () => navigator.geolocation.clearWatch(id)
  }, [active, moveThresholdMeters, setError])

  return { active, position, error, support, start, stop, setActive }
}
