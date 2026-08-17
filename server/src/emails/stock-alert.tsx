import { Text } from '@react-email/components'
import { EmailLayout } from './layout'
import type { BusinessEmailContext } from './brand'

export type StockAlertItem = {
  name: string
  quantity: number
  unit: string
  reorderAt: number | null
  level: 'low' | 'critical'
}

export type StockAlertEmailProps = BusinessEmailContext & {
  items: StockAlertItem[]
}

export function StockAlertEmail({ items, ...biz }: StockAlertEmailProps) {
  return (
    <EmailLayout
      {...biz}
      preview={`${items.length} article(s) sous le seuil minimum`}
      title="Alerte stock — action requise"
    >
      <Text style={p}>
        Les articles suivants sont en dessous du seuil minimum configuré dans le CRM :
      </Text>
      <ul style={list}>
        {items.map((item) => (
          <li key={item.name} style={item.level === 'critical' ? liCritical : li}>
            <strong>{item.name}</strong> — {item.quantity} {item.unit}
            {item.reorderAt != null ? ` (seuil : ${item.reorderAt} ${item.unit})` : ''}
            {item.level === 'critical' ? ' — CRITIQUE' : ''}
          </li>
        ))}
      </ul>
      <Text style={pMuted}>
        Connectez-vous au back-office → Stock pour passer commande fournisseur ou ajuster l&apos;inventaire.
      </Text>
    </EmailLayout>
  )
}

const p = { color: '#3d3530', fontSize: '15px', lineHeight: '24px' }
const pMuted = { ...p, color: '#7a726a', fontSize: '13px' }
const list = { paddingLeft: '20px', margin: '16px 0' }
const li = { color: '#3d3530', fontSize: '14px', lineHeight: '22px', marginBottom: '8px' }
const liCritical = { ...li, color: '#c0392b', fontWeight: 600 }
