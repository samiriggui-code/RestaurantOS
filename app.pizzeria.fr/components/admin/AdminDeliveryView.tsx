'use client'

import { useState } from 'react'
import { History, MapPin, Radio } from 'lucide-react'
import { AdminDeliveryHistoryView } from '@/components/admin/AdminDeliveryHistoryView'
import { AdminDeliveryLivePanel } from '@/components/admin/AdminDeliveryLivePanel'
import { AdminDeliveryZonesPanel } from '@/components/admin/AdminDeliveryZonesPanel'
import { AdminPageHeader, AdminSectionTabs } from '@/components/admin/AdminSectionTabs'

type DeliveryTab = 'live' | 'history' | 'zones'

export function AdminDeliveryView() {
  const [tab, setTab] = useState<DeliveryTab>('live')

  const tabs = [
    { id: 'live' as const, label: 'Suivi live', icon: Radio },
    { id: 'history' as const, label: 'Historique', icon: History },
    { id: 'zones' as const, label: 'Zones & tarifs', icon: MapPin },
  ]

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <AdminPageHeader
        title="Livraison"
        description="Suivi temps réel, historique des tournées et configuration des communes."
        actions={<AdminSectionTabs tabs={tabs} active={tab} onChange={setTab} />}
      />

      {tab === 'live' && <AdminDeliveryLivePanel />}
      {tab === 'history' && <AdminDeliveryHistoryView />}
      {tab === 'zones' && <AdminDeliveryZonesPanel />}
    </div>
  )
}
