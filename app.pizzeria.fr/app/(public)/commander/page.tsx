import { Suspense } from 'react'
import { CommanderRedirect } from '@/components/checkout/CommanderRedirect'

export const metadata = {
  title: 'Commander',
}

export default function CommanderPage() {
  return (
    <Suspense fallback={null}>
      <CommanderRedirect />
    </Suspense>
  )
}
