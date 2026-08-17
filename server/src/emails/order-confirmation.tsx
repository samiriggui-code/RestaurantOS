import { Button, Text } from '@react-email/components'
import { EmailLayout } from './layout'
import { BRAND, type BusinessEmailContext } from './brand'

export type OrderConfirmationEmailProps = BusinessEmailContext & {
  customerName?: string
  orderNumber: number | string
  trackingUrl?: string
  emailTitle?: string
  preview?: string
  /** Mise à jour statut — masque le paragraphe « transmise en cuisine » */
  statusUpdate?: boolean
  statusLine?: string
  deliveryHandoverCode?: string
}

export function OrderConfirmationEmail(props: OrderConfirmationEmailProps) {
  const {
    customerName,
    orderNumber,
    trackingUrl,
    emailTitle = 'Commande confirmée',
    preview,
    statusUpdate = false,
    statusLine,
    deliveryHandoverCode,
    ...biz
  } = props

  return (
    <EmailLayout
      {...biz}
      preview={preview ?? `Commande n° ${orderNumber} — ${emailTitle.toLowerCase()}`}
      title={emailTitle}
    >
      <Text style={p}>
        Bonjour{customerName ? ` ${customerName}` : ''},
      </Text>
      {!statusUpdate ? (
        <Text style={p}>
          Votre commande <strong>n° {orderNumber}</strong> est bien enregistrée et transmise en cuisine.
        </Text>
      ) : (
        <Text style={p}>
          Concernant votre commande <strong>n° {orderNumber}</strong> :
        </Text>
      )}
      {statusLine ? <Text style={p}>{statusLine}</Text> : null}
      {deliveryHandoverCode ? (
        <Text style={codeBox}>
          Code livraison : <strong>{deliveryHandoverCode}</strong>
          <br />
          Communiquez ce code au livreur à la réception.
        </Text>
      ) : null}
      {trackingUrl ? (
        <Button href={trackingUrl} style={button}>
          Suivre ma commande
        </Button>
      ) : null}
      <Text style={pMuted}>Bon appétit !</Text>
    </EmailLayout>
  )
}

const p = { color: '#3d3530', fontSize: '15px', lineHeight: '24px', margin: '0 0 12px' }
const pMuted = { ...p, color: '#7a726a', fontSize: '13px' }
const codeBox = {
  backgroundColor: '#fef3f2',
  border: `1px solid ${BRAND.primary}`,
  borderRadius: '8px',
  color: '#3d3530',
  fontSize: '14px',
  lineHeight: '22px',
  padding: '12px 16px',
  margin: '16px 0',
}
const button = {
  backgroundColor: BRAND.primary,
  borderRadius: '8px',
  color: '#fff',
  display: 'inline-block',
  fontSize: '14px',
  fontWeight: 600,
  padding: '12px 24px',
  textDecoration: 'none',
  marginTop: '8px',
}
