'use client'

import { HeroVideo } from '@/components/ui/HeroVideo'
import { AUTH_LOGIN_VIDEO } from '@/lib/media'

/** Layout connexion compact — formulaire à gauche, vidéo cuisine à droite. */
export function AuthBrandedLayout({
  children,
  title,
  subtitle,
}: {
  children: React.ReactNode
  title: string
  subtitle?: string
}) {
  return (
    <div className="grid h-[100dvh] max-h-[100dvh] w-full overflow-hidden lg:grid-cols-2">
      <div className="flex items-center justify-center overflow-y-auto p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-[380px] rounded-2xl border border-white/10 bg-[#1A1412] p-5 shadow-2xl sm:p-6">
          <div className="mb-4 space-y-0.5 text-center lg:text-left">
            <h1 className="font-display text-xl font-bold text-cream sm:text-2xl">{title}</h1>
            {subtitle ? <p className="text-xs text-cream/55 sm:text-sm">{subtitle}</p> : null}
          </div>
          {children}
        </div>
      </div>

      <div className="relative hidden overflow-hidden bg-charcoal lg:block lg:m-3 lg:rounded-2xl lg:border lg:border-white/10">
        <HeroVideo src={AUTH_LOGIN_VIDEO} className="absolute inset-0" videoClassName="object-cover object-center" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-charcoal/80 via-charcoal/20 to-charcoal/30" />
        <div className="absolute bottom-6 left-6 rounded-2xl border border-white/10 bg-charcoal/90 px-4 py-2.5 shadow-xl backdrop-blur">
          <p className="text-[11px] text-cream/50">Lun – Jeu</p>
          <p className="font-bold text-cream">Méga à 18 €</p>
        </div>
        <div className="absolute right-6 top-6 rounded-2xl border border-emerald-500/30 bg-emerald-950/90 px-3 py-2 shadow-xl backdrop-blur">
          <p className="text-xs font-semibold text-emerald-300">Livraison 10 km</p>
        </div>
        <div className="absolute bottom-6 right-6 max-w-[200px] text-right">
          <p className="text-[10px] uppercase tracking-[0.2em] text-tomato/80">RestaurantOS</p>
          <p className="font-display text-lg font-bold text-cream">La Z Pizza</p>
        </div>
      </div>
    </div>
  )
}
