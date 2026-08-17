import { Flame, Sparkles, Timer, Truck } from 'lucide-react'

const ITEMS = [
  {
    icon: Flame,
    title: 'Four à bois',
    text: 'Cuisson 90 secondes à 450°C pour une pâte croustillante et alvéolée.',
  },
  {
    icon: Truck,
    title: 'Livraison 10 km',
    text: 'Autour de Fargues-Saint-Hilaire, en scooter isotherme.',
  },
  {
    icon: Timer,
    title: 'Prête en 25 min',
    text: 'Suivez votre commande en temps réel dès la validation.',
  },
  {
    icon: Sparkles,
    title: 'Produits frais',
    text: 'Farine T55, tomates San Marzano, mozzarella di bufala.',
  },
] as const

export function LandingFeatures() {
  return (
    <section className="border-t border-white/5 bg-charcoal-soft/80 py-12 md:py-16">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-4 px-4 sm:grid-cols-2 lg:grid-cols-4 md:px-6">
        {ITEMS.map(({ icon: Icon, title, text }) => (
          <div
            key={title}
            className="rounded-3xl border border-white/10 bg-charcoal/60 p-6 transition hover:border-tomato/40 hover:shadow-glow"
          >
            <span className="mb-4 grid h-11 w-11 place-items-center rounded-2xl bg-flame-gradient text-white shadow-glow">
              <Icon className="h-5 w-5" />
            </span>
            <h3 className="font-display text-xl text-cream">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-cream/55">{text}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
