import { AdminDeliveryView } from '@/components/admin/AdminDeliveryView'
import { ModuleGuard } from '@/components/ops/ModuleGuard'

export default function AdminDeliveryPage() {
  return (
    <ModuleGuard module="settings" title="Livraison">
      <AdminDeliveryView />
    </ModuleGuard>
  )
}
