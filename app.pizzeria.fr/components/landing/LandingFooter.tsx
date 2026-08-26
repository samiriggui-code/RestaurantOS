import Link from 'next/link'
import { LEGAL_FOOTER_LINKS } from '@/lib/legal-identity'
import { PIZZERIA } from '@/lib/pizzeria-content'

export function LandingFooter() {
  return (
    <footer className="bg-charcoal border-t border-white/5">
      <div className="mx-auto max-w-6xl px-4 py-16 md:px-6">
        <div className="grid gap-12 md:grid-cols-3">
          <div>
            <p className="font-display text-2xl font-bold text-cream">
              La <span className="text-tomato-light">Z</span> Pizza
            </p>
            <p className="mt-2 text-sm text-cream/60">{PIZZERIA.tagline}</p>
            <p className="mt-4 text-sm text-cream/50">
              À emporter & livraison · {PIZZERIA.daysOpen}
              <br />
              {PIZZERIA.hours.open}h – {PIZZERIA.hours.close}h
            </p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-cream/40">Contact</p>
            <p className="mt-4 text-sm text-cream/70">{PIZZERIA.fullAddress}</p>
            <a href={PIZZERIA.phoneHref} className="mt-2 block text-tomato-light font-medium hover:underline">
              {PIZZERIA.phone}
            </a>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-cream/40">Commander</p>
            <Link href="/menu" className="mt-4 inline-block rounded-full bg-tomato px-6 py-2.5 text-sm font-semibold text-white hover:bg-tomato-light">
              Voir le menu en ligne
            </Link>
          </div>
        </div>
        <div className="mt-12 flex flex-wrap gap-6 border-t border-white/5 pt-8 text-xs text-cream/40">
          {LEGAL_FOOTER_LINKS.map((l) => (
            <Link key={l.label} href={l.href} className="hover:text-cream/70">
              {l.label}
            </Link>
          ))}
          <span className="ml-auto">© {new Date().getFullYear()} La Z Pizza</span>
        </div>
      </div>
    </footer>
  )
}
