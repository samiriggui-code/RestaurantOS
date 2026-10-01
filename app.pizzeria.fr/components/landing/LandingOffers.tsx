'use client'

import { useState } from 'react'
import { CalendarDays, X } from 'lucide-react'
import { PROMO } from '@/lib/pizzeria-content'
import { weeklyPromoPrice } from '@/lib/pizza-sizes'
import { cn } from '@/lib/cn'

const WEEK_DAYS = [
  { label: 'L', dow: 1 },
  { label: 'M', dow: 2 },
  { label: 'M', dow: 3 },
  { label: 'J', dow: 4 },
  { label: 'V', dow: 5 },
  { label: 'S', dow: 6 },
  { label: 'D', dow: 0 },
] as const

export function LandingOffers() {
  const [showInactiveDialog, setShowInactiveDialog] = useState(false)
  const todayDow = new Date().getDay()
  const megaPromoActiveToday = weeklyPromoPrice('tomate', '40', 'pickup') != null

  return (
    <>
      <section id="offres" className="border-t border-white/5 bg-charcoal py-20">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <article className="relative overflow-hidden rounded-3xl border border-tomato/40 bg-gradient-to-br from-charcoal-soft to-charcoal p-8 shadow-card md:col-span-2">
              <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-tomato-light">
                    Semaine
                  </span>
                  <h3 className="mt-2 font-display text-4xl leading-tight text-cream sm:text-5xl">
                    <em className="text-flame-gradient not-italic font-semibold">Méga</em>&nbsp;à 18&nbsp;€
                  </h3>
                  <p className="mt-4 max-w-md text-sm text-cream/60">
                    {PROMO.text}. Retrait en boutique uniquement.
                  </p>
                  <p className="mt-2 text-xs text-cream/45">{PROMO.detail}</p>
                  <div className="mt-6 flex flex-wrap items-center gap-3">
                    {megaPromoActiveToday ? (
                      <a
                        href="/?promo=mega18#carte"
                        className="inline-flex items-center rounded-full bg-flame-gradient px-6 py-3 text-sm font-medium text-white shadow-glow transition hover:brightness-110"
                      >
                        En profiter
                      </a>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowInactiveDialog(true)}
                        className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm font-medium text-cream/40"
                      >
                        En profiter
                      </button>
                    )}
                    <span className="text-xs text-cream/40">Valable toute l&apos;année</span>
                  </div>
                </div>

                <div className="shrink-0 rounded-2xl border border-white/10 bg-black/30 px-6 py-5 text-center">
                  <p className="flex items-center justify-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-tomato-light">
                    <CalendarDays className="h-3.5 w-3.5" />
                    Jours de la promo
                  </p>
                  <div className="mt-3 flex items-center justify-center gap-1.5">
                    {WEEK_DAYS.map((d) => {
                      const dayActive = d.dow >= 1 && d.dow <= 4
                      const isToday = d.dow === todayDow
                      return (
                        <span
                          key={d.dow}
                          className={cn(
                            'flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold',
                            dayActive
                              ? 'bg-flame-gradient text-white'
                              : 'border border-white/10 text-cream/30',
                            isToday && 'ring-2 ring-white/70 ring-offset-2 ring-offset-charcoal-soft',
                          )}
                        >
                          {d.label}
                        </span>
                      )
                    })}
                  </div>
                  <p className="mt-3 text-sm font-semibold text-cream">Lundi → Jeudi</p>
                  <p className="text-[11px] text-cream/40">
                    {megaPromoActiveToday ? 'Active aujourd’hui' : 'Pas active aujourd’hui'}
                  </p>
                </div>
              </div>
              <div
                className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-tomato opacity-20 blur-3xl"
                aria-hidden
              />
            </article>

            <article className="rounded-3xl border border-white/10 bg-charcoal-soft p-8">
              <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-tomato-light">
                Fidélité
              </span>
              <h3 className="mt-2 font-display text-3xl text-cream">10ème offerte</h3>
              <p className="mt-3 text-sm text-cream/60">
                1 point par euro dépensé. À la 10ème pizza, la pizza medium est offerte.
              </p>
              <a
                href="#carte"
                className="mt-6 inline-flex items-center rounded-full border border-white/15 px-5 py-2.5 text-sm text-cream/85 transition hover:border-tomato/50 hover:text-cream"
              >
                Commander
              </a>
            </article>
          </div>
        </div>
      </section>

      {showInactiveDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-charcoal-soft p-6 text-center shadow-2xl">
            <button
              type="button"
              onClick={() => setShowInactiveDialog(false)}
              className="ml-auto flex text-cream/40 hover:text-cream"
              aria-label="Fermer"
            >
              <X className="h-5 w-5" />
            </button>
            <p className="mt-1 text-sm text-cream">
              Offre valable uniquement du lundi au jeudi — tarif normal appliqué aujourd&apos;hui.
            </p>
            <button
              type="button"
              onClick={() => setShowInactiveDialog(false)}
              className="mt-5 w-full rounded-full bg-flame-gradient px-5 py-2.5 text-sm font-semibold text-white"
            >
              Compris
            </button>
          </div>
        </div>
      )}
    </>
  )
}
