'use client'

import { Suspense, useEffect } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useCart } from '@/components/cart/CartProvider'

function SuiviRedirectInner() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const { setActiveTracking, openCartSheet } = useCart()

  useEffect(() => {
    const token = typeof params.token === 'string' ? params.token : ''
    if (!token) {
      router.replace('/')
      return
    }
    const raw = searchParams.get('n')
    const orderNumber = raw ? parseInt(raw, 10) : 0
    setActiveTracking({
      token,
      orderNumber: Number.isFinite(orderNumber) ? orderNumber : 0,
    })
    openCartSheet()
    router.replace('/')
  }, [params.token, searchParams, setActiveTracking, openCartSheet, router])

  return null
}

/** Lien /suivi/[token] → panier latéral sur l'accueil */
export function SuiviRedirect() {
  return (
    <Suspense fallback={null}>
      <SuiviRedirectInner />
    </Suspense>
  )
}
