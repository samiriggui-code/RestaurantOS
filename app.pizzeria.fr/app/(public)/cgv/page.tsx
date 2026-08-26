import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalPageShell } from '@/components/legal/LegalPageShell'
import { cgvSections } from '@/lib/legal-pages-content'
import { LEGAL_ROUTES } from '@/lib/legal-identity'

export const metadata: Metadata = {
  title: 'Conditions générales de vente — La Z Pizza',
  description: 'CGV — commande, paiement, livraison et réclamations — La Z Pizza.',
  robots: { index: true, follow: true },
}

export default function CgvPage() {
  return (
    <LegalPageShell
      title="Conditions générales de vente"
      subtitle="Applicables à toute commande passée en ligne, au comptoir ou par téléphone auprès de La Z Pizza."
      sections={cgvSections()}
    >
      <p className="mt-6 text-sm text-cream/50">
        Politique de confidentialité :{' '}
        <Link href={LEGAL_ROUTES.privacy} className="text-tomato-light hover:underline">
          Confidentialité
        </Link>
        {' · '}
        <Link href={LEGAL_ROUTES.delivery} className="text-tomato-light hover:underline">
          Livraison
        </Link>
      </p>
    </LegalPageShell>
  )
}
