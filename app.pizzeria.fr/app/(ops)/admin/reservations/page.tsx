import { AdminReservationsView } from '@/components/admin/AdminReservationsView'
import { ModuleGuard } from '@/components/ops/ModuleGuard'

export default function AdminReservationsPage() {
  return (
    <ModuleGuard module="reservations" title="Réservations">
      <AdminReservationsView />
    </ModuleGuard>
  )
}
