import Link from 'next/link'
import { Fragment } from 'react'
import { cn } from '@/lib/cn'
import { LandingHeader } from '@/components/landing/LandingHeader'
import { LandingFooter } from '@/components/landing/LandingFooter'
import { SITE_MAIN_OFFSET } from '@/lib/site-layout'
import { LEGAL_FOOTER_LINKS } from '@/lib/legal-identity'

export type LegalSection = {
  id: string
  title: string
  paragraphs?: string[]
  bullets?: string[]
}

/** Même largeur utile que le footer / sections landing (pas max-w-3xl étroit). */
const LEGAL_CONTAINER = 'mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8'

type Props = {
  title: string
  subtitle?: string
  sections: LegalSection[]
  /** Contenu injecté juste après une section (ex. tableau zones livraison). */
  insertAfter?: Partial<Record<string, React.ReactNode>>
  children?: React.ReactNode
}

export function LegalPageShell({ title, subtitle, sections, insertAfter, children }: Props) {
  return (
    <>
      <LandingHeader />
      <div className={cn(SITE_MAIN_OFFSET, 'min-h-screen bg-charcoal pb-8 sm:pb-12')}>
        <div className="border-b border-white/5 bg-charcoal pb-8 sm:pb-10">
          <div className={LEGAL_CONTAINER}>
            <Link href="/" className="text-sm text-cream/55 hover:text-cream">
              ← Accueil
            </Link>
            <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.25em] text-tomato-light sm:mt-4 sm:text-xs">
              Informations légales
            </p>
            <h1 className="mt-2 font-display text-2xl tracking-tight text-cream sm:text-3xl md:text-4xl">
              {title}
            </h1>
            {subtitle ? (
              <p className="mt-3 max-w-4xl text-sm leading-relaxed text-cream/55 sm:text-base">{subtitle}</p>
            ) : null}
          </div>
        </div>

        <article className={cn(LEGAL_CONTAINER, 'py-8 sm:py-10')}>
          <nav
            aria-label="Autres pages légales"
            className="mb-8 grid grid-cols-2 gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-2 sm:mb-10 sm:flex sm:flex-wrap"
          >
            {LEGAL_FOOTER_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-lg px-3 py-2 text-center text-xs font-medium text-cream/60 transition hover:bg-white/5 hover:text-cream sm:py-1.5 sm:text-left sm:text-sm"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="space-y-8 sm:space-y-10">
            {sections.map((section) => (
              <Fragment key={section.id}>
                <section id={section.id} className="scroll-mt-[calc(var(--site-header-offset)+1rem)]">
                  <h2 className="font-display text-lg font-semibold text-cream sm:text-xl">{section.title}</h2>
                  {section.paragraphs?.map((p) => (
                    <p
                      key={p.slice(0, 48)}
                      className="mt-3 text-sm leading-relaxed text-cream/65 sm:text-base sm:leading-7"
                    >
                      {p}
                    </p>
                  ))}
                  {section.bullets?.length ? (
                    <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-cream/65 sm:text-base sm:leading-7">
                      {section.bullets.map((item) => (
                        <li key={item.slice(0, 48)} className="break-words">
                          {item}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </section>
                {insertAfter?.[section.id] ? (
                  <div className="mt-4 sm:mt-5">{insertAfter[section.id]}</div>
                ) : null}
              </Fragment>
            ))}
          </div>

          {children}

          <p className="mt-10 border-t border-white/10 pt-6 text-xs text-cream/40 sm:mt-12">
            Dernière mise à jour : {new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
          </p>
        </article>
      </div>
      <LandingFooter />
    </>
  )
}
