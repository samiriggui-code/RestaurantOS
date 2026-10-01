import { PosSuperApp } from '@/components/pos/PosSuperApp'
import { ModuleGuard } from '@/components/ops/ModuleGuard'

export default function PosPage() {
  return (
    <ModuleGuard module="pos" title="Caisse">
      <PosSuperApp />
    </ModuleGuard>
  )
}
