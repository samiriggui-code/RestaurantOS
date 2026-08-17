'use client'

import { usePathname } from 'next/navigation'
import { OpsNav } from '@/components/ops/OpsNav'

/** Masque la barre staff sur l'écran cuisine (plein écran tablette). */
export function OpsLayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isKitchen = pathname === '/kitchen' || pathname.startsWith('/kitchen/')
  const isPos = pathname === '/pos' || pathname.startsWith('/pos/')
  const isAdmin = pathname === '/admin' || pathname.startsWith('/admin/')
  const isMonitor = pathname === '/monitor' || pathname.startsWith('/monitor/')

  const isLogin = pathname === '/login' || pathname.startsWith('/login/')

  const isDevice = isKitchen || isPos || isMonitor

  if (isLogin) {
    return <div data-ops-cockpit className="ops-main min-h-screen">{children}</div>
  }

  if (isDevice) {
    return (
      <div data-ops-cockpit className="ops-main flex h-dvh min-h-0 flex-col overflow-hidden bg-charcoal text-cream">
        {children}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-charcoal text-cream">
      {!isAdmin && !isLogin && <OpsNav />}
      <main>{children}</main>
    </div>
  )
}
