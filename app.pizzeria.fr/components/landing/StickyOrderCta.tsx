'use client'



import { ShoppingBag } from 'lucide-react'

import { useCart } from '@/components/cart/CartProvider'

import { PIZZERIA } from '@/lib/pizzeria-content'



export function StickyOrderCta() {

  const { itemCount, openCartSheet } = useCart()



  return (

    <div className="fixed bottom-0 inset-x-0 z-40 border-t border-white/10 bg-charcoal/95 p-3 backdrop-blur-md md:hidden">

      <button

        type="button"

        onClick={() => openCartSheet()}

        className="flex w-full items-center justify-center gap-2 rounded-full bg-flame-gradient py-3.5 text-center font-bold text-white shadow-glow"

      >

        <ShoppingBag className="h-4 w-4" />

        {itemCount > 0 ? `Commander (${itemCount})` : 'Commander'} — {PIZZERIA.hours.open}h–

        {PIZZERIA.hours.close}h

      </button>

    </div>

  )

}


