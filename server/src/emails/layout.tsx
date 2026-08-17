import type { ReactNode } from 'react'
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import { BRAND, type BusinessEmailContext } from './brand'
import { BRAND_LOGO_ON_PRIMARY_URI } from './brand-logo'

type LayoutProps = BusinessEmailContext & {
  preview: string
  title: string
  children: ReactNode
}

export function EmailLayout({
  preview,
  title,
  businessName,
  legalName,
  logoUrl,
  address,
  phone,
  siret,
  siren,
  vatNumber,
  nafCode,
  nafLabel,
  legalForm,
  website,
  children,
}: LayoutProps) {
  const name = businessName || BRAND.name
  const legal = legalName || name
  const logoSrc = logoUrl || BRAND_LOGO_ON_PRIMARY_URI

  return (
    <Html lang="fr">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={header}>
            <Link href={BRAND.siteUrl} style={logoLink}>
              <Img
                src={logoSrc}
                alt={`${name} — logo`}
                width={200}
                height={48}
                style={logoImg}
              />
            </Link>
            <Text style={tagline}>{BRAND.tagline}</Text>
          </Section>
          <Section style={content}>
            <Heading as="h2" style={h2}>
              {title}
            </Heading>
            {children}
          </Section>
          <Hr style={hr} />
          <Section>
            {address ? <Text style={footer}>{address}</Text> : null}
            {phone ? <Text style={footer}>Tél. {phone}</Text> : null}
            {legal !== name ? <Text style={footer}>{legal}</Text> : null}
            {siren ? <Text style={footer}>SIREN {siren}</Text> : null}
            {siret ? <Text style={footer}>SIRET {siret}</Text> : null}
            {vatNumber ? <Text style={footer}>TVA {vatNumber}</Text> : null}
            {nafCode ? (
              <Text style={footer}>
                NAF {nafCode}
                {nafLabel ? ` — ${nafLabel}` : ''}
                {legalForm ? ` · ${legalForm}` : ''}
              </Text>
            ) : null}
            {website ? (
              <Text style={footer}>
                <Link href={website} style={footerLink}>
                  {website.replace(/^https?:\/\//, '')}
                </Link>
              </Text>
            ) : null}
            <Text style={footerMuted}>© {name} — Merci de votre confiance</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

const body = {
  backgroundColor: '#f4f1ec',
  fontFamily: 'Segoe UI, Helvetica, Arial, sans-serif',
  margin: 0,
  padding: '24px 0',
}

const container = {
  backgroundColor: '#ffffff',
  borderRadius: '12px',
  margin: '0 auto',
  maxWidth: '560px',
  overflow: 'hidden' as const,
  border: '1px solid #e8e0d5',
}

const header = {
  backgroundColor: BRAND.primary,
  padding: '20px 32px 18px',
}

const logoLink = {
  display: 'block',
  lineHeight: '100%',
  marginBottom: '6px',
  textDecoration: 'none',
}

const logoImg = {
  display: 'block',
  margin: 0,
  maxWidth: '200px',
}

const tagline = {
  color: '#fde8e6',
  fontSize: '13px',
  margin: 0,
}

const content = {
  padding: '28px 32px',
}

const h2 = {
  color: BRAND.dark,
  fontSize: '20px',
  margin: '0 0 16px',
}

const hr = {
  borderColor: '#e8e0d5',
  margin: '0 32px',
}

const footer = {
  color: '#5c534a',
  fontSize: '12px',
  lineHeight: '18px',
  margin: '0 32px 4px',
}

const footerMuted = {
  color: '#9a9088',
  fontSize: '11px',
  margin: '8px 32px 24px',
}

const footerLink = {
  color: '#5c534a',
  textDecoration: 'underline',
}
