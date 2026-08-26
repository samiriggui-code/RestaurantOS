import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalPageShell } from '@/components/legal/LegalPageShell'
import { livraisonSections } from '@/lib/legal-pages-content'
import { LEGAL_ROUTES } from '@/lib/legal-identity'
import { PIZZERIA } from '@/lib/pizzeria-content'
import { DeliveryZonesTable } from '@/components/legal/DeliveryZonesTable'

export const metadata: Metadata = {
  title: 'Livraison — La Z Pizza',
  description: 'Zones, minimums, frais et horaires de livraison à Fargues-Saint-Hilaire et communes voisines.',
  robots: { index: true, follow: true },
}

export default function LivraisonPage() {
  return (
    <LegalPageShell
      title="Livraison"
      subtitle="Zones desservies, minimum de commande, frais et modalités — commande en ligne ou par téléphone."
      sections={livraisonSections()}
      insertAfter={{ minimum: <DeliveryZonesTable /> }}
    >
      <div className="rounded-2xl border border-tomato/30 bg-tomato/10 p-5 sm:p-6">
        <p className="font-semibold text-cream">Commander maintenant</p>
        <p className="mt-2 text-sm text-cream/65">
          Choisissez vos pizzas en ligne — livraison ou retrait au {PIZZERIA.address}, {PIZZERIA.city}.
        </p>
        <Link
          href="/menu"
          className="mt-4 inline-flex rounded-full bg-flame-gradient px-6 py-2.5 text-sm font-semibold text-white hover:brightness-110"
        >
          Voir la carte
        </Link>
      </div>
      <p className="mt-6 text-sm text-cream/50">
        Conditions générales de vente :{' '}
        <Link href={LEGAL_ROUTES.cgv} className="text-tomato-light hover:underline">
          CGV
        </Link>
      </p>
    </LegalPageShell>
  )
}
