'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { Plus } from 'lucide-react'
import { useCart } from '@/components/cart/CartProvider'
import { formatPriceEUR } from '@/lib/menu-types'
import {
  getCartUpsells,
  getPizzaMinimumSuggestions,
  type UpsellItem,
} from '@/lib/cart-upsells'
import { fetchMenuFormules, type MenuFormulesConfig } from '@/lib/formules-api'
import { fetchPublicMenu } from '@/lib/menu-api'
import type { CatalogCategory } from '@/lib/menu-types'
import { priceForPizzaSize } from '@/lib/pizza-sizes'
import { cn } from '@/lib/cn'

type CartSheetSuggestionsProps = {
  /** Montant de pizzas manquant pour la livraison (0 = pas de contrainte) */
  pizzaGap?: number
  className?: string
}

function offerTagFor(kind: UpsellItem['kind'], formules: MenuFormulesConfig | null) {
  if (kind === 'menu_drink') return formules?.duo.offerTag ?? 'formule-duo'
  if (kind === 'menu_dessert') return formules?.dessert.offerTag ?? 'formule-dessert'
  return undefined
}

export function CartSheetSuggestions({ pizzaGap = 0, className }: CartSheetSuggestionsProps) {
  const { lines, addItem } = useCart()
  const [formules, setFormules] = useState<MenuFormulesConfig | null>(null)
  const [categories, setCategories] = useState<CatalogCategory[]>([])

  useEffect(() => {
    let cancelled = false
    void Promise.all([fetchMenuFormules(), fetchPublicMenu()])
      .then(([config, menu]) => {
        if (!cancelled) {
          setFormules(config)
          setCategories(menu)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFormules(null)
          setCategories([])
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  const pizzaSuggestions = useMemo(
    () => getPizzaMinimumSuggestions(lines, categories, pizzaGap, 4),
    [lines, categories, pizzaGap],
  )
  const upsells = useMemo(
    () => getCartUpsells(lines, formules, categories).slice(0, 3),
    [lines, formules, categories],
  )

  const suggestions =
    pizzaGap > 0 && pizzaSuggestions.length > 0 ? pizzaSuggestions : upsells

  if (suggestions.length === 0) return null

  const title =
    pizzaGap > 0
      ? `Ajoutez ${formatPriceEUR(pizzaGap)} de pizzas`
      : 'Suggestions'

  function handleAdd(item: UpsellItem) {
    const isPizza = item.categoryId === 'tomate' || item.categoryId === 'creme' || item.categoryId === 'z-pizzas'
    addItem({
      slug: item.slug,
      name: item.name,
      categoryId: item.categoryId,
      basePrice: item.catalogPrice,
      unitPrice: isPizza ? priceForPizzaSize(item.catalogPrice, '31') : item.offerPrice,
      catalogPrice: item.catalogPrice,
      image: item.image,
      offerTag: offerTagFor(item.kind, formules),
    })
  }

  return (
    <section className={cn('mt-3', className)}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-cream/45">{title}</p>
      <div className="mt-2 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {suggestions.map((item) => (
          <button
            key={`${item.slug}-${item.kind}`}
            type="button"
            onClick={() => handleAdd(item)}
            className="flex w-[108px] shrink-0 flex-col overflow-hidden rounded-xl border border-white/10 bg-charcoal-soft text-left transition hover:border-tomato/40"
          >
            <div className="relative h-14 w-full">
              <Image src={item.image} alt="" fill className="object-cover" sizes="108px" />
              {item.badge && (
                <span className="absolute right-1 top-1 rounded bg-tomato px-1 py-0.5 text-[8px] font-bold text-white">
                  {item.badge}
                </span>
              )}
            </div>
            <div className="flex flex-1 flex-col p-2">
              <p className="line-clamp-1 text-[11px] font-medium text-cream">{item.name}</p>
              <div className="mt-1 flex items-center justify-between gap-1">
                <span className="text-xs font-bold text-tomato-light">
                  {formatPriceEUR(item.offerPrice)}
                </span>
                <span className="grid h-5 w-5 place-items-center rounded-full bg-tomato text-white">
                  <Plus className="h-3 w-3" />
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </section>
  )
}
