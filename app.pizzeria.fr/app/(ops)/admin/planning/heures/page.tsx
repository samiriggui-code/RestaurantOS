import { AdminMonthlyHoursView } from '@/components/admin/AdminMonthlyHoursView'
import { ModuleGuard } from '@/components/ops/ModuleGuard'

export default function AdminMonthlyHoursPage() {
  return (
    <ModuleGuard module="shifts" title="Heures mensuelles">
      <AdminMonthlyHoursView />
    </ModuleGuard>
  )
}
