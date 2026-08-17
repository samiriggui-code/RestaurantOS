'use client'

import Link from 'next/link'
import { ArrowRight, ShoppingBag } from 'lucide-react'
import { useCart } from '@/components/cart/CartProvider'
import { PanierLineCard } from '@/components/cart/PanierLineCard'
import { formatPriceEUR } from '@/lib/menu-types'

/** Panier = consultation uniquement. Le tunnel de commande est sur /commander */
export function PanierView() {
  const { lines, subtotal, itemCount, updateQuantity, removeLine, clearCart } = useCart()

  if (itemCount === 0) {
    return (
      <div className="mx-auto max-w-md text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-white/5">
          <ShoppingBag className="h-9 w-9 text-cream/30" />
        </div>
        <h1 className="mt-6 font-display text-3xl font-bold text-cream">Votre panier est vide</h1>
        <p className="mt-3 text-cream/55">Parcourez la carte et ajoutez vos articles.</p>
        <Link
          href="/menu"
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-tomato px-8 py-3.5 font-bold text-white hover:bg-tomato-light"
        >
          Voir la carte
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-cream/45">Panier</p>
          <h1 className="font-display text-3xl font-bold text-cream">Vos articles</h1>
          <p className="mt-1 text-sm text-cream/45">
            {itemCount} article{itemCount > 1 ? 's' : ''} · {formatPriceEUR(subtotal)}
          </p>
        </div>
        <button
          type="button"
          onClick={clearCart}
          className="text-sm text-cream/40 hover:text-cream/65"
        >
          Vider
        </button>
      </div>

      <ul className="mt-8 space-y-3">
        {lines.map((line) => (
          <PanierLineCard
            key={line.lineId}
            line={line}
            onUpdateQty={(qty) => updateQuantity(line.lineId, qty)}
            onRemove={() => removeLine(line.lineId)}
          />
        ))}
      </ul>

      <div className="mt-8 space-y-3">
        <Link
          href="/commander"
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-tomato py-3.5 font-bold text-white shadow-lg shadow-tomato/25 hover:bg-tomato-light"
        >
          Commander
          <ArrowRight className="h-4 w-4" />
        </Link>
        <Link
          href="/menu"
          className="block text-center text-sm text-tomato-light hover:underline"
        >
          + Ajouter d&apos;autres articles
        </Link>
      </div>
    </div>
  )
}
