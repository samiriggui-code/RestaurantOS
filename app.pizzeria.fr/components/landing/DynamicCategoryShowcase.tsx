'use client'

import { useEffect, useState } from 'react'
import { useFeedbackState } from '@/lib/use-feedback-state'
import Link from 'next/link'
import { AlertCircle, ArrowRight, Loader2 } from 'lucide-react'
import { FoodImage } from '@/components/ui/FoodImage'
import { PLACEHOLDER_IMAGES } from '@/lib/placeholder-images'
import { fetchPublicMenu } from '@/lib/menu-api'
import {
  filterPizzaCategories,
  formatPriceEUR,
  type CatalogCategory,
} from '@/lib/menu-types'

const CATEGORY_STYLES: Record<
  string,
  { gradient: string; accent: string; image: string; subtitle: string }
> = {
  tomate: {
    gradient: 'from-red-950/80 to-charcoal',
    accent: 'border-red-500/20',
    image: PLACEHOLDER_IMAGES.categories.tomate,
    subtitle: 'Base sauce tomate',
  },
  creme: {
    gradient: 'from-amber-950/60 to-charcoal',
    accent: 'border-amber-500/20',
    image: PLACEHOLDER_IMAGES.categories.creme,
    subtitle: 'Base crème fraîche',
  },
  'z-pizzas': {
    gradient: 'from-violet-950/50 to-charcoal',
    accent: 'border-violet-500/20',
    image: PLACEHOLDER_IMAGES.categories.z,
    subtitle: 'Les Z Pizzas',
  },
}

const DEFAULT_STYLE = {
  gradient: 'from-charcoal-soft to-charcoal',
  accent: 'border-white/10',
  image: PLACEHOLDER_IMAGES.categories.tomate,
  subtitle: 'Notre carte',
}

export function DynamicCategoryShowcase() {
  const [categories, setCategories] = useState<CatalogCategory[] | null>(null)
  const { error, setError } = useFeedbackState()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    void fetchPublicMenu()
      .then((data) => {
        if (!cancelled) {
          setCategories(filterPizzaCategories(data))
          setError(null)
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setCategories(null)
          setError(e instanceof Error ? e.message : 'Menu indisponible')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <section id="carte" className="flex justify-center bg-charcoal-soft py-24">
        <Loader2 className="h-8 w-8 animate-spin text-tomato-light" />
      </section>
    )
  }

  if (error) {
    return (
      <section id="carte" className="bg-charcoal-soft py-24">
        <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-4 text-center">
          <AlertCircle className="h-10 w-10 text-tomato-light" />
          <p className="text-cream/70">{error}</p>
          <p className="text-sm text-cream/45">Réessayez dans un instant ou contactez la pizzeria.</p>
          <Link
            href="/menu"
            className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-tomato-light hover:underline"
          >
            Voir la carte complète
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    )
  }

  if (!categories?.length) {
    return null
  }

  return (
    <section id="carte" className="bg-charcoal-soft py-24">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <div className="mb-16 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-tomato-light">
            Notre carte
          </p>
          <h2 className="mt-3 font-display text-4xl font-bold text-cream md:text-5xl">
            Pizzas du <em className="text-flame-gradient not-italic font-semibold">moment</em>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-cream/60">
            Catalogue en ligne synchronisé avec la pizzeria — prix et disponibilité à jour.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-3">
          {categories.map((cat) => {
            const style = CATEGORY_STYLES[cat.id] ?? DEFAULT_STYLE
            const preview = cat.items.slice(0, 4)
            const fromPrice = cat.items.length
              ? Math.min(...cat.items.map((i) => i.price))
              : null
            return (
              <article
                key={cat.id}
                className={`group relative overflow-hidden rounded-3xl border bg-gradient-to-b ${style.gradient} ${style.accent} transition duration-500 hover:-translate-y-1 hover:border-tomato/40 hover:shadow-glow`}
              >
                <FoodImage
                  src={preview[0]?.image || style.image}
                  alt={cat.name}
                  className="aspect-[4/3]"
                  overlay="warm"
                  sizes="(max-width: 768px) 100vw, 33vw"
                />
                <div className="relative p-8 pt-6">
                  <p className="text-xs font-bold uppercase tracking-widest text-white/50">
                    {style.subtitle}
                  </p>
                  <h3 className="mt-2 font-display text-2xl font-bold text-cream">{cat.name}</h3>
                  {fromPrice != null && (
                    <p className="mt-1 text-sm text-tomato-light">dès {formatPriceEUR(fromPrice)}</p>
                  )}
                  <ul className="mt-6 space-y-2">
                    {preview.map((p) => (
                      <li
                        key={p.slug}
                        className="flex items-center justify-between gap-2 text-sm text-cream/80"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="h-1 w-1 shrink-0 rounded-full bg-tomato-light" />
                          <span className="truncate">{p.name}</span>
                        </span>
                        <span className="shrink-0 text-cream/50">{formatPriceEUR(p.price)}</span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={`/menu#${cat.id}`}
                    className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-tomato-light transition group-hover:gap-3"
                  >
                    Voir la catégorie
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </article>
            )
          })}
        </div>

        <p className="mt-12 text-center text-sm text-cream/50">
          Minimum livraison calculé sur les pizzas uniquement — suppléments et boissons en sus.
        </p>
      </div>
    </section>
  )
}
