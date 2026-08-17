'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { Plus, Sparkles } from 'lucide-react'
import { useCart } from '@/components/cart/CartProvider'
import { formatPriceEUR } from '@/lib/menu-types'
import { getCartUpsells, type UpsellItem } from '@/lib/cart-upsells'
import { fetchMenuFormules, type MenuFormulesConfig } from '@/lib/formules-api'
import { fetchPublicMenu } from '@/lib/menu-api'
import type { CatalogCategory } from '@/lib/menu-types'
import { cn } from '@/lib/cn'

export function CartUpsellStrip() {
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

  const upsells = getCartUpsells(lines, formules, categories)

  if (upsells.length === 0) return null

  function offerTagFor(kind: UpsellItem['kind']) {
    if (kind === 'menu_drink') return formules?.duo.offerTag ?? 'formule-duo'
    if (kind === 'menu_dessert') return formules?.dessert.offerTag ?? 'formule-dessert'
    return undefined
  }

  return (
    <section className="mt-8">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-amber-400" />
        <h2 className="text-sm font-bold uppercase tracking-widest text-cream/50">
          Complétez votre commande
        </h2>
      </div>
      <p className="mt-1 text-xs text-cream/40">
        Menus et extras pour profiter de tarifs avantageux
      </p>

      <div className="mt-4 flex gap-3 overflow-x-auto pb-2 scrollbar-none">
        {upsells.map((item) => (
          <button
            key={`${item.slug}-${item.kind}`}
            type="button"
            onClick={() =>
              addItem({
                slug: item.slug,
                name: item.name,
                categoryId: item.categoryId,
                basePrice: item.catalogPrice,
                unitPrice: item.offerPrice,
                catalogPrice: item.catalogPrice,
                image: item.image,
                offerTag: offerTagFor(item.kind),
              })
            }
            className={cn(
              'flex w-[148px] shrink-0 flex-col overflow-hidden rounded-2xl border border-white/10',
              'bg-charcoal/80 text-left transition hover:border-tomato/40 hover:shadow-lg hover:shadow-tomato/10'
            )}
          >
            <div className="relative h-24 w-full">
              <Image src={item.image} alt={item.name} fill className="object-cover" sizes="148px" />
              {item.badge && (
                <span className="absolute right-2 top-2 rounded-full bg-tomato px-2 py-0.5 text-[10px] font-bold text-white">
                  {item.badge}
                </span>
              )}
            </div>
            <div className="flex flex-1 flex-col p-3">
              <p className="line-clamp-2 text-xs font-semibold leading-snug text-cream">{item.name}</p>
              <p className="mt-1 line-clamp-2 text-[10px] text-cream/40">{item.description}</p>
              <div className="mt-auto flex items-center justify-between pt-2">
                <div>
                  {item.offerPrice < item.catalogPrice && (
                    <span className="mr-1 text-[10px] text-cream/35 line-through">
                      {formatPriceEUR(item.catalogPrice)}
                    </span>
                  )}
                  <span className="text-sm font-bold text-tomato-light">
                    {formatPriceEUR(item.offerPrice)}
                  </span>
                </div>
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-tomato text-white">
                  <Plus className="h-3.5 w-3.5" />
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </section>
  )
}
