import { MonitorChrome } from '@/components/admin/MonitorChrome'
import { PosDisplay } from '@/components/pos/PosDisplay'
import { PosCashSessionGate } from '@/components/pos/PosCashSessionGate'
import { ModuleGuard } from '@/components/ops/ModuleGuard'

/**
 * Terminal caisse plein écran (pas "Suivi caisse" /admin/pos, qui lui reste actif — ceci
 * rend le vrai PosDisplay). Plus aucun lien vers cette page depuis le CRM (AdminPosHub l'a
 * remplacée), mais l'URL restait accessible sans jumelage/module : gardée derrière le module.
 */
export default function MonitorPosPage() {
  return (
    <ModuleGuard module="pos" title="Caisse">
      <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
        <MonitorChrome kind="pos" adminHref="/admin/pos" />
        <div className="min-h-0 flex-1 overflow-hidden">
          <PosCashSessionGate authScope="crm">
            <PosDisplay mode="admin" monitor />
          </PosCashSessionGate>
        </div>
      </div>
    </ModuleGuard>
  )
}
