'use client'

import { useCallback, useState } from 'react'
import { FoodImage } from '@/components/ui/FoodImage'
import { MenuItemCard } from '@/components/menu/MenuItemCard'
import { formatPriceEUR, isPizzaCategoryId, type CatalogCategory } from '@/lib/menu-types'
import { getCategoryHeroImage } from '@/lib/menu-images'
import { weeklyPromoPrice, type PizzaSizeId } from '@/lib/pizza-sizes'
import { cn } from '@/lib/cn'

const HIDDEN_BAND_IDS = new Set(['supplements'])

function minCategoryPrice(cat: CatalogCategory): string {
  if (cat.items.length === 0) return ''
  const min = Math.min(...cat.items.map((i) => i.price))
  return `Dès ${formatPriceEUR(min).replace(/\s/g, '\u00a0')}`
}

type LovableMenuCatalogProps = {
  categories: CatalogCategory[]
  /** Affiche le bloc titre « Notre carte / Pizzas du moment » */
  showHero?: boolean
  className?: string
  /** Catégorie ouverte à l'arrivée (ex. "tomate" depuis le lien promo "En profiter"). */
  initialCategoryId?: string
  /** Taille pré-sélectionnée sur chaque pizza à l'arrivée (ex. Méga pour la promo 18€). */
  defaultSizeId?: PizzaSizeId
}

export function LovableMenuCatalog({
  categories,
  showHero = true,
  className,
  initialCategoryId,
  defaultSizeId,
}: LovableMenuCatalogProps) {
  const bandCategories = categories.filter((c) => !HIDDEN_BAND_IDS.has(c.id))
  const [activeId, setActiveId] = useState(
    (initialCategoryId && bandCategories.some((c) => c.id === initialCategoryId)
      ? initialCategoryId
      : undefined) ??
      bandCategories[0]?.id ??
      categories[0]?.id ??
      'tomate',
  )

  const active = bandCategories.find((c) => c.id === activeId) ?? bandCategories[0] ?? categories[0]

  const selectCategory = useCallback((id: string) => {
    setActiveId(id)
  }, [])

  if (!active) return null

  return (
    <div className={cn('mx-auto max-w-7xl px-4 md:px-6', className)}>
      {showHero && (
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-tomato-light">
              Notre carte
            </p>
            <h2 className="mt-3 font-display text-4xl tracking-tight text-cream sm:text-5xl">
              Pizzas du <em className="text-flame-gradient not-italic font-semibold">moment</em>
            </h2>
            <p className="mt-3 max-w-lg text-sm text-cream/55">
              Catalogue en ligne synchronisé avec la pizzeria — prix et disponibilité à jour.
            </p>
          </div>
        </div>
      )}

      {/* Bandeau catégories — grille 6 colonnes comme Lovable */}
      <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {bandCategories.map((cat) => {
          const activeBand = cat.id === activeId
          const hero = getCategoryHeroImage(cat.id)
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => selectCategory(cat.id)}
              className={cn(
                'group relative overflow-hidden rounded-2xl border text-left transition duration-300',
                activeBand
                  ? 'border-tomato/60 shadow-glow'
                  : 'border-white/10 hover:border-tomato/40',
              )}
              aria-pressed={activeBand}
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-charcoal">
                <FoodImage
                  src={hero}
                  alt=""
                  className={cn(
                    'h-full w-full transition duration-700',
                    activeBand ? 'scale-105' : 'opacity-70 group-hover:opacity-100',
                  )}
                  overlay="none"
                  sizes="(max-width: 640px) 50vw, 16vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-charcoal via-charcoal/40 to-transparent" />
              </div>
              <div className="absolute inset-x-0 bottom-0 px-3 py-2.5">
                <p className="font-display text-sm leading-tight text-cream">{cat.name}</p>
                <p className="text-[10px] uppercase tracking-widest text-cream/45">
                  {minCategoryPrice(cat)}
                </p>
              </div>
            </button>
          )
        })}
      </div>

      {/* En-tête catégorie active */}
      <div className="mt-12 flex items-center gap-4 text-sm">
        <span className="font-display text-2xl text-cream">{active.name}</span>
        <span className="h-px flex-1 bg-white/10" />
        <span className="text-xs text-cream/45">
          {active.items.length} article{active.items.length > 1 ? 's' : ''}
        </span>
      </div>
      {active.description && (
        <p className="mt-1 text-sm text-cream/50">{active.description}</p>
      )}

      {defaultSizeId === '40' && (active.id === 'tomate' || active.id === 'creme') && (
        <p
          className={cn(
            'mt-3 rounded-xl border px-3 py-2 text-xs',
            weeklyPromoPrice(active.id, '40', 'pickup') != null
              ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-100'
              : 'border-red-500/30 bg-red-500/10 text-red-200',
          )}
        >
          {weeklyPromoPrice(active.id, '40', 'pickup') != null
            ? 'Taille Méga pré-sélectionnée — pizzas de cette catégorie à 18 € à emporter aujourd’hui.'
            : 'Taille Méga pré-sélectionnée. Promo à 18 € à emporter valable du lundi au jeudi — pas active aujourd’hui, prix catalogue affiché ci-dessous.'}
        </p>
      )}

      {/* Grille produits */}
      <ul className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {active.items.map((item) => (
          <MenuItemCard
            key={item.slug}
            item={item}
            categoryId={active.id}
            showSize={isPizzaCategoryId(active.id)}
            layout="lovable"
            defaultSizeId={active.id === 'tomate' || active.id === 'creme' ? defaultSizeId : undefined}
          />
        ))}
      </ul>

      <p className="mt-10 text-center text-xs text-cream/35">
        Minimum livraison calculé sur les pizzas uniquement — suppléments et boissons en sus.
      </p>
    </div>
  )
}
