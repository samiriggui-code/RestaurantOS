import type { Metadata } from 'next'
import { LegalPageShell } from '@/components/legal/LegalPageShell'
import { mentionsLegalesSections } from '@/lib/legal-pages-content'

export const metadata: Metadata = {
  title: 'Mentions légales — La Z Pizza',
  description: 'Informations légales, éditeur du site et hébergement — La Z Pizza Fargues-Saint-Hilaire.',
  robots: { index: true, follow: true },
}

export default function MentionsLegalesPage() {
  return (
    <LegalPageShell
      title="Mentions légales"
      subtitle="Informations relatives à l'éditeur du site et à l'hébergement, conformément à la loi pour la confiance dans l'économie numérique (LCEN)."
      sections={mentionsLegalesSections()}
    />
  )
}
