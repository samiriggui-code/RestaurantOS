import type { Metadata } from 'next'
import { Inter, Playfair_Display } from 'next/font/google'
import { CartProvider } from '@/components/cart/CartProvider'
import { CartOrderSheet } from '@/components/cart/CartOrderSheet'
import { AppFeedbackRoot } from '@/components/feedback/AppFeedbackRoot'
import './globals.css'

const display = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
})

/** Inter — même choix que gsms-school / Metronic (--font-deploy-sans) */
const sans = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'La Z Pizza — Fargues-Saint-Hilaire (33370)',
    template: '%s | La Z Pizza',
  },
  description:
    'Pizzas artisanales à emporter et en livraison à Fargues-Saint-Hilaire. Pâte maison, produits frais. Ouvert 7j/7 de 18h à 22h.',
  keywords: ['pizza', 'Fargues-Saint-Hilaire', 'livraison', 'à emporter', '33370', 'Bordeaux'],
  openGraph: {
    title: 'La Z Pizza — Pizza à Fargues-Saint-Hilaire',
    description: 'Commandez en ligne — à emporter et livraison 7j/7',
    locale: 'fr_FR',
    type: 'website',
  },
  icons: {
    icon: [{ url: '/brand/icon.svg', type: 'image/svg+xml' }],
    apple: [{ url: '/brand/apple-icon.svg', type: 'image/svg+xml' }],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${display.variable} ${sans.variable}`} data-scroll-behavior="smooth">
      <body className="min-h-screen bg-charcoal font-sans antialiased">
        <AppFeedbackRoot>
          <CartProvider>
            {children}
            <CartOrderSheet />
          </CartProvider>
        </AppFeedbackRoot>
      </body>
    </html>
  )
}
