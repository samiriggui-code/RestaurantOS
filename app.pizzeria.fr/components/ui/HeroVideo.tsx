'use client'

import { PIZZERIA } from '@/lib/pizzeria-content'
import { cn } from '@/lib/cn'

type HeroVideoProps = {
  src: string
  className?: string
  videoClassName?: string
}

export function HeroVideo({ src, className, videoClassName }: HeroVideoProps) {
  return (
    <div className={cn('relative overflow-hidden bg-charcoal', className)}>
      <video
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        className={cn('h-full w-full object-cover', videoClassName)}
        aria-label="Vidéo pizza artisanale La Z Pizza"
      >
        <source src={src} type="video/mp4" />
      </video>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-charcoal/50 via-transparent to-charcoal/20" />
    </div>
  )
}
