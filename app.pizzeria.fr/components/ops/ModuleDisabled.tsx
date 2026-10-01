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
        Cette fonctionnalité n&apos;est pas activée sur votre compte. Contactez votre prestataire
        pour en savoir plus.
      </p>
      <Link href="/admin" className="inline-block text-sm text-tomato-light hover:underline">
        ← Retour au tableau de bord
      </Link>
    </div>
  )
}

