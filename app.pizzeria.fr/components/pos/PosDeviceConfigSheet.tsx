'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { SideSheet } from '@/components/ui/side-sheet'
import { savePosPeripherals, type PosPeripheralSettings } from '@/lib/pos-peripherals'
import {
  probePosHardware,
  testCashDrawer,
  testCoinDispenser,
  testCounterPrinter,
  testDeliveryPrinter,
  testEpsonBridgeLink,
  testKitchenPrinter,
  testNewOrderSound,
  testSunmiIntegrated,
  testTpeLink,
  type PeripheralTestResult,
} from '@/lib/pos-peripheral-tests'
import type { PrinterConfig } from '@/lib/print/epson-lan-print'
import { cn } from '@/lib/cn'

export type PosDeviceDef = {
  id: string
  title: string
  subtitle: string
  icon: LucideIcon
  enabledKey?:
    | 'printerKitchen'
    | 'printerCounter'
    | 'printerDelivery'
    | 'tpeEnabled'
    | 'cashDrawer'
    | 'coinDispenser'
    | 'autoPrintKitchenOnPay'
  testKey?:
    | 'kitchen'
    | 'counter'
    | 'delivery'
    | 'sunmi'
    | 'epson'
    | 'tpe'
    | 'drawer'
    | 'coin'
    | 'sound'
  config?: 'kitchen-ip' | 'counter-ip' | 'tpe-provider' | 'auto-print'
}

type Props = {
  device: PosDeviceDef | null
  open: boolean
  onClose: () => void
  settings: PosPeripheralSettings
  onChange: (s: PosPeripheralSettings) => void
}

