'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Cake, CupSoda, Pizza, Plus, Sparkles, Star, Wine } from 'lucide-react'
import { FoodImage } from '@/components/ui/FoodImage'
import { MenuItemCard } from '@/components/menu/MenuItemCard'
import {
  PIZZA_CATEGORY_IDS,
  type CatalogCategory,
} from '@/lib/menu-types'
import { getCategoryHeroImage, MENU_IMAGE_CATEGORY_IDS } from '@/lib/menu-images'
import { PROMO } from '@/lib/pizzeria-content'
import { cn } from '@/lib/cn'
import { SITE_STICKY_BELOW_HEADER } from '@/lib/site-layout'

const TAB_ICONS: Record<string, typeof Pizza> = {
  tomate: Pizza,
  creme: Sparkles,
  'z-pizzas': Star,
  supplements: Plus,
  desserts: Cake,
  boissons: CupSoda,
  alcool: Wine,
}

type MenuTabsProps = {
  categories: CatalogCategory[]
}

export function MenuTabs({ categories }: MenuTabsProps) {
  const [activeId, setActiveId] = useState(categories[0]?.id ?? 'tomate')
  const [panelKey, setPanelKey] = useState(0)
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const skipInitialScroll = useRef(true)

  const active = categories.find((c) => c.id === activeId) ?? categories[0]

  const selectTab = useCallback((id: string) => {
    setActiveId(id)
    setPanelKey((k) => k + 1)
  }, [])

  useEffect(() => {
    if (skipInitialScroll.current) {
      skipInitialScroll.current = false
      return
    }
    tabRefs.current[activeId]?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center',
    })
  }, [activeId])

  if (!active) return null

  const heroImage = getCategoryHeroImage(active.id)

  return (
    <div className="mx-auto max-w-6xl px-4 md:px-6">
      {/* Promo compacte */}
      <div className="mt-6 rounded-2xl border border-tomato/25 bg-gradient-to-r from-tomato/15 to-transparent p-4">
        <p className="text-xs font-bold uppercase tracking-widest text-tomato-light">{PROMO.title}</p>
        <p className="mt-1 font-semibold text-cream">{PROMO.text}</p>
      </div>

      <div className="mt-8 lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-10 lg:items-start">
        {/* Navigation — sidebar desktop / sticky horizontal mobile */}
        <nav
          className={`sticky ${SITE_STICKY_BELOW_HEADER} z-30 -mx-4 border-b border-white/10 bg-charcoal-soft/95 px-4 py-3 backdrop-blur-md lg:static lg:top-auto lg:mx-0 lg:rounded-2xl lg:border lg:border-white/10 lg:bg-charcoal/80 lg:px-2 lg:py-3`}
          aria-label="Catégories du menu"
        >
          <p className="mb-2 hidden px-3 text-[10px] font-bold uppercase tracking-widest text-cream/40 lg:block">
            Catégories
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none lg:flex-col lg:overflow-visible lg:pb-0">
            {categories.map((cat) => {
              const Icon = TAB_ICONS[cat.id] ?? Pizza
              const isActive = cat.id === activeId
              return (
                <button
                  key={cat.id}
                  ref={(el) => {
                    tabRefs.current[cat.id] = el
                  }}
                  type="button"
                  onClick={() => selectTab(cat.id)}
                  className={cn(
                    'flex shrink-0 items-center gap-2.5 rounded-xl px-4 py-2.5 text-left text-sm font-medium transition-all lg:w-full',
                    isActive
                      ? 'bg-tomato text-white shadow-lg shadow-tomato/25'
                      : 'bg-charcoal/60 text-cream/70 hover:bg-white/5 hover:text-cream'
                  )}
                  aria-selected={isActive}
                  role="tab"
                >
                  <Icon className="h-4 w-4 shrink-0 opacity-90" />
                  <span className="whitespace-nowrap">{cat.shortLabel}</span>
                  <span
                    className={cn(
                      'ml-auto hidden rounded-full px-2 py-0.5 text-[10px] font-bold lg:inline',
                      isActive ? 'bg-white/20 text-white' : 'bg-white/5 text-cream/50'
                    )}
                  >
                    {cat.items.length}
                  </span>
                </button>
              )
            })}
          </div>
        </nav>

        {/* Panneau actif */}
        <div
          key={panelKey}
          role="tabpanel"
          className="animate-panel-in mt-6 min-h-[50vh] lg:mt-0"
        >
          <div className="overflow-hidden rounded-2xl border border-white/10 shadow-xl shadow-black/20">
            <FoodImage
              src={heroImage}
              alt={active.name}
              className="h-40 sm:h-48"
              overlay="warm"
              sizes="(max-width: 1024px) 100vw, 70vw"
            />
            <div className="border-t border-white/10 bg-charcoal/90 px-5 py-4 sm:px-6">
              <h2 className="font-display text-2xl font-bold text-cream sm:text-3xl">{active.name}</h2>
              {active.description && (
                <p className="mt-1 text-sm text-cream/50">{active.description}</p>
              )}
              <p className="mt-2 text-xs text-cream/35">
                {active.items.length} article{active.items.length > 1 ? 's' : ''}
              </p>
            </div>
          </div>

          <ul
            className={cn(
              'mt-6 grid gap-4',
              MENU_IMAGE_CATEGORY_IDS.has(active.id)
                ? 'sm:grid-cols-2 xl:grid-cols-3'
                : 'sm:grid-cols-1 lg:grid-cols-2'
            )}
          >
            {active.items.map((item) => (
              <MenuItemCard
                key={item.slug}
                item={item}
                categoryId={active.id}
                showSize={PIZZA_CATEGORY_IDS.has(active.id)}
              />
            ))}
          </ul>
        </div>
      </div>

      <p className="mt-12 pb-8 text-center text-xs text-cream/30">
        Photos pizza d&apos;illustration — remplaçables par vos visuels (même nom de fichier dans{' '}
        <code className="text-cream/40">public/images/menu/</code>).
      </p>
    </div>
  )
}
