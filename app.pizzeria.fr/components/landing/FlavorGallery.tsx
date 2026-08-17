import { HeroVideo } from '@/components/ui/HeroVideo'
import { KITCHEN_VIDEO } from '@/lib/media'

export function FlavorGallery() {
  return (
    <section className="bg-charcoal-soft py-16 md:py-20">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <div className="mb-8 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-tomato-light">
            En cuisine
          </p>
          <h2 className="mt-3 font-display text-3xl font-bold text-cream md:text-4xl">
            Chaud, fondant, généreux
          </h2>
        </div>
        <div className="overflow-hidden rounded-3xl border border-white/10 shadow-2xl shadow-black/40">
          <HeroVideo src={KITCHEN_VIDEO} className="aspect-video md:aspect-[21/9]" />
        </div>
      </div>
    </section>
  )
}
