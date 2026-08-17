import { Text } from '@react-email/components'
import { EmailLayout } from './layout'
import type { BusinessEmailContext } from './brand'

export type AdminNotificationEmailProps = BusinessEmailContext & {
  subject: string
  body: string
  severity?: 'info' | 'warning' | 'critical'
}

export function AdminNotificationEmail({
  subject,
  body,
  severity = 'info',
  ...biz
}: AdminNotificationEmailProps) {
  const tone =
    severity === 'critical' ? '#c0392b' : severity === 'warning' ? '#d68910' : '#3d3530'

  return (
    <EmailLayout {...biz} preview={subject} title={subject}>
      <Text style={{ ...p, color: tone, whiteSpace: 'pre-wrap' as const }}>{body}</Text>
      <Text style={pMuted}>
        Notification automatique RestaurantOS — vérifiez le tableau de bord admin.
      </Text>
    </EmailLayout>
  )
}

const p = { fontSize: '15px', lineHeight: '24px', margin: '0 0 12px' }
const pMuted = { ...p, color: '#7a726a', fontSize: '13px' }
