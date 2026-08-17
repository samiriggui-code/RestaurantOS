import { AdminUsersView } from '@/components/admin/AdminUsersView'
import { ModuleGuard } from '@/components/ops/ModuleGuard'

export default function AdminEmployeesPage() {
  return (
    <ModuleGuard module="users" title="Employés">
      <AdminUsersView title="Employés" />
    </ModuleGuard>
  )
}
