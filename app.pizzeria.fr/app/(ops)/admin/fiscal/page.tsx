import { AdminFiscalView } from '@/components/admin/AdminFiscalView'
import { ModuleGuard } from '@/components/ops/ModuleGuard'

export default function AdminFiscalPage() {
  return (
    <ModuleGuard module="reports" title="Fiscal ISCA">
      <AdminFiscalView />
    </ModuleGuard>
  )
}
