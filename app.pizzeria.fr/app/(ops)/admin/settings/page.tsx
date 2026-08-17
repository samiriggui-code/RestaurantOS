import { AdminSettingsView } from '@/components/admin/AdminSettingsView'
import { ModuleGuard } from '@/components/ops/ModuleGuard'

export default function AdminSettingsPage() {
  return (
    <ModuleGuard module="settings">
      <AdminSettingsView />
    </ModuleGuard>
  )
}