export function PosDeviceConfigSheet({ device, open, onClose, settings, onChange }: Props) {
  const [hw, setHw] = useState<Awaited<ReturnType<typeof probePosHardware>> | null>(null)
  const [loadingHw, setLoadingHw] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<PeripheralTestResult | undefined>()

  const refreshHw = useCallback(async () => {
    setLoadingHw(true)
    try {
      setHw(await probePosHardware(settings))
    } finally {
      setLoadingHw(false)
    }
  }, [settings])

  useEffect(() => {
    if (open) {
      void refreshHw()
      setTestResult(undefined)
    }
  }, [open, refreshHw])

  if (!device) return null

  const current = device

  const enabled = current.enabledKey ? settings[current.enabledKey] === true : true
  const crm: PrinterConfig = hw?.crm ?? {}
  const ips = hw?.ips ?? { kitchen: '', counter: '' }

  const patch = (partial: Partial<PosPeripheralSettings>) => {
    const next = { ...settings, ...partial }
    onChange(next)
    savePosPeripherals(next)
  }

  const toggle = () => {
    if (!current.enabledKey) return
    patch({ [current.enabledKey]: !settings[current.enabledKey] })
  }

  async function runTest() {
    if (!current.testKey) return
    setTesting(true)
    setTestResult(undefined)
    let result: PeripheralTestResult
    switch (current.testKey) {
      case 'kitchen':
        result = await testKitchenPrinter(settings, crm)
        break
      case 'counter':
        result = await testCounterPrinter(settings, crm)
        break
      case 'delivery':
        result = await testDeliveryPrinter(settings)
        break
      case 'sunmi':
        result = await testSunmiIntegrated()
        break
      case 'epson':
        result = testEpsonBridgeLink()
        break
      case 'tpe':
        result = testTpeLink(settings)
        break
      case 'drawer':
        result = await testCashDrawer(settings, crm)
        break
      case 'coin':
        result = testCoinDispenser()
        break
      case 'sound':
        result = await testNewOrderSound()
        break
      default:
        result = { ok: false, message: 'Test inconnu' }
    }
    setTestResult(result)
    setTesting(false)
  }

  const Icon = current.icon

  return (
    <SideSheet
      open={open}
      onClose={onClose}
      title={current.title}
      subtitle="Périphérique POS"
      width="md"
      footer={
        current.testKey ? (
          <button
            type="button"
            disabled={testing || (current.enabledKey && !enabled)}
            onClick={() => void runTest()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-tomato py-3 text-sm font-semibold text-white hover:bg-tomato-light disabled:opacity-50"
          >
            {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Tester ce périphérique
          </button>
        ) : undefined
      }
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-[#141010] p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/5">
            <Icon className="h-5 w-5 text-tomato-light" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-cream/70">{current.subtitle}</p>
            {loadingHw ? (
              <p className="mt-2 text-xs text-cream/40">Détection matériel…</p>
            ) : (
              <p className="mt-2 text-xs text-cream/45">
                {current.id === 'kitchen' && (ips.kitchen || 'IP cuisine non configurée')}
                {current.id === 'counter' && (ips.counter || 'IP comptoir non configurée')}
                {current.id === 'epson' && (hw?.epsonBridge ? 'Pont APK actif' : 'Pont APK absent')}
                {current.id === 'sunmi' && (hw?.sunmi ? 'SUNMI détecté' : 'SUNMI non détecté')}
                {current.id === 'tpe' && (hw?.tpeNative ? 'TPE natif' : 'Mode manuel')}
              </p>
            )}
          </div>
          {current.enabledKey && (
            <button
              type="button"
              onClick={toggle}
              className={cn(
                'relative h-7 w-12 shrink-0 rounded-full transition',
                enabled ? 'bg-tomato' : 'bg-white/15',
              )}
              aria-label={enabled ? 'Désactiver' : 'Activer'}
            >
              <span
                className={cn(
                  'absolute top-0.5 h-6 w-6 rounded-full bg-white transition',
                  enabled ? 'left-[22px]' : 'left-0.5',
                )}
              />
            </button>
          )}
        </div>

        {current.config === 'kitchen-ip' && enabled && (
          <label className="block text-xs">
            <span className="text-cream/50">IP cuisine (LAN)</span>
            <input
              value={settings.kitchenLanIpOverride ?? ''}
              onChange={(e) => patch({ kitchenLanIpOverride: e.target.value })}
              placeholder={crm.kitchenLanIp ?? '192.168.1.50'}
              className="mt-1 w-full rounded-lg border border-white/10 bg-charcoal px-3 py-2 font-mono text-sm"
            />
            {crm.kitchenLanIp && (
              <span className="mt-1 block text-[10px] text-cream/35">CRM : {crm.kitchenLanIp}</span>
            )}
          </label>
        )}

        {current.config === 'counter-ip' && enabled && (
          <label className="block text-xs">
            <span className="text-cream/50">IP comptoir (LAN)</span>
            <input
              value={settings.counterLanIpOverride ?? ''}
              onChange={(e) => patch({ counterLanIpOverride: e.target.value })}
              placeholder={crm.counterLanIp ?? '192.168.1.51'}
              className="mt-1 w-full rounded-lg border border-white/10 bg-charcoal px-3 py-2 font-mono text-sm"
            />
            {crm.counterLanIp && (
              <span className="mt-1 block text-[10px] text-cream/35">CRM : {crm.counterLanIp}</span>
            )}
          </label>
        )}

        {current.config === 'tpe-provider' && enabled && hw?.tpeCaps && (
          <label className="block text-xs">
            <span className="text-cream/50">Provider TPE</span>
            <select
              value={settings.preferredTpeProviderId ?? hw.tpeCaps.activeProvider ?? ''}
              onChange={(e) => patch({ preferredTpeProviderId: e.target.value || undefined })}
              className="mt-1 w-full rounded-lg border border-white/10 bg-charcoal px-3 py-2 text-sm"
            >
              {hw.tpeCaps.providers.map((p) => (
                <option key={p.id} value={p.id} disabled={!p.available}>
                  {p.label} ({p.connection}){p.available ? '' : ' — off'}
                </option>
              ))}
            </select>
          </label>
        )}

        {current.config === 'auto-print' && (
          <p className="text-xs leading-relaxed text-cream/45">
            Quand activé, un ticket cuisine part automatiquement à chaque encaissement comptoir ou en ligne.
          </p>
        )}

        {testResult && (
          <div
            className={cn(
              'rounded-lg border px-3 py-2 text-sm',
              testResult.ok
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                : 'border-red-500/30 bg-red-500/10 text-red-200',
            )}
          >
            {testResult.message}
            {testResult.detail ? <span className="mt-1 block text-xs opacity-80">{testResult.detail}</span> : null}
          </div>
        )}

        <p className="text-[10px] leading-relaxed text-cream/35">
          Les IP globales se configurent dans CRM → Appareils → Réseau. Les champs ci-dessus surchargent uniquement ce
          terminal.
        </p>
      </div>
    </SideSheet>
  )
}
