import { OrderArchiveView } from '@/components/admin/OrderArchiveView'

export function AdminOrdersView() {
  return (
    <OrderArchiveView
      title="Commandes"
      subtitle="Historique et archivage — consultation jour, semaine, mois."
      mode="all"
    />
  )
}
