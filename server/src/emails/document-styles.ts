import { BRAND } from './brand'

export const DOC = {
  pageBg: '#f4f1ec',
  paperBg: '#ffffff',
  border: '#e8e0d5',
  text: '#1a1410',
  textMuted: '#5c534a',
  textLight: '#9a9088',
  primary: BRAND.primary,
  accent: '#E85A3E',
  headerText: '#F5E6D3',
  maxWidth: '794px',
  font: "Georgia, 'Times New Roman', serif",
  fontSans: "Segoe UI, system-ui, Helvetica, Arial, sans-serif",
} as const

export const printCss = `
  @page { size: A4; margin: 12mm; }
  @media print {
    body { background: #fff !important; padding: 0 !important; }
    .no-print { display: none !important; }
    .page-break { page-break-before: always; }
    tr { page-break-inside: avoid; }
  }
`
