import { AdminInvoicesView } from '@/components/admin/AdminInvoicesView'
import { ModuleGuard } from '@/components/ops/ModuleGuard'

export default function AdminInvoicesPage() {
  return (
    <ModuleGuard module="reports" title="Facturation">
      <AdminInvoicesView />
    </ModuleGuard>
  )
}
