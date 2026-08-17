import { Section, Text } from '@react-email/components'
import { DocumentLayout } from './document-layout'
import type { BusinessEmailContext } from './brand'
import { DOC } from './document-styles'

export type FiscalTicketRow = {
  serialNumber: number
  kind: string
  issuedAt: string
  totalCents: string
  paymentMethod: string
  hashPreview: string
}

export type FiscalEventRow = {
  eventType: string
  createdAt: string
  detail: string
}

export type FiscalJournalDocumentProps = BusinessEmailContext & {
  softwareVersion: string
  commissionedAt: string
  verifyOk: boolean
  ticketsChecked: number
  tickets: FiscalTicketRow[]
  events: FiscalEventRow[]
}

const KIND_LABEL: Record<string, string> = {
  SALE: 'Vente',
  VOID: 'Avoir',
  TRAINING: 'Formation',
}

export function FiscalJournalDocument({
  softwareVersion,
  commissionedAt,
  verifyOk,
  ticketsChecked,
  tickets,
  events,
  ...biz
}: FiscalJournalDocumentProps) {
  return (
    <DocumentLayout
      {...biz}
      documentTitle="JOURNAL FISCAL ISCA"
      documentRef={`Logiciel v${softwareVersion} · Art. 286 CGI`}
      legalNote={
        'Journal des tickets et événements (JET) — chaînage cryptographique inaltérable. ' +
        'Les duplicatas et avoirs sont tracés. Conservation obligatoire 6 ans.'
      }
    >
      <Section style={infoBox}>
        <Text style={infoLine}>
          Certification : {commissionedAt} · Intégrité chaîne :{' '}
          <strong style={{ color: verifyOk ? '#2a9d8f' : '#c0392b' }}>
            {verifyOk ? 'OK' : 'ANOMALIE'}
          </strong>{' '}
          ({ticketsChecked} tickets vérifiés)
        </Text>
      </Section>

      <Text style={sectionTitle}>Tickets fiscaux</Text>
      <table style={table}>
        <thead>
          <tr>
            <th style={th}>N°</th>
            <th style={th}>Type</th>
            <th style={th}>Date</th>
            <th style={thR}>Montant</th>
            <th style={th}>Paiement</th>
            <th style={th}>Empreinte</th>
          </tr>
        </thead>
        <tbody>
          {tickets.length === 0 ? (
            <tr>
              <td colSpan={6} style={emptyTd}>
                Aucun ticket
              </td>
            </tr>
          ) : (
            tickets.map((t) => (
              <tr key={t.serialNumber}>
                <td style={td}>{t.serialNumber}</td>
                <td style={td}>{KIND_LABEL[t.kind] ?? t.kind}</td>
                <td style={td}>{t.issuedAt}</td>
                <td style={tdR}>{t.totalCents}</td>
                <td style={td}>{t.paymentMethod}</td>
                <td style={tdMono}>{t.hashPreview}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <Text style={{ ...sectionTitle, marginTop: '24px' }}>Journal des événements (JET)</Text>
      <table style={table}>
        <thead>
          <tr>
            <th style={th}>Événement</th>
            <th style={th}>Date</th>
            <th style={th}>Détail</th>
          </tr>
        </thead>
        <tbody>
          {events.length === 0 ? (
            <tr>
              <td colSpan={3} style={emptyTd}>
                Journal vide
              </td>
            </tr>
          ) : (
            events.map((e, i) => (
              <tr key={i}>
                <td style={td}>{e.eventType}</td>
                <td style={td}>{e.createdAt}</td>
                <td style={td}>{e.detail}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </DocumentLayout>
  )
}

const infoBox = {
  backgroundColor: '#faf8f5',
  border: `1px solid ${DOC.border}`,
  borderRadius: '8px',
  marginBottom: '20px',
  padding: '12px 14px',
}
const infoLine = { color: DOC.textMuted, fontSize: '12px', lineHeight: '18px', margin: 0 }
const sectionTitle = {
  color: DOC.text,
  fontSize: '13px',
  fontWeight: 700,
  margin: '0 0 10px',
}
const table = { borderCollapse: 'collapse' as const, width: '100%', marginBottom: '8px' }
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
  fontSize: '11px',
  padding: '7px 6px',
}
const tdR = { ...td, textAlign: 'right' as const }
const tdMono = { ...td, fontFamily: 'monospace', fontSize: '10px' }
const emptyTd = { ...td, color: DOC.textLight, fontStyle: 'italic' as const }
