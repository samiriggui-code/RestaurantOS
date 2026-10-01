'use client'

import { useEffect, useState } from 'react'
import { BrandLogo } from '@/components/brand/BrandLogo'
import { PIZZERIA, PROMO } from '@/lib/pizzeria-content'
import { PLACEHOLDER_IMAGES } from '@/lib/placeholder-images'

const SLIDES = Array.from(
  new Set([
    PLACEHOLDER_IMAGES.hero,
    PLACEHOLDER_IMAGES.oven,
    PLACEHOLDER_IMAGES.promo,
    PLACEHOLDER_IMAGES.delivery,
    PLACEHOLDER_IMAGES.categories.tomate,
    PLACEHOLDER_IMAGES.categories.creme,
    PLACEHOLDER_IMAGES.categories.z,
    ...PLACEHOLDER_IMAGES.gallery,
  ]),
)

export function KioskScreensaver({ onWake }: { onWake: () => void }) {
  const [slide, setSlide] = useState(0)

  useEffect(() => {
    const id = window.setInterval(() => {
      setSlide((s) => (s + 1) % SLIDES.length)
    }, 7000)
    return () => window.clearInterval(id)
  }, [])

  return (
    <button
      type="button"
      onClick={onWake}
      className="relative flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden text-left"
      aria-label="Toucher pour commander"
    >
      {SLIDES.map((src, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={`${src}-${i}`}
          src={src}
          alt=""
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ${
            i === slide ? 'opacity-100' : 'opacity-0'
          }`}
        />
      ))}
      <div className="absolute inset-0 bg-gradient-to-t from-charcoal via-charcoal/55 to-charcoal/25" />

      <div className="relative z-10 flex flex-1 flex-col items-center justify-end px-6 pb-16 pt-10 text-center">
        <BrandLogo centered className="mb-6 h-16 w-auto drop-shadow-lg md:h-20" />
        <p className="text-sm uppercase tracking-[0.35em] text-cream/55">{PIZZERIA.tagline}</p>

        <div className="mt-10 max-w-lg rounded-3xl border border-white/15 bg-charcoal/70 px-6 py-5 backdrop-blur-md">
          <p className="text-[10px] uppercase tracking-[0.3em] text-tomato-light">{PROMO.title}</p>
          <p className="mt-2 font-display text-2xl text-cream md:text-3xl">{PROMO.text}</p>
          <p className="mt-2 text-sm text-cream/55">{PROMO.detail}</p>
        </div>

        <p className="mt-10 animate-pulse text-lg font-semibold text-cream md:text-xl">
          Touchez l&apos;écran pour commander
        </p>
        <p className="mt-2 text-xs text-cream/40">
          {PIZZERIA.hours.open}h – {PIZZERIA.hours.close}h · {PIZZERIA.city}
        </p>
      </div>
    </button>
  )
}
