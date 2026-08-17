'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ChefHat, LayoutDashboard, LogOut, ShoppingBag, Store } from 'lucide-react'
import { BrandLogo } from '@/components/brand/BrandLogo'
import { clearCrmSession } from '@/lib/staff-auth'
import { cn } from '@/lib/cn'

const LINKS = [
  { href: '/admin', label: 'Tableau de bord', icon: LayoutDashboard, exact: true },
  { href: '/admin/orders', label: 'Commandes', icon: ShoppingBag },
  { href: '/admin/kitchen', label: 'Suivi cuisine', icon: ChefHat },
  { href: '/admin/pos', label: 'Suivi caisse', icon: Store },
]

export function OpsNav() {
  const pathname = usePathname()
  const router = useRouter()

  function logout() {
    clearCrmSession()
    router.push('/login')
  }

  return (
    <header className="border-b border-white/10 bg-[#120e0c]">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link href="/admin" className="flex items-center gap-3">
          <BrandLogo className="h-8 w-auto" />
          <span className="hidden text-xs text-cream/40 sm:inline">Back-office</span>
        </Link>
        <nav className="flex flex-wrap items-center gap-1">
          {LINKS.map(({ href, label, icon: Icon, exact }) => {
            const active = exact ? pathname === href : pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-tomato/20 text-tomato-light'
                    : 'text-cream/60 hover:bg-white/5 hover:text-cream'
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            )
          })}
          <button
            type="button"
            onClick={logout}
            className="ml-1 inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-cream/50 hover:bg-white/5 hover:text-cream"
          >
            <LogOut className="h-4 w-4" />
            Déconnexion
          </button>
        </nav>
      </div>
    </header>
  )
}
