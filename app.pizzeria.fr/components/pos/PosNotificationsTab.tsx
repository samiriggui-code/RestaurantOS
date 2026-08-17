'use client'

import type { LucideIcon } from 'lucide-react'
import {
  Bell,
  CalendarCheck,
  ChefHat,
  Loader2,
  Package,
  RefreshCw,
  ShoppingBag,
  Truck,
  UtensilsCrossed,
  Wifi,
  WifiOff,
} from 'lucide-react'
import { usePosLive } from '@/components/pos/PosLiveProvider'
import type { PosLiveCategory } from '@/lib/pos-live-feed'
import { cn } from '@/lib/cn'
import { useEffect } from 'react'

const CATEGORY_ICON: Record<PosLiveCategory, LucideIcon> = {
  order: ShoppingBag,
  kitchen: ChefHat,
  delivery: Truck,
  stock: Package,
  reservation: CalendarCheck,
  table: UtensilsCrossed,
  system: Bell,
}

const CATEGORY_COLOR: Record<PosLiveCategory, string> = {
  order: 'text-sky-300',
  kitchen: 'text-amber-300',
  delivery: 'text-violet-300',
  stock: 'text-orange-300',
  reservation: 'text-emerald-300',
  table: 'text-red-300',
  system: 'text-cream/50',
}

function formatSyncTime(d: Date | null): string {
  if (!d) return '—'
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

/** Liste complète des alertes — ouverte depuis la tuile « Alertes ». */
export function PosNotificationsTab() {
  const { connected, refreshing, lastSyncAt, activities, refresh, markRead } = usePosLive()

  useEffect(() => {
    markRead()
  }, [markRead])

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#0a0807]">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2 text-xs text-cream/50">
          {connected ? (
            <Wifi className="h-3.5 w-3.5 text-emerald-400" />
          ) : (
            <WifiOff className="h-3.5 w-3.5 text-amber-400" />
          )}
          <span>{connected ? 'Temps réel actif' : 'Hors ligne — sync périodique'}</span>
          <span className="text-cream/25">·</span>
          <span>Màj {formatSyncTime(lastSyncAt)}</span>
        </div>
        <button
          type="button"
          disabled={refreshing}
          onClick={() => void refresh()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-cream/65 hover:bg-white/5 disabled:opacity-50"
        >
          {refreshing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Actualiser
        </button>
      </div>

      <ul className="min-h-0 flex-1 overflow-y-auto p-3">
        {activities.length === 0 ? (
          <li className="px-3 py-16 text-center text-sm text-cream/35">
            Aucune alerte récente. Commandes web, cuisine, livraisons et stock s&apos;affichent ici.
          </li>
        ) : (
          activities.map((a) => {
            const Icon = CATEGORY_ICON[a.category]
            return (
              <li
                key={a.id}
                className={cn(
                  'mb-2 flex gap-3 rounded-xl border border-white/5 px-3 py-3',
                  a.urgent ? 'bg-tomato/10 border-tomato/20' : 'bg-white/[0.02]',
                )}
              >
                <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', CATEGORY_COLOR[a.category])} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-snug text-cream">{a.title}</p>
                  {a.detail && <p className="mt-1 text-xs text-cream/45">{a.detail}</p>}
                  <p className="mt-1.5 text-[10px] text-cream/30">
                    {new Date(a.at).toLocaleTimeString('fr-FR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </li>
            )
          })
        )}
      </ul>
    </div>
  )
}
