'use client'

import { ArrowRight, ShoppingBag } from 'lucide-react'
import { useCart } from '@/components/cart/CartProvider'
import { CHECKOUT_STEP_LABELS } from '@/lib/checkout-flow'
import { loadCheckoutSession } from '@/lib/checkout-session'
import { formatPriceEUR } from '@/lib/menu-types'
import { getDeliveryQuote } from '@/lib/delivery'
import { pizzaSubtotalFromLines } from '@/lib/pizza-subtotal'

export function CheckoutReturnBanner() {
  const { itemCount, lines, openCartSheet } = useCart()

  if (itemCount === 0) return null

  const session = loadCheckoutSession()
  if (!session || session.step === 'recap') return null

  const pizzaSubtotal = pizzaSubtotalFromLines(lines)
  let extra = ''
  if (session.orderType === 'delivery' && session.postalCode.length >= 5 && session.city.trim()) {
    const quote = getDeliveryQuote(session.postalCode, pizzaSubtotal, session.city)
    if (!quote.ok && quote.minOrder > 0 && pizzaSubtotal < quote.minOrder) {
      extra = ` — il manque ${formatPriceEUR(quote.minOrder - pizzaSubtotal)} de pizzas`
    }
  }

  return (
    <div className="sticky top-[var(--site-header-offset,4.5rem)] z-30 border-b border-tomato/30 bg-tomato/15 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-6">
        <div className="flex min-w-0 items-start gap-2.5">
          <ShoppingBag className="mt-0.5 h-4 w-4 shrink-0 text-tomato-light" />
          <p className="text-sm text-cream">
            <span className="font-semibold">Commande en cours</span>
            <span className="text-cream/65">
              {' '}
              — {CHECKOUT_STEP_LABELS[session.step]}{extra}
            </span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => openCartSheet(session.step)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-tomato px-4 py-2 text-sm font-bold text-white hover:bg-tomato-light"
        >
          Reprendre
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
