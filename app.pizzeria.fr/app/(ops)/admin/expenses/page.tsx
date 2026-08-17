import { AdminExpensesView } from '@/components/admin/AdminExpensesView'
import { ModuleGuard } from '@/components/ops/ModuleGuard'

export default function AdminExpensesPage() {
  return (
    <ModuleGuard module="expenses" title="Dépenses">
      <AdminExpensesView />
    </ModuleGuard>
  )
}