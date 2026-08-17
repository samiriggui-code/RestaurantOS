import { AdminPosHub } from '@/components/admin/AdminPosHub'
import { ModuleGuard } from '@/components/ops/ModuleGuard'

export default function AdminPosPage() {
  return (
    <ModuleGuard module="pos" title="Suivi caisse">
      <AdminPosHub />
    </ModuleGuard>
  )
}
