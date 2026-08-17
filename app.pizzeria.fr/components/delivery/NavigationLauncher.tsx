'use client'

import { useMemo, useState } from 'react'
import { MapPin, Navigation, X } from 'lucide-react'
import {
  buildNavigationApps,
  openNavigationUrl,
  primaryNavigationApps,
  type NavigationDestination,
} from '@/lib/navigation-apps'
import type { LatLng } from '@/lib/route-optimize'
import { cn } from '@/lib/cn'

const APP_ICONS: Record<string, string> = {
  'google-maps': '🗺️',
  'google-maps-app': '🗺️',
  'apple-maps': '🍎',
  'apple-maps-web': '🍎',
  waze: '🚗',
  'waze-app': '🚗',
  geo: '📍',
  osm: '🌐',
}

type Props = {
  destination: NavigationDestination
  origin?: LatLng | null
  variant?: 'button' | 'inline'
  className?: string
  onLaunched?: () => void
}

export function NavigationLauncher({
  destination,
  origin,
  variant = 'button',
  className,
  onLaunched,
}: Props) {
  const [open, setOpen] = useState(false)
  const primary = useMemo(() => primaryNavigationApps(destination, origin), [destination, origin])
  const all = useMemo(() => buildNavigationApps(destination, origin), [destination, origin])

  function launch(url: string) {
    openNavigationUrl(url)
    onLaunched?.()
    setOpen(false)
  }

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setOpen(true)
        }}
        className={cn(
          variant === 'button'
            ? 'flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 py-4 text-sm font-bold text-white shadow-lg shadow-violet-900/30'
            : 'flex w-full items-center justify-center gap-1.5 rounded-lg border border-violet-500/30 bg-violet-500/10 py-2 text-xs font-semibold text-violet-200',
          className,
        )}
      >
        <Navigation className={variant === 'button' ? 'h-5 w-5' : 'h-3.5 w-3.5'} />
        {variant === 'button' ? 'Y aller — Plans / Maps / Waze' : 'Navigation'}
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/80 p-4 sm:items-center">
          <div className="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/10 bg-[#1A1412] p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-bold text-cream">Lancer la navigation</h2>
                <p className="mt-1 text-xs text-cream/50">
                  Choisissez l&apos;app installée sur votre téléphone. Une fois arrivé chez le client,
                  revenez ici pour saisir le code de livraison.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1 text-cream/50 hover:bg-white/10"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {destination.address && (
              <p className="mb-4 flex items-start gap-2 rounded-xl border border-white/10 bg-charcoal/80 px-3 py-2 text-xs text-cream/70">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {destination.label ? (
                  <span>
                    <strong className="text-cream">{destination.label}</strong>
                    <br />
                    {destination.address}
                  </span>
                ) : (
                  destination.address
                )}
              </p>
            )}

            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-cream/40">
              Recommandé
            </p>
            <ul className="mb-4 space-y-2">
              {primary.map((app) => (
                <li key={app.id}>
                  <button
                    type="button"
                    onClick={() => launch(app.url)}
                    className="flex w-full items-center gap-3 rounded-xl border border-violet-500/35 bg-violet-500/10 px-4 py-3.5 text-left active:bg-violet-500/20"
                  >
                    <span className="text-2xl">{APP_ICONS[app.id] ?? '📍'}</span>
                    <div>
                      <p className="font-bold text-cream">{app.name}</p>
                      <p className="text-xs text-cream/45">{app.description}</p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>

            {all.length > primary.length && (
              <>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-cream/40">
                  Autres options
                </p>
                <ul className="space-y-1.5">
                  {all
                    .filter((a) => !primary.some((p) => p.id === a.id))
                    .map((app) => (
                      <li key={app.id}>
                        <button
                          type="button"
                          onClick={() => launch(app.url)}
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-cream/70 hover:bg-white/5"
                        >
                          <span>{APP_ICONS[app.id] ?? '·'}</span>
                          {app.name}
                        </button>
                      </li>
                    ))}
                </ul>
              </>
            )}

            <p className="mt-4 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-center text-[11px] text-amber-100/90">
              Après la livraison : revenez sur cette page du navigateur pour entrer le{' '}
              <strong>code client à 4 chiffres</strong>, puis passez à la livraison suivante.
            </p>
          </div>
        </div>
      )}
    </>
  )
}
