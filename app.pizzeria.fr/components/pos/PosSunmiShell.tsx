'use client'

import type { ReactNode } from 'react'
import { Bell, CreditCard, Package, ShoppingCart } from 'lucide-react'
import { cn } from '@/lib/cn'

export type PosSunmiTab = 'catalog' | 'cart' | 'online' | 'ready'

const TABS: { id: PosSunmiTab; label: string; icon: typeof ShoppingCart }[] = [
  { id: 'catalog', label: 'Commander', icon: ShoppingCart },
  { id: 'cart', label: 'Encaisser', icon: CreditCard },
  { id: 'online', label: 'À encaisser', icon: Bell },
  { id: 'ready', label: 'Remises', icon: Package },
]

type Props = {
  active: PosSunmiTab
  onChange: (tab: PosSunmiTab) => void
  cartCount: number
  onlineCount: number
  readyCount: number
  catalog: ReactNode
  cart: ReactNode
  online: ReactNode
  ready: ReactNode
}

export function PosSunmiShell({
  active,
  onChange,
  cartCount,
  onlineCount,
  readyCount,
  catalog,
  cart,
  online,
  ready,
}: Props) {
  const badges: Record<PosSunmiTab, number> = {
    catalog: 0,
    cart: cartCount,
    online: onlineCount,
    ready: readyCount,
  }

  const panel =
    active === 'catalog' ? catalog : active === 'cart' ? cart : active === 'online' ? online : ready

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-hidden">{panel}</div>
      <nav className="flex shrink-0 border-t border-white/10 bg-[#141010]">
        {TABS.map((tab) => {
          const Icon = tab.icon
          const count = badges[tab.id]
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={cn(
                'relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-semibold',
                active === tab.id ? 'text-tomato-light' : 'text-cream/45'
              )}
            >
              <Icon className="h-5 w-5" />
              {tab.label}
              {count > 0 && (
                <span className="absolute right-[18%] top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-tomato px-1 text-[9px] font-bold text-white">
                  {count > 9 ? '9+' : count}
                </span>
              )}
            </button>
          )
        })}
      </nav>
    </div>
  )
}
