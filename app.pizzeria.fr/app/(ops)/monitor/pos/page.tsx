import { MonitorChrome } from '@/components/admin/MonitorChrome'
import { PosDisplay } from '@/components/pos/PosDisplay'

export default function MonitorPosPage() {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <MonitorChrome kind="pos" adminHref="/admin/pos" />
      <div className="min-h-0 flex-1 overflow-hidden">
        <PosDisplay mode="admin" monitor />
      </div>
    </div>
  )
}
