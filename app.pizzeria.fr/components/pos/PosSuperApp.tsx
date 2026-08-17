'use client'

import { useState } from 'react'
import { DevicePinGate, useDeviceLock } from '@/components/ops/DevicePinGate'
import { DeviceShopGate } from '@/components/ops/DeviceShopGate'
import { PosWebViewGate } from '@/components/pos/PosWebViewGate'
import { PosDisplay } from '@/components/pos/PosDisplay'
import { PosKitchenQueueTab } from '@/components/pos/PosKitchenQueueTab'
import { PosTablesTab, PosReservationsTab, PosWifiTab, PosStockTab } from '@/components/pos/PosModulesTab'
import { PosPeripheralsTab } from '@/components/pos/PosPeripheralsPanel'
import { PosNotificationsTab } from '@/components/pos/PosNotificationsTab'
import {
  getPosModuleLabel,
  PosHomeHub,
  PosModuleShell,
  type PosModuleId,
} from '@/components/pos/PosHomeHub'
import { PosLiveProvider } from '@/components/pos/PosLiveProvider'
import { ApkOtaUpdater } from '@/components/ops/ApkOtaUpdater'
import { loadPosPeripherals, type PosPeripheralSettings } from '@/lib/pos-peripherals'
import { useDeviceDiagnosticListener } from '@/lib/print/use-device-diagnostic-listener'
import { usePosPrintListener } from '@/lib/print/use-pos-print-listener'

function PosSuperInner() {
  const { lock, operatorName } = useDeviceLock()
  useDeviceDiagnosticListener(true)
  usePosPrintListener(true)
  const [module, setModule] = useState<PosModuleId | null>(null)
  const [peripherals, setPeripherals] = useState<PosPeripheralSettings>(loadPosPeripherals())

  if (!operatorName) return null

  if (module === null) {
    return (
      <PosHomeHub
        operatorName={operatorName}
        onSelect={setModule}
        onLock={lock}
      />
    )
  }

  const panel =
    module === 'commande' ? (
      <PosDisplay mode="device" superApp />
    ) : module === 'cuisine' ? (
      <PosKitchenQueueTab />
    ) : module === 'salles' ? (
      <PosTablesTab />
    ) : module === 'reservations' ? (
      <PosReservationsTab />
    ) : module === 'wifi' ? (
      <PosWifiTab />
    ) : module === 'stock' ? (
      <PosStockTab />
    ) : module === 'params' ? (
      <PosPeripheralsTab settings={peripherals} onChange={setPeripherals} />
    ) : (
      <PosNotificationsTab />
    )

  return (
    <PosModuleShell
      title={getPosModuleLabel(module)}
      operatorName={operatorName}
      onHome={() => setModule(null)}
      onLock={lock}
    >
      {panel}
    </PosModuleShell>
  )
}

export function PosSuperApp() {
  return (
    <DeviceShopGate deviceLabel="caisse POS">
      <DevicePinGate device="pos">
        <PosWebViewGate>
          <PosLiveProvider>
            <ApkOtaUpdater />
            <div className="flex h-[100dvh] flex-col overflow-hidden bg-charcoal">
              <PosSuperInner />
            </div>
          </PosLiveProvider>
        </PosWebViewGate>
      </DevicePinGate>
    </DeviceShopGate>
  )
}
