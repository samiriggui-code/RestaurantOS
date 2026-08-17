import { Text } from '@react-email/components'
import { EmailLayout } from './layout'
import { BRAND, type BusinessEmailContext } from './brand'

export type FiscalReceiptEmailProps = BusinessEmailContext & {
  customerName?: string
  orderNumber: number | string
  fiscalSerialNumber: number
  fiscalHashPreview: string
  totalCents: number
  trackingUrl?: string
}

function formatEur(cents: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(cents / 100)
}

export function FiscalReceiptEmail(props: FiscalReceiptEmailProps) {
  const {
    customerName,
    orderNumber,
    fiscalSerialNumber,
    fiscalHashPreview,
    totalCents,
    trackingUrl,
    ...biz
  } = props

  return (
    <EmailLayout
      {...biz}
      preview={`Reçu fiscal n°${fiscalSerialNumber} — commande ${orderNumber}`}
      title="Reçu de caisse"
    >
      <Text style={p}>
        Bonjour{customerName ? ` ${customerName}` : ''},
      </Text>
      <Text style={p}>
        Votre paiement pour la commande <strong>n° {orderNumber}</strong> a bien été enregistré.
      </Text>
      <Text style={fiscalBox}>
        <strong>Ticket fiscal n° {fiscalSerialNumber}</strong>
        <br />
        Montant TTC : <strong>{formatEur(totalCents)}</strong>
        <br />
        Empreinte intégrité : <code style={code}>{fiscalHashPreview}</code>
      </Text>
      <Text style={pMuted}>
        Ce document atteste de l&apos;enregistrement fiscal de votre achat (logiciel de caisse certifié
        ISCA — art. 286 CGI). Conservez cet email.
      </Text>
      {trackingUrl ? (
        <Text style={p}>
          <a href={trackingUrl} style={link}>
            Suivre ma commande
          </a>
        </Text>
      ) : null}
    </EmailLayout>
  )
}

const p = { color: '#3d3530', fontSize: '15px', lineHeight: '24px', margin: '0 0 12px' }
const pMuted = { ...p, color: '#7a726a', fontSize: '13px' }
const fiscalBox = {
  backgroundColor: '#fef3f2',
  border: `1px solid ${BRAND.primary}`,
  borderRadius: '8px',
  color: '#3d3530',
  fontSize: '14px',
  lineHeight: '22px',
  padding: '14px 16px',
  margin: '16px 0',
}
const code = { fontSize: '12px', color: '#5c534c' }
const link = { color: BRAND.primary, fontWeight: 600 as const }
