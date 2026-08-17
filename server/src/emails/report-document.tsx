import { Section, Text } from '@react-email/components'
import { DocumentLayout } from './document-layout'
import type { BusinessEmailContext } from './brand'
import { DOC } from './document-styles'

export type ReportTableSection = {
  title: string
  columns: string[]
  rows: string[][]
  alignRightFrom?: number
}

export type ReportStat = {
  label: string
  value: string
}

export type ReportDocumentProps = BusinessEmailContext & {
  reportTitle: string
  periodLabel: string
  stats: ReportStat[]
  sections: ReportTableSection[]
}

export function ReportDocument({
  reportTitle,
  periodLabel,
  stats,
  sections,
  ...biz
}: ReportDocumentProps) {
  return (
    <DocumentLayout
      {...biz}
      documentTitle={reportTitle}
      documentRef={periodLabel}
      legalNote="Rapport d'activité interne — chiffres basés sur les commandes encaissées (statut payé). Document non contractuel."
    >
      {stats.length > 0 ? (
        <table style={statsGrid}>
          <tbody>
            <tr>
              {stats.map((s, i) => (
                <td key={i} style={statCell}>
                  <Text style={statLabel}>{s.label}</Text>
                  <Text style={statValue}>{s.value}</Text>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      ) : null}

      {sections.map((section, si) => (
        <Section key={si} style={sectionWrap}>
          <Text style={sectionTitle}>{section.title}</Text>
          <table style={table}>
            <thead>
              <tr>
                {section.columns.map((col, ci) => (
                  <th
                    key={ci}
                    style={
                      section.alignRightFrom != null && ci >= section.alignRightFrom ? thR : th
                    }
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {section.rows.length === 0 ? (
                <tr>
                  <td colSpan={section.columns.length} style={emptyTd}>
                    Aucune donnée sur cette période
                  </td>
                </tr>
              ) : (
                section.rows.map((row, ri) => (
                  <tr key={ri}>
                    {row.map((cell, ci) => (
                      <td
                        key={ci}
                        style={
                          section.alignRightFrom != null && ci >= section.alignRightFrom ? tdR : td
                        }
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Section>
      ))}
    </DocumentLayout>
  )
}

const statsGrid = { width: '100%', borderCollapse: 'collapse' as const, marginBottom: '24px' }
const statCell = {
  backgroundColor: '#faf8f5',
  border: `1px solid ${DOC.border}`,
  padding: '12px 14px',
  textAlign: 'center' as const,
}
const statLabel = {
  color: DOC.textLight,
  fontSize: '10px',
  fontWeight: 700,
  letterSpacing: '0.06em',
  margin: '0 0 4px',
  textTransform: 'uppercase' as const,
}
const statValue = { color: DOC.text, fontSize: '18px', fontWeight: 700, margin: 0 }
const sectionWrap = { marginBottom: '24px' }
const sectionTitle = {
  color: DOC.text,
  fontSize: '14px',
  fontWeight: 700,
  margin: '0 0 10px',
}
const table = { borderCollapse: 'collapse' as const, width: '100%' }
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
  padding: '8px 6px',
}
const tdR = { ...td, textAlign: 'right' as const }
const emptyTd = { ...td, color: DOC.textLight, fontStyle: 'italic' as const, padding: '16px 6px' }
