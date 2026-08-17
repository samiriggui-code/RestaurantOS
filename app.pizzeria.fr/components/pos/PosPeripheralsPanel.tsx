'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Banknote,
  Bell,
  ChefHat,
  CreditCard,
  Loader2,
  Printer,
  RefreshCw,
  Settings2,
  Smartphone,
  Truck,
  Wifi,
} from 'lucide-react'
import {
  DEFAULT_POS_PERIPHERALS,
  savePosPeripherals,
  type PosPeripheralSettings,
} from '@/lib/pos-peripherals'
import { probePosHardware } from '@/lib/pos-peripheral-tests'
import { PosDeviceConfigSheet, type PosDeviceDef } from '@/components/pos/PosDeviceConfigSheet'
import { cn } from '@/lib/cn'

export const POS_DEVICES: PosDeviceDef[] = [
  {
    id: 'epson',
    title: 'Pont Epson LAN',
    subtitle: 'RAW TCP :9100 via APK Android',
    icon: Wifi,
    testKey: 'epson',
  },
  {
    id: 'kitchen',
    title: 'Imprimante cuisine',
    subtitle: 'Ticket préparation',
    icon: ChefHat,
    enabledKey: 'printerKitchen',
    testKey: 'kitchen',
    config: 'kitchen-ip',
  },
  {
    id: 'counter',
    title: 'Imprimante caisse',
    subtitle: 'Reçu client 80 mm',
    icon: Printer,
    enabledKey: 'printerCounter',
    testKey: 'counter',
    config: 'counter-ip',
  },
  {
    id: 'delivery',
    title: 'Imprimante livraison',
    subtitle: 'Étiquette sac + adresse',
    icon: Truck,
    enabledKey: 'printerDelivery',
    testKey: 'delivery',
  },
  {
    id: 'sunmi',
    title: 'Imprimante SUNMI',
    subtitle: 'Thermique intégrée V2',
    icon: Smartphone,
    testKey: 'sunmi',
  },
  {
    id: 'tpe',
    title: 'Terminal TPE',
    subtitle: 'Ingenico · SUNMI Pay',
    icon: CreditCard,
    enabledKey: 'tpeEnabled',
    testKey: 'tpe',
    config: 'tpe-provider',
  },
  {
    id: 'drawer',
    title: 'Tiroir-caisse',
    subtitle: 'Impulsion ESC/POS',
    icon: Banknote,
    enabledKey: 'cashDrawer',
    testKey: 'drawer',
  },
  {
    id: 'coin',
    title: 'Monnayeur',
    subtitle: 'Cashkeeper / Glory',
    icon: Banknote,
    enabledKey: 'coinDispenser',
    testKey: 'coin',
  },
  {
    id: 'behavior',
    title: 'Ticket cuisine auto',
    subtitle: 'À chaque encaissement',
    icon: ChefHat,
    enabledKey: 'autoPrintKitchenOnPay',
    config: 'auto-print',
  },
  {
    id: 'sound',
    title: 'Alerte commande',
    subtitle: 'Bip nouvelle commande',
    icon: Bell,
    testKey: 'sound',
  },
]

function DeviceRow({
  def,
  settings,
  onChange,
  onConfigure,
  statusLabel,
  statusOk,
}: {
  def: PosDeviceDef
  settings: PosPeripheralSettings
  onChange: (s: PosPeripheralSettings) => void
  onConfigure: () => void
  statusLabel: string
  statusOk: boolean | null
}) {
  const Icon = def.icon
  const enabled = def.enabledKey ? settings[def.enabledKey] === true : true

  const toggle = () => {
    if (!def.enabledKey) return
    const next = { ...settings, [def.enabledKey]: !settings[def.enabledKey] }
    onChange(next)
    savePosPeripherals(next)
  }

  return (
    <article className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#141010] px-4 py-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/5">
        <Icon className="h-4 w-4 text-tomato-light" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-cream">{def.title}</h3>
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase',
              statusOk === null && 'bg-white/10 text-cream/45',
              statusOk === true && 'bg-emerald-500/20 text-emerald-300',
              statusOk === false && 'bg-red-500/20 text-red-300',
            )}
          >
            {statusLabel}
          </span>
        </div>
        <p className="text-xs text-cream/40">{def.subtitle}</p>
      </div>
      {def.enabledKey && (
        <button
          type="button"
          onClick={toggle}
          className={cn(
            'relative h-6 w-10 shrink-0 rounded-full transition',
            enabled ? 'bg-tomato' : 'bg-white/15',
          )}
          aria-label={enabled ? 'Désactiver' : 'Activer'}
        >
          <span
            className={cn(
              'absolute top-0.5 h-5 w-5 rounded-full bg-white transition',
              enabled ? 'left-[18px]' : 'left-0.5',
            )}
          />
        </button>
      )}
      <button
        type="button"
        onClick={onConfigure}
        className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-cream/70 hover:bg-white/5 hover:text-cream"
      >
        <Settings2 className="h-3.5 w-3.5" />
        Paramétrer
      </button>
    </article>
  )
}

