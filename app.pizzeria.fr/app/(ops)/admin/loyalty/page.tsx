import { AdminLoyaltyView } from '@/components/admin/AdminLoyaltyView'
import { ModuleGuard } from '@/components/ops/ModuleGuard'

export default function AdminLoyaltyPage() {
  return (
    <ModuleGuard module="loyalty" title="Fidélité">
      <AdminLoyaltyView />
    </ModuleGuard>
  )
}
