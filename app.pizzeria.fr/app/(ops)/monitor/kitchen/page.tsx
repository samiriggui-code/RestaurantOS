import { MonitorChrome } from '@/components/admin/MonitorChrome'
import { KitchenDisplay } from '@/components/kitchen/KitchenDisplay'

export default function MonitorKitchenPage() {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <MonitorChrome kind="kitchen" adminHref="/admin/kitchen" />
      <div className="min-h-0 flex-1 overflow-hidden">
        <KitchenDisplay mode="admin" monitor />
      </div>
    </div>
  )
}
