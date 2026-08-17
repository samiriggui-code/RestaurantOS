import { Text } from '@react-email/components'
import { EmailLayout } from './layout'
import type { BusinessEmailContext } from './brand'

export type InvoiceLineEmail = {
  description: string
  quantity: number
  unitPriceCents: number
  taxRate?: number
  lineTotalCents: number
}

export type InvoiceEmailProps = BusinessEmailContext & {
  invoiceNumber: number
  clientName: string
  issueDate: string
  dueDate?: string
  lines: InvoiceLineEmail[]
  subtotalCents: number
  taxCents: number
  totalCents: number
  notes?: string
}

function formatEUR(cents: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(cents / 100)
}

export function InvoiceEmail(props: InvoiceEmailProps) {
  const {
    invoiceNumber,
    clientName,
    issueDate,
    dueDate,
    lines,
    subtotalCents,
    taxCents,
    totalCents,
    notes,
    ...biz
  } = props

  return (
    <EmailLayout
      {...biz}
      preview={`Facture n° ${invoiceNumber} — ${clientName}`}
      title={`Facture n° ${invoiceNumber}`}
    >
      <Text style={meta}>
        Client : <strong>{clientName}</strong>
        <br />
        Date : {issueDate}
        {dueDate ? (
          <>
            <br />
            Échéance : {dueDate}
          </>
        ) : null}
      </Text>
      <table style={table}>
        <thead>
          <tr>
            <th style={th}>Désignation</th>
            <th style={thR}>Qté</th>
            <th style={thR}>P.U. HT</th>
            <th style={thR}>TVA</th>
            <th style={thR}>Total HT</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, i) => (
            <tr key={i}>
              <td style={td}>{line.description}</td>
              <td style={tdR}>{line.quantity}</td>
              <td style={tdR}>{formatEUR(line.unitPriceCents)}</td>
              <td style={tdR}>{line.taxRate != null ? `${line.taxRate}%` : '—'}</td>
              <td style={tdR}>{formatEUR(line.lineTotalCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Text style={totals}>
        Sous-total HT : {formatEUR(subtotalCents)}
        <br />
        TVA : {formatEUR(taxCents)}
        <br />
        <strong>Total TTC : {formatEUR(totalCents)}</strong>
      </Text>
      {notes ? <Text style={notesStyle}>{notes}</Text> : null}
      <Text style={legal}>
        Prix unitaires HT. TVA selon taux par ligne. En cas de retard de paiement (B2B) : pénalités au taux
        légal et indemnité forfaitaire de 40 € (art. L.441-10 C. com.). Conservez ce document pour votre
        comptabilité.
      </Text>
    </EmailLayout>
  )
}

const meta = { color: '#5c534a', fontSize: '13px', lineHeight: '20px', margin: '0 0 20px' }
const table = { borderCollapse: 'collapse' as const, width: '100%', marginBottom: '16px' }
const th = {
  borderBottom: '2px solid #e8e0d5',
  color: '#5c534a',
  fontSize: '11px',
  padding: '8px 4px',
  textAlign: 'left' as const,
  textTransform: 'uppercase' as const,
}
const thR = { ...th, textAlign: 'right' as const }
const td = { borderBottom: '1px solid #f0ebe4', color: '#3d3530', fontSize: '13px', padding: '10px 4px' }
const tdR = { ...td, textAlign: 'right' as const }
const totals = { color: '#3d3530', fontSize: '14px', lineHeight: '22px', textAlign: 'right' as const }
const notesStyle = { color: '#7a726a', fontSize: '12px', fontStyle: 'italic' as const }
const legal = { color: '#9a9088', fontSize: '11px', lineHeight: '16px', marginTop: '24px' }
