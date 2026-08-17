import { AdminUsersView } from '@/components/admin/AdminUsersView'
import { ModuleGuard } from '@/components/ops/ModuleGuard'

export default function AdminUsersPage() {
  return (
    <ModuleGuard module="users">
      <AdminUsersView />
    </ModuleGuard>
  )
}
