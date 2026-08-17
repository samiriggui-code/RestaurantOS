import Link from 'next/link'
import { Bike, ChefHat, ExternalLink, Store, Tablet } from 'lucide-react'

const APPS = [
  {
    href: '/pos',
    label: 'Caisse POS',
    desc: 'Terminal — prise de commande, PIN employé',
    icon: Store,
    tone: 'border-tomato/30 bg-tomato/10 hover:bg-tomato/15',
  },
  {
    href: '/kitchen',
    label: 'Écran cuisine (KDS)',
    desc: 'Tablette — commandes en cours, PIN employé',
    icon: ChefHat,
    tone: 'border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/15',
  },
  {
    href: '/livreur',
    label: 'App livreur',
    desc: 'Smartphone — tournées, PIN livreur',
    icon: Bike,
    tone: 'border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/15',
  },
  {
    href: '/kiosk',
    label: 'Totem kiosque',
    desc: 'Écran self-service — commande sur place / emporter',
    icon: Tablet,
    tone: 'border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/15',
  },
] as const

export function DeviceLaunchCards({ compact }: { compact?: boolean }) {
  return (
    <div className={compact ? 'grid gap-3 sm:grid-cols-2 lg:grid-cols-4' : 'grid gap-4 sm:grid-cols-2 lg:grid-cols-4'}>
      {APPS.map((app) => {
        const Icon = app.icon
        return (
          <Link
            key={app.href}
            href={app.href}
            target="_blank"
            rel="noopener noreferrer"
            className={`group flex flex-col rounded-2xl border p-5 transition-colors ${app.tone}`}
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <Icon className="h-8 w-8 text-cream" />
              <ExternalLink className="h-4 w-4 text-cream/40 group-hover:text-cream/70" />
            </div>
            <p className="font-display text-lg font-bold text-cream">{app.label}</p>
            <p className="mt-1 text-sm text-cream/55">{app.desc}</p>
            {!compact && (
              <span className="mt-4 inline-block text-sm font-semibold text-tomato-light">
                Ouvrir en plein écran →
              </span>
            )}
          </Link>
        )
      })}
    </div>
  )
}
