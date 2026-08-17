import { AdminMenuView } from '@/components/admin/AdminMenuView'

import { ModuleGuard } from '@/components/ops/ModuleGuard'



export default function AdminMenuPage() {

  return (

    <ModuleGuard module="menu">

      <AdminMenuView />

    </ModuleGuard>

  )

}

