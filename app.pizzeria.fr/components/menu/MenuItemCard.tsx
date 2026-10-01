'use client'

import { Cake, CupSoda, Pizza, Plus, Wine } from 'lucide-react'
import { AddToCartControl } from '@/components/cart/AddToCartControl'
import { formatPriceEUR, type CatalogItem } from '@/lib/menu-types'
import { categoryShowsItemPhoto, getCategoryHeroImage } from '@/lib/menu-images'
import { FoodImage } from '@/components/ui/FoodImage'
import type { PizzaSizeId } from '@/lib/pizza-sizes'

type MenuItemCardProps = {
  item: CatalogItem
  categoryId: string
  showSize?: boolean
  /** Carte horizontale avec photo — style Lovable */
  layout?: 'default' | 'lovable'
  /** Taille pré-sélectionnée à l'arrivée (ex. Méga depuis le lien promo "En profiter"). */
  defaultSizeId?: PizzaSizeId
}

const CATEGORY_ICONS: Record<string, typeof Pizza> = {
  desserts: Cake,
  boissons: CupSoda,
  alcool: Wine,
  supplements: Plus,
}

export function MenuItemCard({
  item,
  categoryId,
  showSize,
  layout = 'default',
  defaultSizeId,
}: MenuItemCardProps) {
  const withPhoto =
    layout === 'lovable' ||
    (categoryShowsItemPhoto(categoryId) && Boolean(item.image))
  const photoSrc =
    item.image || (layout === 'lovable' ? getCategoryHeroImage(categoryId) : '')
  const Icon = CATEGORY_ICONS[categoryId] ?? Pizza
  const isSignature = categoryId === 'z-pizzas'

  if (withPhoto && photoSrc) {
    return (
      <li className="group flex gap-4 rounded-2xl border border-white/10 bg-charcoal/80 p-4 shadow-sm transition hover:border-tomato/40 hover:shadow-glow">
        <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-xl bg-charcoal">
          <FoodImage
            src={photoSrc}
            alt={item.name}
            className="h-full transition duration-700 group-hover:scale-105"
            overlay="none"
            sizes="112px"
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-display text-lg leading-tight tracking-tight text-cream">{item.name}</h3>
              {isSignature && (
                <span className="mt-1 inline-block rounded-full border border-white/10 bg-charcoal-soft px-2 py-0.5 text-[9px] uppercase tracking-widest text-cream/45">
                  Signature
                </span>
              )}
              {showSize && !isSignature && (
                <p className="mt-0.5 text-[10px] uppercase tracking-wide text-cream/35">dès 31 cm</p>
              )}
            </div>
          </div>
          <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-cream/50">{item.description}</p>
          {item.priceNote && <p className="mt-1 text-xs text-cream/35">{item.priceNote}</p>}
          <AddToCartControl item={item} categoryId={categoryId} defaultSizeId={defaultSizeId} className="mt-auto border-0 pt-3" />
        </div>
      </li>
    )
  }

  return (
    <li className="flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-charcoal/70 transition duration-300 hover:border-tomato/30 hover:shadow-lg hover:shadow-black/20 sm:flex-row">
      <div className="flex shrink-0 items-center justify-center border-b border-white/5 px-4 py-4 sm:border-b-0 sm:border-r sm:py-5">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-tomato/15 text-tomato-light">
          <Icon className="h-5 w-5" strokeWidth={2} />
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-1 flex-col justify-center px-4 py-4 sm:pr-4">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-semibold leading-snug text-cream">{item.name}</h3>
            <p className="shrink-0 font-bold text-tomato-light">{formatPriceEUR(item.price)}</p>
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-cream/50">{item.description}</p>
          {item.priceNote && <p className="mt-2 text-xs text-cream/35">{item.priceNote}</p>}
        </div>
        <AddToCartControl item={item} categoryId={categoryId} defaultSizeId={defaultSizeId} className="px-4 pb-4 sm:px-5" />
      </div>
    </li>
  )
}
