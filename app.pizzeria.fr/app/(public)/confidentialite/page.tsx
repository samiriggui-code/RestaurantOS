import type { Metadata } from 'next'
import { LegalPageShell } from '@/components/legal/LegalPageShell'
import { confidentialiteSections } from '@/lib/legal-pages-content'

export const metadata: Metadata = {
  title: 'Politique de confidentialité — La Z Pizza',
  description: 'Protection des données personnelles et cookies — La Z Pizza.',
  robots: { index: true, follow: true },
}

export default function ConfidentialitePage() {
  return (
    <LegalPageShell
      title="Politique de confidentialité"
      subtitle="Comment nous collectons, utilisons et protégeons vos données lors de vos commandes en ligne ou en boutique."
      sections={confidentialiteSections()}
    />
  )
}
