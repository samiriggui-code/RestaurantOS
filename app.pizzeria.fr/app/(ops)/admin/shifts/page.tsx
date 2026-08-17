import { AdminShiftsView } from '@/components/admin/AdminShiftsView'
import { ModuleGuard } from '@/components/ops/ModuleGuard'

export default function AdminShiftsPage() {
  return (
    <ModuleGuard module="shifts" title="Plannings">
      <AdminShiftsView />
    </ModuleGuard>
  )
}
