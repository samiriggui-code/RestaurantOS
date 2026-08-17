import { AdminTablesView } from '@/components/admin/AdminTablesView'
import { ModuleGuard } from '@/components/ops/ModuleGuard'

export default function AdminTablesPage() {
  return (
    <ModuleGuard module="tables" title="Tables">
      <AdminTablesView />
    </ModuleGuard>
  )
}
