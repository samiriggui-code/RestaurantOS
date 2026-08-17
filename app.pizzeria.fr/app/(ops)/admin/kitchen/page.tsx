import { AdminKitchenHub } from '@/components/admin/AdminKitchenHub'
import { ModuleGuard } from '@/components/ops/ModuleGuard'

export default function AdminKitchenPage() {
  return (
    <ModuleGuard module="kitchen" title="Suivi cuisine">
      <AdminKitchenHub />
    </ModuleGuard>
  )
}
