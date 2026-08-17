import Link from 'next/link'
import { Clock, MapPin, Truck } from 'lucide-react'
import { HeroVideo } from '@/components/ui/HeroVideo'
import { PIZZERIA } from '@/lib/pizzeria-content'
import { HERO_VIDEO } from '@/lib/media'
import { cn } from '@/lib/cn'

import { SITE_MAIN_OFFSET } from '@/lib/site-layout'

export function HeroSection() {
  return (
    <section className={cn('relative min-h-[88vh] overflow-hidden bg-hero-glow', SITE_MAIN_OFFSET)}>
      <div className="absolute inset-0 bg-grain opacity-20" />

      <div className="relative mx-auto grid max-w-7xl gap-12 px-4 pb-20 md:px-6 lg:grid-cols-2 lg:items-center lg:py-16">
        <div className="animate-fade-up">
          <div className="mb-2 flex flex-wrap items-center gap-3 text-xs text-cream/55">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-charcoal/50 px-3 py-1 backdrop-blur-sm">
              <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-emerald-400" />
              Ouvert · {PIZZERIA.hours.open}h – {PIZZERIA.hours.close}h
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-charcoal/50 px-3 py-1 backdrop-blur-sm">
              <Truck className="h-3.5 w-3.5 text-tomato-light" />
              À emporter & livraison
            </span>
          </div>

          <h1 className="mt-6 font-display text-5xl leading-[1.05] tracking-tight text-cream sm:text-6xl md:text-7xl">
            Pizza artisanale{' '}
            <em className="text-flame-gradient not-italic font-semibold">à Fargues</em>
          </h1>

          <p className="mt-6 max-w-lg text-base leading-relaxed text-cream/65 sm:text-lg">
            Pâte faite maison, produits frais, recettes généreuses. Commandez en ligne pour un retrait
            rapide ou une livraison autour de Fargues-Saint-Hilaire.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/menu"
              className="inline-flex items-center justify-center rounded-full bg-flame-gradient px-7 py-3.5 text-sm font-semibold text-white shadow-glow transition hover:brightness-110"
            >
              Commander maintenant
            </Link>
            <a
              href="#carte"
              className="inline-flex items-center justify-center rounded-full border border-white/15 bg-charcoal/50 px-7 py-3.5 text-sm font-medium text-cream transition hover:border-tomato/50"
            >
              Découvrir la carte
            </a>
          </div>

          <dl className="mt-10 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-charcoal/40 px-4 py-3">
              <MapPin className="h-4 w-4 shrink-0 text-tomato-light" />
              <div className="leading-tight">
                <dt className="text-xs text-cream/45">Adresse</dt>
                <dd className="text-cream/85">{PIZZERIA.address}</dd>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-charcoal/40 px-4 py-3">
              <Clock className="h-4 w-4 shrink-0 text-tomato-light" />
              <div className="leading-tight">
                <dt className="text-xs text-cream/45">Horaires</dt>
                <dd className="text-cream/85">
                  {PIZZERIA.daysOpen} · {PIZZERIA.hours.open}h — {PIZZERIA.hours.close}h
                </dd>
              </div>
            </div>
          </dl>
        </div>

        <div className="relative animate-fade-up" style={{ animationDelay: '0.12s' }}>
          <div className="absolute -inset-8 rounded-[2rem] bg-tomato/20 opacity-40 blur-3xl" />
          <div className="relative overflow-hidden rounded-[2rem] border border-white/10 shadow-card">
            <HeroVideo src={HERO_VIDEO} className="aspect-[4/5] min-h-[420px]" />
            <span className="absolute right-4 top-4 rounded-full border border-emerald-500/40 bg-emerald-950/80 px-3 py-1 text-xs font-medium text-emerald-300 backdrop-blur">
              Livraison 10 km
            </span>
            <div className="absolute bottom-4 left-4 rounded-2xl border border-white/10 bg-charcoal/75 px-4 py-3 backdrop-blur-md">
              <p className="text-[10px] uppercase tracking-widest text-cream/45">Lun – Jeu</p>
              <p className="font-display text-lg text-cream">Méga à 18&nbsp;€</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
