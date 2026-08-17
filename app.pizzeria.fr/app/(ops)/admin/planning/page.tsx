import { AdminEmployeePlanningView } from '@/components/admin/AdminEmployeePlanningView'
import { ModuleGuard } from '@/components/ops/ModuleGuard'

export default function AdminPlanningPage() {
  return (
    <ModuleGuard module="shifts" title="Planning employés">
      <AdminEmployeePlanningView />
    </ModuleGuard>
  )
}
