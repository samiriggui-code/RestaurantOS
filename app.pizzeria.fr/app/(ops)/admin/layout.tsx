import { AdminGate } from '@/components/ops/AdminGate'
import { AdminShell } from '@/components/ops/AdminShell'
import { AdminLiveProvider } from '@/components/admin/AdminLiveProvider'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminGate>
      <AdminLiveProvider>
        <AdminShell>{children}</AdminShell>
      </AdminLiveProvider>
    </AdminGate>
  )
}
