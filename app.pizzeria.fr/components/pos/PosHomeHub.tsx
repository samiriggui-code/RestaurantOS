'use client'

import type { LucideIcon } from 'lucide-react'
import {
  Bell,
  CalendarCheck,
  ChefHat,
  Loader2,
  Lock,
  Package,
  RefreshCw,
  Settings2,
  ShoppingBag,
  UtensilsCrossed,
  Wallet,
  Wifi,
} from 'lucide-react'
import { AppModuleBrand } from '@/components/brand/AppModuleBrand'
import { usePosLive } from '@/components/pos/PosLiveProvider'
import { cn } from '@/lib/cn'

export type PosModuleId =
  | 'commande'
  | 'cuisine'
  | 'salles'
  | 'reservations'
  | 'wifi'
  | 'stock'
  | 'params'
  | 'alertes'
  | 'session'

export type PosModuleCard = {
  id: PosModuleId
  label: string
  description: string
  icon: LucideIcon
  accent: string
}

export const POS_MODULES: PosModuleCard[] = [
  {
    id: 'commande',
    label: 'Nouvelle vente',
    description: 'Encaisser · comptoir, emporter, livraison',
    icon: ShoppingBag,
    accent: 'from-tomato/25 to-tomato/5 border-tomato/30',
  },
  {
    id: 'cuisine',
    label: 'File cuisine',
    description: 'Prépa · remise client · livraisons',
    icon: ChefHat,
    accent: 'from-amber-500/20 to-amber-500/5 border-amber-500/25',
  },
  {
    id: 'salles',
    label: 'Salles & tables',
    description: 'Plan de salle · occupation',
    icon: UtensilsCrossed,
    accent: 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/25',
  },
  {
    id: 'reservations',
    label: 'Réservations',
    description: 'Arrivées du jour',
    icon: CalendarCheck,
    accent: 'from-sky-500/20 to-sky-500/5 border-sky-500/25',
  },
  {
    id: 'wifi',
    label: 'WiFi invité',
    description: 'Portail captif · vouchers',
    icon: Wifi,
    accent: 'from-violet-500/20 to-violet-500/5 border-violet-500/25',
  },
  {
    id: 'stock',
    label: 'Stock live',
    description: 'Niveaux · alertes rupture',
    icon: Package,
    accent: 'from-orange-500/20 to-orange-500/5 border-orange-500/25',
  },
  {
    id: 'params',
    label: 'Périphériques',
    description: 'Imprimantes · TPE · tests',
    icon: Settings2,
    accent: 'from-cream/10 to-cream/5 border-white/15',
  },
  {
    id: 'session',
    label: 'Session caisse',
    description: 'Ouverture/fermeture · fusion de notes',
    icon: Wallet,
    accent: 'from-teal-500/20 to-teal-500/5 border-teal-500/25',
  },
  {
    id: 'alertes',
    label: 'Alertes',
    description: 'Commandes · livraisons · stock',
    icon: Bell,
    accent: 'from-rose-500/20 to-rose-500/5 border-rose-500/25',
  },
]

function firstName(full: string): string {
  return full.trim().split(/\s+/)[0] ?? full
}

function timeGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Bonjour'
  if (h < 18) return 'Bon après-midi'
  return 'Bonsoir'
}

function formatToday(): string {
  return new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

type HomeProps = {
  operatorName: string
  onSelect: (id: PosModuleId) => void
  onLock: () => void
}

export function PosHomeHub({ operatorName, onSelect, onLock }: HomeProps) {
  const name = firstName(operatorName)
  const { refresh, refreshing, unreadCount, connected } = usePosLive()

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#0a0807]">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-6">
        <AppModuleBrand variant="pos" subtitle={operatorName} />
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={refreshing}
            onClick={() => void refresh()}
            title="Actualiser"
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-xs font-medium text-cream/70 transition hover:bg-white/5 disabled:opacity-50"
          >
            {refreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">Actualiser</span>
          </button>
          <button
            type="button"
            onClick={onLock}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-medium text-cream/60 transition hover:border-amber-500/30 hover:bg-amber-500/10 hover:text-amber-100"
          >
            <Lock className="h-4 w-4" />
            <span className="hidden sm:inline">Verrouiller</span>
          </button>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-8 sm:py-6">
        <div className="mx-auto max-w-4xl space-y-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-tomato-light/80">
              {formatToday()}
            </p>
            <h1 className="mt-2 font-display text-3xl font-bold text-cream sm:text-4xl">
              {timeGreeting()}, {name}
            </h1>
            <p className="mt-2 max-w-lg text-sm text-cream/50">
              Choisissez un module ci-dessous. Les alertes (commandes, livraisons, stock) sont dans la tuile
              « Alertes ».
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
            {POS_MODULES.map((mod) => {
              const Icon = mod.icon
              const badge = mod.id === 'alertes' && unreadCount > 0
              return (
                <button
                  key={mod.id}
                  type="button"
                  onClick={() => onSelect(mod.id)}
                  className={cn(
                    'group relative flex flex-col rounded-2xl border bg-gradient-to-br p-4 text-left transition active:scale-[0.98] sm:p-5',
                    mod.accent,
                    'hover:brightness-110',
                  )}
                >
                  {badge && (
                    <span className="absolute right-3 top-3 flex h-5 min-w-5 items-center justify-center rounded-full bg-tomato px-1 text-[10px] font-bold text-white">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                  <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-black/25 text-tomato-light transition group-hover:bg-black/35 sm:h-12 sm:w-12">
                    <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
                  </span>
                  <span className="font-display text-base font-semibold text-cream sm:text-lg">{mod.label}</span>
                  <span className="mt-1 line-clamp-2 text-[11px] leading-snug text-cream/45 sm:text-xs">
                    {mod.description}
                    {mod.id === 'alertes' && connected ? ' · live' : ''}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </main>
    </div>
  )
}

type ShellProps = {
  title: string
  operatorName: string | null
  onHome: () => void
  onLock: () => void
  children: React.ReactNode
}

export function PosModuleShell({ title, operatorName, onHome, onLock, children }: ShellProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-charcoal">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-white/10 bg-[#0d0a09] px-3 sm:px-4">
        <button
          type="button"
          onClick={onHome}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-tomato-light hover:bg-white/5"
        >
          ← Accueil
        </button>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-cream">{title}</span>
        {operatorName && (
          <span className="hidden truncate text-xs text-cream/40 sm:block">{operatorName}</span>
        )}
        <button
          type="button"
          onClick={onLock}
          title="Verrouiller"
          className="rounded-lg p-2 text-cream/50 hover:bg-amber-500/10 hover:text-amber-200"
        >
          <Lock className="h-4 w-4" />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
    </div>
  )
}

export function getPosModuleLabel(id: PosModuleId): string {
  return POS_MODULES.find((m) => m.id === id)?.label ?? id
}