function PeripheralsList({
  settings,
  onChange,
}: {
  settings: PosPeripheralSettings
  onChange: (s: PosPeripheralSettings) => void
}) {
  const [hw, setHw] = useState<Awaited<ReturnType<typeof probePosHardware>> | null>(null)
  const [loadingHw, setLoadingHw] = useState(true)
  const [sheetDevice, setSheetDevice] = useState<PosDeviceDef | null>(null)

  const refreshHw = useCallback(async () => {
    setLoadingHw(true)
    try {
      setHw(await probePosHardware(settings))
    } finally {
      setLoadingHw(false)
    }
  }, [settings])

  useEffect(() => {
    void refreshHw()
  }, [refreshHw])

  const ips = hw?.ips ?? { kitchen: '', counter: '' }

  function statusFor(def: PosDeviceDef): { ok: boolean | null; label: string } {
    const enabled = def.enabledKey ? settings[def.enabledKey] === true : true
    if (def.id === 'epson') {
      return { ok: hw?.epsonBridge ?? null, label: hw?.epsonBridge ? 'Pont OK' : 'Absent' }
    }
    if (def.id === 'kitchen') {
      return {
        ok: enabled ? Boolean(ips.kitchen || hw?.sunmi) : null,
        label: ips.kitchen || (hw?.sunmi ? 'SUNMI' : 'IP ?'),
      }
    }
    if (def.id === 'counter') {
      return {
        ok: enabled ? Boolean(ips.counter || hw?.sunmi) : null,
        label: ips.counter || (hw?.sunmi ? 'SUNMI' : 'IP ?'),
      }
    }
    if (def.id === 'sunmi') {
      return { ok: hw?.sunmi ?? null, label: hw?.sunmi ? 'Détecté' : 'N/A' }
    }
    if (def.id === 'tpe') {
      return {
        ok: enabled ? Boolean(hw?.tpeNative) : null,
        label: hw?.tpeNative ? 'Natif' : 'Manuel',
      }
    }
    if (def.enabledKey) {
      return { ok: enabled, label: enabled ? 'ON' : 'OFF' }
    }
    return { ok: null, label: '—' }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/25 px-4 py-3">
        <p className="text-xs text-cream/50">
          {loadingHw
            ? 'Détection matériel…'
            : [
                hw?.epsonBridge && 'Epson',
                hw?.sunmi && 'SUNMI',
                hw?.tpeNative && 'TPE',
                ips.kitchen && `Cuisine ${ips.kitchen}`,
                ips.counter && `Caisse ${ips.counter}`,
              ]
                .filter(Boolean)
                .join(' · ') || 'Configurez les IP (CRM ou Paramétrer)'}
        </p>
        <button
          type="button"
          disabled={loadingHw}
          onClick={() => void refreshHw()}
          className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1 text-xs hover:bg-white/5"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', loadingHw && 'animate-spin')} />
          Actualiser
        </button>
      </div>

      {POS_DEVICES.map((def) => {
        const st = statusFor(def)
        return (
          <DeviceRow
            key={def.id}
            def={def}
            settings={settings}
            onChange={onChange}
            onConfigure={() => setSheetDevice(def)}
            statusLabel={st.label}
            statusOk={st.ok}
          />
        )
      })}

      <PosDeviceConfigSheet
        device={sheetDevice}
        open={sheetDevice != null}
        onClose={() => setSheetDevice(null)}
        settings={settings}
        onChange={onChange}
      />
    </div>
  )
}

export function PosPeripheralsTab({
  settings,
  onChange,
}: {
  settings: PosPeripheralSettings
  onChange: (s: PosPeripheralSettings) => void
}) {
  return (
    <div className="flex h-full flex-col overflow-hidden bg-charcoal text-cream">
      <header className="shrink-0 border-b border-white/10 px-5 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-tomato-light">POS · Matériel</p>
        <h1 className="font-display text-xl font-bold">Périphériques</h1>
        <p className="mt-1 text-sm text-cream/45">
          Activez chaque device, ouvrez Paramétrer pour IP, provider TPE et tests.
        </p>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        <PeripheralsList settings={settings} onChange={onChange} />
        <button
          type="button"
          onClick={() => {
            onChange({ ...DEFAULT_POS_PERIPHERALS })
            savePosPeripherals(DEFAULT_POS_PERIPHERALS)
          }}
          className="mt-4 text-xs text-cream/40 underline hover:text-cream/70"
        >
          Réinitialiser tous les réglages
        </button>
      </div>
    </div>
  )
}

export function PosPeripheralsPanel({
  open,
  onClose,
  settings,
  onChange,
}: {
  open: boolean
  onClose: () => void
  settings: PosPeripheralSettings
  onChange: (s: PosPeripheralSettings) => void
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] flex justify-end bg-black/60">
      <div className="flex h-full w-full max-w-lg flex-col border-l border-white/10 bg-[#141010] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div>
            <p className="text-xs uppercase tracking-widest text-cream/40">Accès rapide</p>
            <h2 className="font-display text-lg text-cream">Périphériques</h2>
          </div>
          <button type="button" onClick={onClose} className="text-sm text-cream/50 hover:text-cream">
            Fermer
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <PeripheralsList settings={settings} onChange={onChange} />
        </div>
      </div>
    </div>
  )
}
