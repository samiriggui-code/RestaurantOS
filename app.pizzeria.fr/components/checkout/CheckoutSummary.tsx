'use client'

import { formatPriceEUR } from '@/lib/menu-types'
import type { OrderType } from '@/lib/cart-types'
import { useCart } from '@/components/cart/CartProvider'
import { pizzaSubtotalFromLines } from '@/lib/pizza-subtotal'

type CheckoutSummaryProps = {
  orderType: OrderType | null
  deliveryFee: number
  zoneLabel?: string
  deliveryMinPizzas?: number
}

export function CheckoutSummary({
  orderType,
  deliveryFee,
  zoneLabel,
  deliveryMinPizzas,
}: CheckoutSummaryProps) {
  const { lines, subtotal, itemCount } = useCart()
  const pizzaSubtotal = pizzaSubtotalFromLines(lines)
  const total = subtotal + (orderType === 'delivery' ? deliveryFee : 0)
  const belowPizzaMin =
    orderType === 'delivery' &&
    deliveryMinPizzas != null &&
    deliveryMinPizzas > 0 &&
    pizzaSubtotal < deliveryMinPizzas

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-charcoal/90 shadow-xl shadow-black/20">
      <div className="border-b border-white/10 bg-gradient-to-r from-tomato/15 to-transparent px-4 py-3">
        <h2 className="text-sm font-semibold text-cream">Votre commande</h2>
        <p className="text-xs text-cream/45">{itemCount} article{itemCount > 1 ? 's' : ''}</p>
      </div>
      <ul className="max-h-48 space-y-2 overflow-y-auto px-4 py-3 text-xs">
        {lines.map((l) => (
          <li key={l.lineId} className="flex justify-between gap-2 text-cream/70">
            <span className="min-w-0 truncate">
              {l.quantity}× {l.name}
              {l.sizeLabel ? ` (${l.sizeLabel})` : ''}
            </span>
            <span className="shrink-0 font-medium text-cream">
              {formatPriceEUR(l.unitPrice * l.quantity)}
            </span>
          </li>
        ))}
      </ul>
      <div className="space-y-2 border-t border-white/10 px-4 py-3 text-sm">
        {orderType === 'delivery' && deliveryMinPizzas != null && deliveryMinPizzas > 0 && (
          <div
            className={
              belowPizzaMin
                ? 'flex justify-between rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-xs text-amber-100'
                : 'flex justify-between text-cream/60'
            }
          >
            <span>Pizzas (minimum livraison)</span>
            <span className={belowPizzaMin ? 'font-semibold' : ''}>
              {formatPriceEUR(pizzaSubtotal)} / {formatPriceEUR(deliveryMinPizzas)}
            </span>
          </div>
        )}
        <div className="flex justify-between text-cream/60">
          <span>Sous-total</span>
          <span>{formatPriceEUR(subtotal)}</span>
        </div>
        {orderType === 'delivery' && (
          <div className="flex justify-between text-cream/60">
            <span>Livraison{zoneLabel ? ` · ${zoneLabel}` : ''}</span>
            <span>{formatPriceEUR(deliveryFee)}</span>
          </div>
        )}
        <div className="flex justify-between border-t border-white/10 pt-2 font-bold text-cream">
          <span>Total</span>
          <span className="text-tomato-light">{formatPriceEUR(total)}</span>
        </div>
      </div>
    </div>
  )
}

export function useCheckoutTotal(orderType: OrderType | null, deliveryFee: number) {
  const { subtotal } = useCart()
  return subtotal + (orderType === 'delivery' ? deliveryFee : 0)
}
