import type { ReactNode } from 'react'
import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Link,
  Section,
  Text,
} from '@react-email/components'
import { BRAND, type BusinessEmailContext } from './brand'
import { BRAND_LOGO_ON_PRIMARY_URI } from './brand-logo'
import { DOC, printCss } from './document-styles'

export type DocumentLayoutProps = BusinessEmailContext & {
  documentTitle: string
  documentRef?: string
  generatedAt?: string
  legalNote?: string
  children: ReactNode
}

export function DocumentLayout({
  documentTitle,
  documentRef,
  generatedAt,
  legalNote,
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
}: DocumentLayoutProps) {
  const name = businessName || BRAND.name
  const legal = legalName || name
  const logoSrc = logoUrl || BRAND_LOGO_ON_PRIMARY_URI
  const stamp = generatedAt ?? new Date().toLocaleString('fr-FR')

  return (
    <Html lang="fr">
      <Head>
        <title>{documentTitle}</title>
        <style>{printCss}</style>
      </Head>
      <Body style={body}>
        <Container style={sheet}>
          <Section style={header}>
            <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
              <tbody>
                <tr>
                  <td style={{ verticalAlign: 'middle' as const }}>
                    <Img src={logoSrc} alt={`${name} — logo`} width={180} height={44} style={logoImg} />
                    <Text style={tagline}>{BRAND.tagline}</Text>
                  </td>
                  <td style={{ textAlign: 'right' as const, verticalAlign: 'top' as const }}>
                    <Text style={docTitle}>{documentTitle}</Text>
                    {documentRef ? <Text style={docRef}>{documentRef}</Text> : null}
                    <Text style={docDate}>Édité le {stamp}</Text>
                  </td>
                </tr>
              </tbody>
            </table>
          </Section>

          <Section style={content}>{children}</Section>

          <Hr style={hr} />

          <Section style={footerBlock}>
            <Text style={footerTitle}>{legal}</Text>
            {address ? <Text style={footerLine}>{address}</Text> : null}
            {phone ? <Text style={footerLine}>Tél. {phone}</Text> : null}
            {siren ? <Text style={footerLine}>SIREN {siren}</Text> : null}
            {siret ? <Text style={footerLine}>SIRET {siret}</Text> : null}
            {vatNumber ? <Text style={footerLine}>N° TVA intracom. {vatNumber}</Text> : null}
            {nafCode ? (
              <Text style={footerLine}>
                NAF {nafCode}
                {nafLabel ? ` — ${nafLabel}` : ''}
                {legalForm ? ` · ${legalForm}` : ''}
              </Text>
            ) : null}
            {website ? (
              <Text style={footerLine}>
                <Link href={website} style={footerLink}>
                  {website.replace(/^https?:\/\//, '')}
                </Link>
              </Text>
            ) : null}
            {legalNote ? <Text style={legalText}>{legalNote}</Text> : null}
            <Text style={footerMuted}>
              Document généré par RestaurantOS — {name}. Conservez ce document pour votre comptabilité et obligations
              fiscales.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

const body = {
  backgroundColor: DOC.pageBg,
  fontFamily: DOC.fontSans,
  margin: 0,
  padding: '24px 12px',
  color: DOC.text,
}

const sheet = {
  backgroundColor: DOC.paperBg,
  border: `1px solid ${DOC.border}`,
  borderRadius: '8px',
  margin: '0 auto',
  maxWidth: DOC.maxWidth,
  overflow: 'hidden' as const,
}

const header = {
  backgroundColor: DOC.primary,
  padding: '20px 28px 18px',
}

const logoImg = { display: 'block' as const, margin: 0 }

const tagline = {
  color: DOC.headerText,
  fontSize: '11px',
  letterSpacing: '0.06em',
  margin: '6px 0 0',
  opacity: 0.85,
}

const docTitle = {
  color: '#ffffff',
  fontSize: '18px',
  fontWeight: 700,
  margin: 0,
  textAlign: 'right' as const,
}

const docRef = {
  color: DOC.headerText,
  fontSize: '12px',
  margin: '4px 0 0',
  textAlign: 'right' as const,
}

const docDate = {
  color: DOC.headerText,
  fontSize: '10px',
  margin: '6px 0 0',
  opacity: 0.75,
  textAlign: 'right' as const,
}

const content = { padding: '28px 32px 8px' }

const hr = { borderColor: DOC.border, margin: '8px 32px 0' }

const footerBlock = { padding: '16px 32px 24px' }

const footerTitle = {
  color: DOC.text,
  fontSize: '12px',
  fontWeight: 700,
  margin: '0 0 6px',
}

const footerLine = {
  color: DOC.textMuted,
  fontSize: '11px',
  lineHeight: '16px',
  margin: '0 0 2px',
}

const footerLink = { color: DOC.textMuted, textDecoration: 'underline' as const }

const legalText = {
  color: DOC.textLight,
  fontSize: '10px',
  lineHeight: '15px',
  margin: '12px 0 0',
}

const footerMuted = {
  color: DOC.textLight,
  fontSize: '10px',
  lineHeight: '14px',
  margin: '10px 0 0',
}
