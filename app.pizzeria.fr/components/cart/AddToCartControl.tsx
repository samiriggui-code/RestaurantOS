'use client'

import { useState } from 'react'
import { Check, Plus } from 'lucide-react'
import { useCart } from '@/components/cart/CartProvider'
import { PIZZA_CATEGORY_IDS, type CatalogItem } from '@/lib/menu-types'
import {
  PIZZA_SIZES,
  priceForPizzaSize,
  priceForSupplement,
  SUPPLEMENT_PRICE_KEY_BY_SLUG,
  weeklyPromoPrice,
  type PizzaSizeId,
} from '@/lib/pizza-sizes'
import { formatPriceEUR } from '@/lib/menu-types'
import { cn } from '@/lib/cn'

type AddToCartControlProps = {
  item: CatalogItem
  categoryId: string
  className?: string
  /** Taille pré-sélectionnée à l'arrivée (ex. Méga depuis le lien promo "En profiter"). */
  defaultSizeId?: PizzaSizeId
}

export function AddToCartControl({ item, categoryId, className, defaultSizeId }: AddToCartControlProps) {
  const { addItem } = useCart()
  const isPizza = PIZZA_CATEGORY_IDS.has(categoryId)
  const supplementKey = SUPPLEMENT_PRICE_KEY_BY_SLUG[item.slug]
  const isSizedSupplement = categoryId === 'supplements' && Boolean(supplementKey)
  const [sizeId, setSizeId] = useState<PizzaSizeId>(defaultSizeId ?? '31')
  const [added, setAdded] = useState(false)

  const unitPrice = isPizza
    ? priceForPizzaSize(item.price, sizeId)
    : isSizedSupplement && supplementKey
      ? priceForSupplement(supplementKey, sizeId)
      : item.price

  // Le mode (à emporter/livraison) n'est choisi qu'au checkout — pas encore connu ici.
  // On affiche juste que la promo existe pour cette taille aujourd'hui, sans changer le
  // prix ajouté au panier (évite un prix qui change tout seul en rouvrant le panier en
  // mode livraison, qui est le mode par défaut du tunnel).
  const promoIfPickup = isPizza ? weeklyPromoPrice(categoryId, sizeId, 'pickup') : null

  function handleAdd() {
    addItem({
      slug: item.slug,
      name: item.name,
      categoryId,
      basePrice: item.price,
      unitPrice,
      sizeId: isPizza || isSizedSupplement ? sizeId : undefined,
      // Prix Sénior catalogue — nécessaire pour recalculer la promo hebdo quand orderType change.
      catalogPrice: isPizza ? item.price : undefined,
      image: item.image || undefined,
    })
    setAdded(true)
    window.setTimeout(() => setAdded(false), 1600)
  }

  const showSizePicker = isPizza || isSizedSupplement

  return (
    <div className={cn('mt-3 flex flex-col gap-2 border-t border-white/5 pt-3', className)}>
      <div className={cn('flex items-end gap-2', showSizePicker ? 'justify-between' : 'justify-end')}>
        {showSizePicker && (
          <div className="inline-flex flex-wrap gap-1">
            {PIZZA_SIZES.map((size) => (
              <button
                key={size.id}
                type="button"
                onClick={() => setSizeId(size.id)}
                title={size.label}
                className={cn(
                  'rounded-full px-2 py-1 text-[10px] font-medium tracking-wider transition',
                  sizeId === size.id
                    ? 'bg-flame-gradient text-white'
                    : 'border border-white/10 bg-charcoal text-cream/50 hover:text-cream',
                )}
              >
                {size.label.replace(' cm', '')}
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-col items-end gap-1">
          {promoIfPickup != null && promoIfPickup < unitPrice && (
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
              {formatPriceEUR(promoIfPickup)} à emporter aujourd&apos;hui
            </span>
          )}
          <button
            type="button"
            onClick={handleAdd}
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold transition shadow-glow',
              added
                ? 'bg-emerald-600 text-white'
                : 'bg-flame-gradient text-white hover:brightness-110',
            )}
          >
            {added ? (
              <>
                <Check className="h-3.5 w-3.5" />
                Ajouté
              </>
            ) : (
              <>
                <Plus className="h-3.5 w-3.5" />
                {formatPriceEUR(unitPrice)}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export function AddToCartRow({ item, categoryId, defaultSizeId }: AddToCartControlProps) {
  return (
    <div className="flex items-center gap-3 border-t border-white/5 px-4 py-3 sm:px-5">
      <AddToCartControl
        item={item}
        categoryId={categoryId}
        defaultSizeId={defaultSizeId}
        className="mt-0 flex-1 border-0 pt-0"
      />
    </div>
  )
}
