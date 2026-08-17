import { AdminStockView } from '@/components/admin/AdminStockView'
import { ModuleGuard } from '@/components/ops/ModuleGuard'

export default function AdminStockPage() {
  return (
    <ModuleGuard module="expenses" title="Stock">
      <AdminStockView />
    </ModuleGuard>
  )
}
