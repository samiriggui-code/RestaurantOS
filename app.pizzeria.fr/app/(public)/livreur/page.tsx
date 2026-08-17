import { DriverHubView } from '@/components/delivery/DriverHubView'
import { DriverPinGate } from '@/components/delivery/DriverPinGate'

export const metadata = {
  title: 'Livreur — La Z Pizza',
  description: 'Tournée et suivi livraisons',
}

export default function LivreurHubPage() {
  return (
    <DriverPinGate>
      <DriverHubView />
    </DriverPinGate>
  )
}
