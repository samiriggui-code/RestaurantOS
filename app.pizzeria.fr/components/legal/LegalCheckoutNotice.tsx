import Link from 'next/link'
import { LEGAL_ROUTES } from '@/lib/legal-identity'

export function LegalCheckoutNotice({ compact }: { compact?: boolean }) {
  return (
    <p className={compact ? 'text-[10px] leading-relaxed text-cream/40' : 'text-xs leading-relaxed text-cream/45'}>
      En validant votre commande, vous acceptez nos{' '}
      <Link href={LEGAL_ROUTES.cgv} className="text-tomato-light/90 hover:underline">
        CGV
      </Link>{' '}
      et notre{' '}
      <Link href={LEGAL_ROUTES.privacy} className="text-tomato-light/90 hover:underline">
        politique de confidentialité
      </Link>
      .
    </p>
  )
}
