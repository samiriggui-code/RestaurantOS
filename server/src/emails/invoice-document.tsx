import { Section, Text } from '@react-email/components'
import { DocumentLayout } from './document-layout'
import type { BusinessEmailContext } from './brand'
import { DOC } from './document-styles'

export type InvoiceDocumentLine = {
  description: string
  quantity: number
  unitPriceCents: number
  taxRate: number
}

export type InvoiceDocumentProps = BusinessEmailContext & {
  invoiceNumber: number
  status: string
  issueDate: string
  dueDate?: string | null
  clientName: string
  clientEmail?: string | null
  clientPhone?: string | null
  clientSiret?: string | null
  clientVatNumber?: string | null
  clientAddress?: string | null
  orderNumber?: number | null
  subtotalCents: number
  taxCents: number
  totalCents: number
  notes?: string | null
  lines: InvoiceDocumentLine[]
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Brouillon',
  ISSUED: 'Émise',
  SENT: 'Envoyée',
  PAID: 'Payée',
  CANCELLED: 'Annulée',
}

function formatEUR(cents: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(cents / 100)
}

const INVOICE_LEGAL =
  'Prix unitaires HT. TVA applicable selon taux par ligne (restauration). ' +
  'En cas de retard de paiement (factures B2B) : pénalités au taux légal (taux BCE + 10 points) et indemnité forfaitaire de 40 € pour frais de recouvrement (art. L.441-10 C. com.). ' +
  'Escompte pour paiement anticipé : néant.'

export function InvoiceDocument(props: InvoiceDocumentProps) {
  const {
    invoiceNumber,
    status,
    issueDate,
    dueDate,
    clientName,
    clientEmail,
    clientPhone,
    clientSiret,
    clientVatNumber,
    clientAddress,
    orderNumber,
    subtotalCents,
    taxCents,
    totalCents,
    notes,
    lines,
    ...biz
  } = props

  return (
    <DocumentLayout
      {...biz}
      documentTitle="FACTURE"
      documentRef={`N° ${invoiceNumber} · ${STATUS_LABEL[status] ?? status}`}
      legalNote={INVOICE_LEGAL}
    >
      <table style={metaGrid}>
        <tbody>
          <tr>
            <td style={metaCell}>
              <Text style={boxLabel}>Client</Text>
              <Text style={boxStrong}>{clientName}</Text>
              {clientAddress ? <Text style={boxLine}>{clientAddress}</Text> : null}
              {clientEmail ? <Text style={boxLine}>{clientEmail}</Text> : null}
              {clientPhone ? <Text style={boxLine}>{clientPhone}</Text> : null}
              {clientSiret ? <Text style={boxLine}>SIRET client : {clientSiret}</Text> : null}
              {clientVatNumber ? <Text style={boxLine}>TVA client : {clientVatNumber}</Text> : null}
            </td>
            <td style={metaCell}>
              <Text style={boxLabel}>Détails facture</Text>
              <Text style={boxLine}>Date d&apos;émission : {issueDate}</Text>
              {dueDate ? <Text style={boxLine}>Échéance : {dueDate}</Text> : null}
              {orderNumber != null ? <Text style={boxLine}>Commande n°{orderNumber}</Text> : null}
            </td>
          </tr>
        </tbody>
      </table>

      <table style={table}>
        <thead>
          <tr>
            <th style={th}>Désignation</th>
            <th style={thR}>Qté</th>
            <th style={thR}>P.U. HT</th>
            <th style={thR}>TVA</th>
            <th style={thR}>Total HT</th>
            <th style={thR}>TVA €</th>
            <th style={thR}>Total TTC</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, i) => {
            const ht = Math.round(line.quantity * line.unitPriceCents)
            const tva = Math.round(ht * (line.taxRate / 100))
            const ttc = ht + tva
            return (
              <tr key={i}>
                <td style={td}>{line.description}</td>
                <td style={tdR}>{line.quantity}</td>
                <td style={tdR}>{formatEUR(line.unitPriceCents)}</td>
                <td style={tdR}>{line.taxRate}%</td>
                <td style={tdR}>{formatEUR(ht)}</td>
                <td style={tdR}>{formatEUR(tva)}</td>
                <td style={tdR}>
                  <strong>{formatEUR(ttc)}</strong>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <Section style={totalsWrap}>
        <Text style={totalsLine}>
          Sous-total HT : <strong>{formatEUR(subtotalCents)}</strong>
        </Text>
        <Text style={totalsLine}>
          TVA : <strong>{formatEUR(taxCents)}</strong>
        </Text>
        <Text style={totalsGrand}>
          Total TTC : <strong>{formatEUR(totalCents)}</strong>
        </Text>
      </Section>

      {notes ? (
        <Text style={notesStyle}>
          <strong>Notes :</strong> {notes}
        </Text>
      ) : null}
    </DocumentLayout>
  )
}

const metaGrid = { width: '100%', borderCollapse: 'collapse' as const, marginBottom: '20px' }
const metaCell = {
  border: `1px solid ${DOC.border}`,
  borderRadius: '8px',
  padding: '12px 14px',
  verticalAlign: 'top' as const,
  width: '50%',
}
const boxLabel = {
  color: DOC.textLight,
  fontSize: '10px',
  fontWeight: 700,
  letterSpacing: '0.08em',
  margin: '0 0 8px',
  textTransform: 'uppercase' as const,
}
const boxStrong = { color: DOC.text, fontSize: '14px', fontWeight: 700, margin: '0 0 4px' }
const boxLine = { color: DOC.textMuted, fontSize: '12px', lineHeight: '18px', margin: '0 0 2px' }
const table = { borderCollapse: 'collapse' as const, width: '100%', marginBottom: '16px' }
const th = {
  borderBottom: `2px solid ${DOC.border}`,
  color: DOC.textMuted,
  fontSize: '10px',
  padding: '8px 6px',
  textAlign: 'left' as const,
  textTransform: 'uppercase' as const,
}
const thR = { ...th, textAlign: 'right' as const }
const td = {
  borderBottom: `1px solid #f0ebe4`,
  color: DOC.text,
  fontSize: '12px',
  padding: '9px 6px',
  verticalAlign: 'top' as const,
}
const tdR = { ...td, textAlign: 'right' as const, whiteSpace: 'nowrap' as const }
const totalsWrap = { marginTop: '8px', textAlign: 'right' as const }
const totalsLine = { color: DOC.textMuted, fontSize: '13px', margin: '0 0 4px' }
const totalsGrand = {
  borderTop: `2px solid ${DOC.text}`,
  color: DOC.text,
  fontSize: '16px',
  margin: '8px 0 0',
  paddingTop: '8px',
}
const notesStyle = { color: DOC.textMuted, fontSize: '12px', fontStyle: 'italic' as const, marginTop: '16px' }
