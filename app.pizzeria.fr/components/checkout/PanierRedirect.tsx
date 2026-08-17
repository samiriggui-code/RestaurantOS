'use client'

import { Suspense, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useCart } from '@/components/cart/CartProvider'
import type { CheckoutStepId } from '@/lib/checkout-flow'

function OpenCartRedirect({ step }: { step?: CheckoutStepId }) {
  const router = useRouter()
  const { openCartSheet } = useCart()

  useEffect(() => {
    openCartSheet(step ?? 'recap')
    router.replace('/')
  }, [openCartSheet, router, step])

  return null
}

export function PanierRedirect() {
  return (
    <Suspense fallback={null}>
      <OpenCartRedirect step="recap" />
    </Suspense>
  )
}
