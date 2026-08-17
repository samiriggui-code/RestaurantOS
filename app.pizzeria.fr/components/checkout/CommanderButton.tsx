'use client'



import { ShoppingBag } from 'lucide-react'

import { useCart } from '@/components/cart/CartProvider'

import { cn } from '@/lib/cn'



type CommanderButtonProps = {

  className?: string

}



/** Bouton Commander Lovable — ouvre toujours le panier latéral */

export function CommanderButton({ className }: CommanderButtonProps) {

  const { itemCount, openCartSheet } = useCart()



  return (

    <button

      type="button"

      onClick={() => openCartSheet()}

      className={cn(

        'relative inline-flex items-center gap-2 rounded-full bg-flame-gradient px-5 py-2.5 text-sm font-medium text-white shadow-glow transition hover:brightness-110',

        className,

      )}

    >

      <ShoppingBag className="h-4 w-4 shrink-0" />

      <span className="hidden whitespace-nowrap sm:inline">Commander</span>

      {itemCount > 0 && (

        <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-charcoal px-1.5 text-[11px] font-semibold text-tomato-light ring-1 ring-tomato/60">

          {itemCount > 99 ? '99+' : itemCount}

        </span>

      )}

    </button>

  )

}



export function CommanderButtonMobile() {

  const { itemCount, openCartSheet } = useCart()



  return (

    <button

      type="button"

      onClick={() => openCartSheet()}

      className="flex w-full items-center justify-center gap-2 rounded-full bg-flame-gradient py-3 font-bold text-white shadow-glow"

    >

      <ShoppingBag className="h-4 w-4" />

      {itemCount > 0 ? `Commander (${itemCount})` : 'Commander'}

    </button>

  )

}


