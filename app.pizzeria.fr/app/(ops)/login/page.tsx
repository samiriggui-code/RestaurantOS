import { Suspense } from 'react'
import LoginPage from './login-page-client'

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-charcoal text-cream">
          Chargement…
        </div>
      }
    >
      <LoginPage />
    </Suspense>
  )
}
