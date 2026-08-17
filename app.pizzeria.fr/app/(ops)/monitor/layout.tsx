import { AdminGate } from '@/components/ops/AdminGate'
import { AdminLiveProvider } from '@/components/admin/AdminLiveProvider'

/** Moniteurs plein écran — auth CRM sans sidebar admin. */
export default function MonitorLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminGate>
      <AdminLiveProvider>
        <div
          data-admin-cockpit
          data-ops-cockpit
          className="admin-main ops-main flex h-dvh min-h-0 flex-col overflow-hidden bg-charcoal"
        >
          {children}
        </div>
      </AdminLiveProvider>
    </AdminGate>
  )
}
