'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Clock, Menu, Phone, X } from 'lucide-react'
import { PIZZERIA } from '@/lib/pizzeria-content'
import { getOpenStatus, type OpenStatus } from '@/lib/hours'
import { fetchOpenHours } from '@/lib/time-slots-api'
import { CommanderButton, CommanderButtonMobile } from '@/components/checkout/CommanderButton'
import { BrandLogo } from '@/components/brand/BrandLogo'
import { cn } from '@/lib/cn'

import { SITE_MAIN_OFFSET } from '@/lib/site-layout'

/** @deprecated utiliser SITE_MAIN_OFFSET depuis @/lib/site-layout */
export const LANDING_HEADER_OFFSET = SITE_MAIN_OFFSET

const NAV = [
  { href: '/#carte', label: 'Carte' },
  { href: '/#livraison', label: 'Livraison' },
  { href: '/#offres', label: 'Offres' },
]

function HeaderStatus() {
  const [status, setStatus] = useState<OpenStatus | null>(null)

  useEffect(() => {
    void fetchOpenHours().then((remote) => {
      if (remote) {
        setStatus({
          isOpen: remote.isOpen,
          label: remote.label,
          sublabel: remote.sublabel,
        })
      } else {
        setStatus(getOpenStatus())
      }
    })
  }, [])

  const isOpen = status?.isOpen ?? false

  return (
    <div
      className={cn(
        'border-b text-xs sm:text-sm',
        isOpen
          ? 'border-emerald-500/20 bg-emerald-950/50 text-emerald-100'
          : 'border-stone-600/30 bg-stone-900/70 text-stone-300'
      )}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-1.5 md:px-6">
        <span className="flex min-w-0 items-center gap-2 font-semibold">
          <span
            className={cn(
              'h-1.5 w-1.5 shrink-0 rounded-full',
              isOpen ? 'animate-pulse-soft bg-emerald-400' : 'bg-stone-500'
            )}
          />
          <span className="truncate">{status?.label ?? 'Horaires'}</span>
        </span>

        <span className="hidden shrink-0 text-white/40 sm:inline">·</span>

        <span className="hidden truncate text-white/75 sm:block">
          {status?.sublabel ?? `${PIZZERIA.hours.open}h – ${PIZZERIA.hours.close}h`}
        </span>

        <span className="ml-auto flex shrink-0 items-center gap-1.5 text-white/60">
          <Clock className="h-3.5 w-3.5 text-white/50" />
          <span className="whitespace-nowrap">
            {PIZZERIA.daysOpen} · {PIZZERIA.hours.open}h – {PIZZERIA.hours.close}h
          </span>
        </span>
      </div>
    </div>
  )
}

export function LandingHeader() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 transition-all duration-300',
        scrolled ? 'shadow-lg shadow-black/25' : ''
      )}
    >
      <HeaderStatus />

      <div
        className={cn(
          'border-b border-white/5 transition-colors duration-300',
          scrolled ? 'bg-charcoal/95 backdrop-blur-md' : 'bg-charcoal/80 backdrop-blur-sm'
        )}
      >
        <div className="mx-auto grid max-w-7xl grid-cols-[1fr_auto] items-center gap-4 px-4 py-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:px-6 md:py-3.5">
          <Link href="/" className="min-w-0 justify-self-start" aria-label="La Z Pizza — accueil">
            <BrandLogo className="h-10 md:h-12" />
          </Link>

          <nav
            className="hidden items-center justify-center gap-1 md:flex md:gap-0.5"
            aria-label="Navigation principale"
          >
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg px-3.5 py-2 text-sm font-medium text-cream/75 transition hover:bg-white/5 hover:text-cream lg:px-4"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center justify-end gap-1 justify-self-end sm:gap-2">
            <a
              href={PIZZERIA.phoneHref}
              className="hidden items-center gap-2 rounded-full border border-cream/15 px-3.5 py-2 text-sm text-cream/85 transition hover:border-cream/30 hover:bg-white/5 lg:flex"
            >
              <Phone className="h-4 w-4 shrink-0" />
              <span className="whitespace-nowrap">{PIZZERIA.phone}</span>
            </a>
            <CommanderButton />
            <button
              type="button"
              className="rounded-lg p-2 text-cream md:hidden"
              onClick={() => setMobileOpen((open) => !open)}
              aria-expanded={mobileOpen}
              aria-label="Menu"
            >
              {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {mobileOpen && (
        <nav className="border-b border-white/10 bg-charcoal/98 px-4 py-3 backdrop-blur-md md:hidden">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className="block rounded-lg px-2 py-2.5 text-sm font-medium text-cream/90 hover:bg-white/5"
            >
              {item.label}
            </Link>
          ))}
          <a
            href={PIZZERIA.phoneHref}
            className="mt-1 flex items-center gap-2 rounded-lg px-2 py-2.5 text-sm text-tomato-light hover:bg-white/5"
          >
            <Phone className="h-4 w-4" />
            {PIZZERIA.phone}
          </a>
          <div className="mt-3">
            <CommanderButtonMobile />
          </div>
        </nav>
      )}
    </header>
  )
}
