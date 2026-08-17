'use client'

import { Maximize2, Minimize2 } from 'lucide-react'
import { useFullscreen } from '@/lib/use-fullscreen'
import { cn } from '@/lib/cn'

type Props = {
  className?: string
  size?: 'sm' | 'md'
}

export function DeviceFullscreenButton({ className, size = 'sm' }: Props) {
  const { active, toggle } = useFullscreen()

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-xl border border-white/15 font-medium text-cream/80 hover:bg-white/5',
        size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm',
        className
      )}
      title={active ? 'Quitter le plein écran' : 'Plein écran'}
    >
      {active ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
      {active ? 'Réduire' : 'Plein écran'}
    </button>
  )
}
