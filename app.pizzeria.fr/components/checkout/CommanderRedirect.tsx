'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCart } from '@/components/cart/CartProvider'
import { loadCheckoutSession } from '@/lib/checkout-session'

/** /commander → rouvre le panier latéral sur l'accueil (plus de page checkout). */
export function CommanderRedirect() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { openCartSheet, itemCount } = useCart()

  useEffect(() => {
    const saved = loadCheckoutSession()
    const step = saved?.step && saved.step !== 'mode' ? saved.step : 'recap'
    const paymentReturn = searchParams.get('payment_intent') || searchParams.get('redirect_status')

    if (itemCount > 0) {
      openCartSheet(paymentReturn ? 'confirm' : step)
    }

    router.replace('/')
  }, [openCartSheet, router, searchParams, itemCount])

  return null
}
