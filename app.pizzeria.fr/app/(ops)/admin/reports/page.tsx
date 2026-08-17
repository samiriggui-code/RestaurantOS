import { AdminReportsView } from '@/components/admin/AdminReportsView'
import { ModuleGuard } from '@/components/ops/ModuleGuard'

export default function AdminReportsPage() {
  return (
    <ModuleGuard module="reports">
      <AdminReportsView />
    </ModuleGuard>
  )
}
