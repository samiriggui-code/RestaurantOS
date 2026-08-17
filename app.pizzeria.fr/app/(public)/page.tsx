import { LandingHeader } from '@/components/landing/LandingHeader'
import { HeroSection } from '@/components/landing/HeroSection'
import { LandingFeatures } from '@/components/landing/LandingFeatures'
import { PublicMenuShowcase } from '@/components/menu/PublicMenuShowcase'
import { FlavorGallery } from '@/components/landing/FlavorGallery'
import { LandingOffers } from '@/components/landing/LandingOffers'
import { DeliverySection } from '@/components/landing/DeliverySections'
import { CheckoutReturnBanner } from '@/components/checkout/CheckoutReturnBanner'
import { LandingFooter } from '@/components/landing/LandingFooter'
import { StickyOrderCta } from '@/components/landing/StickyOrderCta'
import { PIZZERIA } from '@/lib/pizzeria-content'

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Restaurant',
  name: PIZZERIA.name,
  description: 'Pizzeria artisanale à emporter et en livraison',
  telephone: PIZZERIA.phone,
  address: {
    '@type': 'PostalAddress',
    streetAddress: PIZZERIA.address,
    addressLocality: PIZZERIA.city,
    postalCode: PIZZERIA.postalCode,
    addressCountry: 'FR',
  },
  openingHoursSpecification: [
    {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      opens: `${PIZZERIA.hours.open}:00`,
      closes: `${PIZZERIA.hours.close}:00`,
    },
  ],
  servesCuisine: 'Italian',
  priceRange: '€€',
}

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <LandingHeader />
      <main>
        <HeroSection />
        <CheckoutReturnBanner />
        <LandingFeatures />
        <PublicMenuShowcase />
        <FlavorGallery />
        <LandingOffers />
        <DeliverySection />
      </main>
      <LandingFooter />
      <StickyOrderCta />
      <div className="h-16 md:hidden" aria-hidden />
    </>
  )
}
