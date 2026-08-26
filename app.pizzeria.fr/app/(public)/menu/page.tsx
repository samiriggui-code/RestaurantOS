import Link from 'next/link'
import { cn } from '@/lib/cn'
import { LandingHeader } from '@/components/landing/LandingHeader'
import { SITE_MAIN_OFFSET } from '@/lib/site-layout'
import { LandingFooter } from '@/components/landing/LandingFooter'
import { PublicMenuTabs } from '@/components/menu/PublicMenuTabs'
import { CheckoutReturnBanner } from '@/components/checkout/CheckoutReturnBanner'

export default function MenuPage() {
  return (
    <>
      <LandingHeader />
      <div className={cn(SITE_MAIN_OFFSET, 'min-h-screen bg-charcoal pb-8')}>
        <div className="border-b border-white/5 bg-charcoal pb-8">
          <div className="mx-auto max-w-7xl px-4 md:px-6">
            <Link href="/" className="text-sm text-cream/55 hover:text-cream">
              ← Accueil
            </Link>
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.25em] text-tomato-light">
              Notre carte
            </p>
            <h1 className="mt-2 font-display text-4xl tracking-tight text-cream md:text-5xl">
              Pizzas du <em className="text-flame-gradient not-italic font-semibold">moment</em>
            </h1>
            <p className="mt-3 text-sm text-cream/55">7j/7 · 18h – 22h</p>
          </div>
        </div>

        <CheckoutReturnBanner />
        <PublicMenuTabs />
      </div>
      <LandingFooter />
    </>
  )
}
