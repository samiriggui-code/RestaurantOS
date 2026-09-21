import { KioskDisplay } from '@/components/kiosk/KioskDisplay'
import { ModuleGuard } from '@/components/ops/ModuleGuard'

export default function KioskPage() {
  return (
    <ModuleGuard module="kiosk" title="Totem">
      <KioskDisplay />
    </ModuleGuard>
  )
}
