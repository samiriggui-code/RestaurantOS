'use client'

import { useCallback, useEffect, useState } from 'react'
import { RotateCw } from 'lucide-react'
import {
  canNativeLockOrientation,
  isLandscapeDeviceApk,
  lockDeviceLandscapeAsync,
  readDeviceOrientation,
} from '@/lib/device-orientation'
import { cn } from '@/lib/cn'

type Props = {
  className?: string
  /** Verrouille le paysage au chargement (KDS / tablette caisse). */
  autoLock?: boolean
}

export function DeviceOrientationButton({
  className,
  autoLock = true,
  forceShow = false,
}: Props & { forceShow?: boolean }) {
  const [orientation, setOrientation] = useState<'portrait' | 'landscape' | 'unknown'>('unknown')
  const [locking, setLocking] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const path =
    typeof window !== 'undefined' ? window.location.pathname : ''
  const onKitchen = path.startsWith('/kitchen')
  const show =
    forceShow ||
    onKitchen ||
    isLandscapeDeviceApk() ||
    canNativeLockOrientation()

  const applyLandscape = useCallback(async () => {
    setLocking(true)
    setHint(null)
    try {
      const result = await lockDeviceLandscapeAsync()
      if (result.ok) {
        setOrientation('landscape')
      } else if (result.message) {
        setHint(result.message)
      }
    } finally {
      setLocking(false)
      setOrientation(readDeviceOrientation())
    }
  }, [])

  useEffect(() => {
    setOrientation(readDeviceOrientation())
  }, [])

  useEffect(() => {
    if (!autoLock || !show) return
    void applyLandscape()
  }, [autoLock, show, applyLandscape])

  if (!show) return null

  const isLandscape = orientation === 'landscape'

  return (
    <div className={cn('flex flex-col items-end gap-1', className)}>
      <button
        type="button"
        onClick={() => void applyLandscape()}
        disabled={locking}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium',
          isLandscape
            ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-100'
            : 'border-amber-500/40 bg-amber-500/15 text-amber-100 hover:bg-amber-500/25',
        )}
        title="Forcer le mode paysage"
      >
        <RotateCw className={cn('h-4 w-4', locking && 'animate-spin')} />
        {isLandscape ? 'Paysage' : 'Passer en paysage'}
      </button>
      {hint && <p className="max-w-[14rem] text-right text-[10px] text-amber-300/90">{hint}</p>}
    </div>
  )
}
