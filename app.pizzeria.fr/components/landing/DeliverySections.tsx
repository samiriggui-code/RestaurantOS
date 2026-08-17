import Link from 'next/link'
import { MapPin, Sparkles } from 'lucide-react'
import { FoodImage } from '@/components/ui/FoodImage'
import { PizzeriaMapLazy } from '@/components/landing/PizzeriaMapLazy'
import { DELIVERY_TOWNS, PIZZERIA, PROMO } from '@/lib/pizzeria-content'
import { PLACEHOLDER_IMAGES } from '@/lib/placeholder-images'

export function PromoSection() {
  return (
    <section id="offre" className="relative overflow-hidden bg-charcoal py-20">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <FoodImage
          src={PLACEHOLDER_IMAGES.promo}
          alt=""
          className="h-full w-full"
          overlay="none"
          sizes="100vw"
        />
      </div>
      <div className="absolute inset-0 bg-charcoal/85" aria-hidden />
      <div className="absolute inset-0 bg-gradient-to-r from-tomato/20 via-transparent to-amber-900/20" aria-hidden />
      <div className="relative mx-auto max-w-4xl px-4 text-center md:px-6">
        <Sparkles className="mx-auto h-8 w-8 text-amber-400" />
        <h2 className="mt-4 font-display text-3xl font-bold text-cream md:text-4xl">{PROMO.title}</h2>
        <p className="mt-4 text-2xl font-semibold text-tomato-light">{PROMO.text}</p>
        <p className="mt-3 text-cream/70">{PROMO.detail}</p>
        <Link
          href="/menu"
          className="mt-8 inline-block rounded-full bg-amber-500 px-8 py-3 font-bold text-charcoal transition hover:bg-amber-400"
        >
          Profiter de l&apos;offre
        </Link>
      </div>
    </section>
  )
}

export function DeliverySection() {
  return (
    <section id="livraison" className="border-y border-white/5 bg-charcoal-soft py-24">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-stretch lg:gap-12">
          <div className="order-2 flex flex-col justify-center lg:order-1">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-tomato-light">Livraison</p>
            <h2 className="mt-3 font-display text-4xl font-bold text-cream">
              On vient jusqu&apos;à chez vous
            </h2>
            <p className="mt-4 leading-relaxed text-cream/65">
              Pas envie de vous déplacer ? Nos livreurs couvrent{' '}
              <strong className="text-cream">{PIZZERIA.deliveryRadius}</strong>, tous les jours de{' '}
              {PIZZERIA.deliveryHours}.
            </p>
            <div className="mt-8 flex items-start gap-3 rounded-2xl border border-white/10 bg-charcoal/50 p-5">
              <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-tomato-light" />
              <div>
                <p className="font-semibold text-cream">Sur place</p>
                <p className="mt-1 text-sm text-cream/60">{PIZZERIA.fullAddress}</p>
                <a href={PIZZERIA.phoneHref} className="mt-2 inline-block text-sm font-medium text-tomato-light hover:underline">
                  {PIZZERIA.phone}
                </a>
              </div>
            </div>
          </div>

          <div className="order-1 h-full min-h-[300px] lg:order-2">
            <PizzeriaMapLazy className="h-full rounded-2xl border border-white/10 shadow-xl" />
          </div>
        </div>

        <div className="mt-16 rounded-3xl border border-white/10 bg-charcoal p-8">
          <h3 className="text-sm font-bold uppercase tracking-widest text-cream/50">Communes desservies</h3>
          <ul className="mt-6 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 lg:grid-cols-5">
            {DELIVERY_TOWNS.map((town) => (
              <li key={town} className="flex items-center gap-2 text-sm text-cream/80">
                <span className="text-tomato-light">✓</span>
                {town}
              </li>
            ))}
          </ul>
          <p className="mt-8 text-xs text-cream/40">
            Vérification de votre zone au moment du checkout en ligne.
          </p>
        </div>
      </div>
    </section>
  )
}
