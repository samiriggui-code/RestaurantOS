'use client'

import { Clock, MapPin, Navigation } from 'lucide-react'
import { PIZZERIA } from '@/lib/pizzeria-content'
import { cn } from '@/lib/cn'

const { lat, lng } = PIZZERIA.coordinates
const MAP_EMBED_SRC = `https://www.google.com/maps?q=${lat},${lng}&hl=fr&z=17&output=embed`
const MAP_LINK = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`

type PizzeriaMapProps = {
  className?: string
}

export function PizzeriaMap({ className }: PizzeriaMapProps) {
  return (
    <div
      className={cn(
        'relative min-h-[300px] w-full overflow-hidden bg-charcoal lg:h-full lg:min-h-full',
        className
      )}
    >
      <iframe
        title={`${PIZZERIA.name} — ${PIZZERIA.fullAddress}`}
        src={MAP_EMBED_SRC}
        className="absolute inset-0 h-full w-full border-0"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        allowFullScreen
      />

      <div
        className="pointer-events-none absolute left-1/2 top-[44%] z-10 -translate-x-1/2 -translate-y-full"
        aria-hidden
      >
        <div className="relative flex flex-col items-center">
          <div className="rounded-2xl border-2 border-white bg-tomato px-2.5 py-1 shadow-lg shadow-black/40">
            <MapPin className="h-5 w-5 text-white" strokeWidth={2.5} />
          </div>
          <div className="h-0 w-0 border-x-[7px] border-x-transparent border-t-[9px] border-t-tomato" />
          <span className="absolute -bottom-1 h-2.5 w-2.5 animate-pulse rounded-full bg-tomato/50 blur-[2px]" />
        </div>
      </div>

      <div className="absolute left-3 top-3 z-20 max-w-[200px] rounded-xl border border-white/15 bg-charcoal/95 p-3 shadow-xl backdrop-blur-md sm:max-w-[220px]">
        <p className="font-display text-sm font-bold leading-tight text-cream">{PIZZERIA.name}</p>
        <p className="mt-1 text-[11px] leading-snug text-cream/60">{PIZZERIA.fullAddress}</p>
        <p className="mt-2 flex items-center gap-1 text-[10px] text-cream/50">
          <Clock className="h-3 w-3 shrink-0 text-tomato-light" />
          {PIZZERIA.daysOpen} · {PIZZERIA.hours.open}h – {PIZZERIA.hours.close}h
        </p>
        <a
          href={PIZZERIA.phoneHref}
          className="mt-1 block text-xs font-semibold text-tomato-light hover:underline"
        >
          {PIZZERIA.phone}
        </a>
        <a
          href={MAP_LINK}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-lg bg-tomato py-1.5 text-[11px] font-bold text-white hover:bg-tomato-light"
        >
          <Navigation className="h-3 w-3" />
          Itinéraire
        </a>
      </div>
    </div>
  )
}
