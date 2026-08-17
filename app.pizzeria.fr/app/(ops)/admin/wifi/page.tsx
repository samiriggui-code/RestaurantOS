import { AdminWifiView } from '@/components/admin/AdminWifiView'
import { ModuleGuard } from '@/components/ops/ModuleGuard'

export default function AdminWifiPage() {
  return (
    <ModuleGuard module="wifi" title="WiFi invité">
      <AdminWifiView />
    </ModuleGuard>
  )
}
