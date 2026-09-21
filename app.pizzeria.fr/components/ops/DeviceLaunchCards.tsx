'use client'

import { Bike, ChefHat, Download, ExternalLink, Store, Tablet } from 'lucide-react'
import { isModuleEnabled } from '@/lib/modules'
import {
  OPS_APPS,
  opsAppApkUrl,
  opsAppOpenUrl,
  type OpsAppId,
} from '@/lib/ops-apps'

const ICONS: Record<OpsAppId, typeof Store> = {
  pos: Store,
  kitchen: ChefHat,
  livreur: Bike,
  kiosk: Tablet,
}

const TONES: Record<OpsAppId, string> = {
  pos: 'border-tomato/30 bg-tomato/10 hover:bg-tomato/15',
  kitchen: 'border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/15',
  livreur: 'border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/15',
  kiosk: 'border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/15',
}

export function DeviceLaunchCards({ compact }: { compact?: boolean }) {
  return (
    <div
      className={
        compact ? 'grid gap-3 sm:grid-cols-2 lg:grid-cols-4' : 'grid gap-4 sm:grid-cols-2 lg:grid-cols-4'
      }
    >
      {OPS_APPS.filter(
        (app) =>
          (app.id !== 'pos' || isModuleEnabled('pos')) &&
          (app.id !== 'kiosk' || isModuleEnabled('kiosk')),
      ).map((app) => {
        const Icon = ICONS[app.id]
        const openUrl = opsAppOpenUrl(app)
        const apkUrl = opsAppApkUrl(app)
        return (
          <div
            key={app.id}
            className={`flex flex-col rounded-2xl border p-5 transition-colors ${TONES[app.id]}`}
          >
            <a
              href={openUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex min-h-0 flex-1 flex-col"
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <Icon className="h-8 w-8 text-cream" />
                <ExternalLink className="h-4 w-4 text-cream/40 group-hover:text-cream/70" />
              </div>
              <p className="font-display text-lg font-bold text-cream">{app.label}</p>
              <p className="mt-1 text-sm text-cream/55">{app.desc}</p>
              {!compact && (
                <span className="mt-4 inline-block text-sm font-semibold text-tomato-light">
                  Ouvrir l&apos;app →
                </span>
              )}
            </a>
            {apkUrl ? (
              <a
                href={apkUrl}
                className="mt-3 inline-flex items-center gap-1.5 border-t border-white/10 pt-3 text-xs font-medium text-cream/50 hover:text-cream"
                download
              >
                <Download className="h-3.5 w-3.5" />
                Télécharger APK
              </a>
            ) : (
              <p className="mt-3 border-t border-white/10 pt-3 text-xs text-cream/35">
                Web plein écran — pas d&apos;APK
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}
