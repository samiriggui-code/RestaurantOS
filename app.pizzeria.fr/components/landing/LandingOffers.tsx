import Link from 'next/link'
import { PROMO } from '@/lib/pizzeria-content'

export function LandingOffers() {
  return (
    <section id="offres" className="border-t border-white/5 bg-charcoal py-20">
      <div className="mx-auto max-w-7xl px-4 md:px-6">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <article className="relative overflow-hidden rounded-3xl border border-tomato/40 bg-gradient-to-br from-charcoal-soft to-charcoal p-8 shadow-card md:col-span-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-tomato-light">
              Semaine
            </span>
            <h3 className="mt-2 font-display text-4xl leading-tight text-cream sm:text-5xl">
              <em className="text-flame-gradient not-italic font-semibold">Méga</em> à 18&nbsp;€
            </h3>
            <p className="mt-4 max-w-md text-sm text-cream/60">
              {PROMO.text}. Retrait en boutique uniquement.
            </p>
            <p className="mt-2 text-xs text-cream/45">{PROMO.detail}</p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link
                href="/#carte"
                className="inline-flex items-center rounded-full bg-flame-gradient px-6 py-3 text-sm font-medium text-white shadow-glow transition hover:brightness-110"
              >
                En profiter
              </Link>
              <span className="text-xs text-cream/40">Valable toute l&apos;année</span>
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
            <Link
              href="/#carte"
              className="mt-6 inline-flex items-center rounded-full border border-white/15 px-5 py-2.5 text-sm text-cream/85 transition hover:border-tomato/50 hover:text-cream"
            >
              Commander
            </Link>
          </article>
        </div>
      </div>
    </section>
  )
}
