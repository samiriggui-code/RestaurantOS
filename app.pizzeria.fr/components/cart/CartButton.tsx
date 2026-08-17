'use client'

import { ShoppingCart } from 'lucide-react'
import { useCart } from '@/components/cart/CartProvider'
import { cn } from '@/lib/cn'

type CartButtonProps = {
  className?: string
}

/** Icône panier — ouvre le sheet latéral (style Lovable) */
export function CartButton({ className }: CartButtonProps) {
  const { itemCount, openCartSheet } = useCart()

  return (
    <button
      type="button"
      onClick={() => openCartSheet()}
      className={cn(
        'relative flex h-10 w-10 items-center justify-center rounded-full text-cream/90 transition hover:bg-white/10 hover:text-cream',
        className,
      )}
      aria-label={`Panier${itemCount > 0 ? `, ${itemCount} article${itemCount > 1 ? 's' : ''}` : ''}`}
    >
      <ShoppingCart className="h-5 w-5" strokeWidth={2} />
      {itemCount > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-tomato px-1 text-[10px] font-bold leading-none text-white">
          {itemCount > 99 ? '99+' : itemCount}
        </span>
      )}
    </button>
  )
}
