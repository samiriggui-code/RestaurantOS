import { Suspense } from 'react'
import { CommanderRedirect } from '@/components/checkout/CommanderRedirect'

export const metadata = {
  title: 'Paiement',
}

export default function PanierCheckoutPage() {
  return (
    <Suspense fallback={null}>
      <CommanderRedirect />
    </Suspense>
  )
}
