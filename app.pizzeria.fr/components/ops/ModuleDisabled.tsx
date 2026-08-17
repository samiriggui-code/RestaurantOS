import Link from 'next/link'
import { Lock } from 'lucide-react'
import type { AppModule } from '@/lib/modules'

const LABELS: Partial<Record<AppModule, string>> = {
  tables: 'Tables & QR code',
  reservations: 'Réservations',
  shifts: 'Plannings / pointage',
  wifi: 'Portail WiFi invité',
  expenses: 'Dépenses',
  licenses: 'Licences',
  loyalty: 'Fidélité',
}

export function ModuleDisabled({
  module,
  title,
}: {
  module: AppModule
  title?: string
}) {
  const label = title ?? LABELS[module] ?? module

  return (
    <div className="mx-auto max-w-xl space-y-4 p-6 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5">
        <Lock className="h-7 w-7 text-cream/40" />
      </div>
      <h1 className="font-display text-2xl font-bold text-cream">{label}</h1>
      <p className="text-sm leading-relaxed text-cream/55">
        Ce module est <strong className="text-cream/80">désactivé pour La Z Pizza</strong> dans le
        périmètre V1. Les routes API et la structure BDD peuvent rester en place, mais l&apos;interface
        n&apos;est pas livrée en production tant que le module n&apos;est pas explicitement activé.
      </p>
      <p className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-left text-xs text-amber-100/90">
        Pour l&apos;activer : ajouter <code className="text-amber-50">{module}</code> dans{' '}
        <code className="text-amber-50">ENABLED_MODULES</code> (serveur) et{' '}
        <code className="text-amber-50">NEXT_PUBLIC_ENABLED_MODULES</code> (Next), puis redémarrer.
      </p>
      <Link href="/admin" className="inline-block text-sm text-tomato-light hover:underline">
        ← Retour au tableau de bord
      </Link>
    </div>
  )
}

