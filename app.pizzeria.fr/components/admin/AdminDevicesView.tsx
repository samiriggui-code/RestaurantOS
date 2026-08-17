'use client'

import { useCallback, useEffect, useState } from 'react'
import { useFeedbackState } from '@/lib/use-feedback-state'
import Link from 'next/link'
import {
  AlertTriangle,
  CheckCircle2,
  ChefHat,
  Loader2,
  RefreshCw,
  Smartphone,
  Store,
  Tablet,
  Trash2,
  Truck,
  Wifi,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { DeviceDiagnosticsPanel } from '@/components/admin/DeviceDiagnosticsPanel'
import { ApkInstallGuide } from '@/components/admin/ApkInstallGuide'
import { DeviceRegisterModal } from '@/components/admin/DeviceRegisterModal'
import { DeviceConfigSheet } from '@/components/admin/DeviceConfigSheet'
import { StoreScopeBar } from '@/components/admin/StoreScopeBar'
import { DeviceLaunchCards } from '@/components/ops/DeviceLaunchCards'
import { AdminPageHeader, AdminPageShell, AdminSectionTabs } from '@/components/admin/AdminSectionTabs'
import { getStaffSession, getStaffUser } from '@/lib/staff-auth'
import {
  captureWanIp,
  completeOnboarding,
  completeRecipe,
  DEVICE_SLOT_LABELS,
  fetchDevicesAdmin,
  generatePairingCode,
  isPrivateOrReservedIp,
  resetOnboarding,
  savePrinterIps,
  unpairDevice,
  type DeviceSlot,
  type DevicesAdminState,
  type PairedDevice,
} from '@/lib/device-onboarding'
import { cn } from '@/lib/cn'
import { useAdminFeedback } from '@/components/admin/AdminFeedbackProvider'
import { publicSitePath } from '@/lib/public-site-url'
import {
  persistSelectedBusinessId,
  resolveSelectedBusinessId,
  selectedStoreRow,
} from '@/lib/store-scope'

type DeviceTab = 'devices' | 'network' | 'setup'

const TABS: { id: DeviceTab; label: string; icon: LucideIcon }[] = [
  { id: 'devices', label: 'Appareils', icon: Smartphone },
  { id: 'network', label: 'Réseau & imprimantes', icon: Wifi },
  { id: 'setup', label: 'Mise en service', icon: CheckCircle2 },
]

function formatDeviceError(err: unknown): string {
  const msg = err instanceof Error ? err.message : 'Erreur'
  if (msg === 'Insufficient permissions') {
    return 'Session CRM invalide — reconnectez-vous sur /login (gérant, email + mot de passe).'
  }
  return msg
}

function stripeBadge(mode: DevicesAdminState['stripeMode']) {
  if (mode === 'live') {
    return (
      <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs text-emerald-300">
        Stripe LIVE
      </span>
    )
  }
  if (mode === 'test') {
    return (
      <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 text-xs text-amber-300">
        Stripe TEST
      </span>
    )
  }
  return (
    <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs text-cream/50">
      Stripe non configuré
    </span>
  )
}

export function AdminDevicesView({ embedded = false }: { embedded?: boolean }) {
  const [tab, setTab] = useState<DeviceTab>('devices')
  const [state, setState] = useState<DevicesAdminState | null>(null)
  const [loading, setLoading] = useState(true)
  const { error, setError, message, setMessage } = useFeedbackState()
  const [busy, setBusy] = useState<string | null>(null)
  const [pairingCode, setPairingCode] = useState<{ slot: DeviceSlot; code: string; expiresAt: string } | null>(
    null,
  )
  const [kitchenIp, setKitchenIp] = useState('')
  const [counterIp, setCounterIp] = useState('')
  const [registerOpen, setRegisterOpen] = useState(false)
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null)
  const [configSlot, setConfigSlot] = useState<DeviceSlot | null>(null)
  const isAdmin = getStaffUser('crm')?.role === 'ADMIN'
  const { confirm } = useAdminFeedback()

  const reload = useCallback(async () => {
    const session = getStaffSession('crm')
    if (!session) return
    setLoading(true)
    setError(null)
    try {
      const data = await fetchDevicesAdmin(session.token)
      setState(data)
      setKitchenIp(data.devices.printers?.kitchenLanIp ?? '')
      setCounterIp(data.devices.printers?.counterLanIp ?? '')
      const stores = data.storeInventory ?? []
      setSelectedStoreId((prev) => prev ?? resolveSelectedBusinessId(stores))
    } catch (err) {
      setError(formatDeviceError(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  async function runAction(key: string, fn: () => Promise<void>) {
    setBusy(key)
    setError(null)
    setMessage(null)
    try {
      await fn()
      await reload()
    } catch (err) {
      setError(formatDeviceError(err))
    } finally {
      setBusy(null)
    }
  }

  async function handleGenerateCode(slot: DeviceSlot, label?: string) {
    const session = getStaffSession('crm')
    if (!session) return
    const deviceLabel = label?.trim() || DEVICE_SLOT_LABELS[slot]
    await runAction(`code-${slot}`, async () => {
      const res = await generatePairingCode(session.token, slot, deviceLabel)
      setPairingCode({ slot, code: res.code, expiresAt: res.expiresAt })
      setMessage(`Code ${res.code} pour ${deviceLabel} — valide 15 min.`)
    })
  }

  async function handleRegisterDevice(slot: DeviceSlot, label: string) {
    const session = getStaffSession('crm')
    if (!session) throw new Error('Session CRM requise')
    const res = await generatePairingCode(session.token, slot, label)
    setPairingCode({ slot, code: res.code, expiresAt: res.expiresAt })
    await reload()
    return res
  }

  function handleStoreSelect(businessId: string) {
    setSelectedStoreId(businessId)
    persistSelectedBusinessId(businessId)
  }

  if (loading && !state) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-tomato-light" />
        <span className="sr-only">Chargement…</span>
      </div>
    )
  }

  const devices = state?.devices
  const paired = devices?.pairedDevices ?? []
  const slotCapacity = state?.slotCapacity ?? []
  const stores = state?.storeInventory ?? []
  const activeStore = selectedStoreRow(stores, selectedStoreId)

  function isSlotFull(slot: DeviceSlot) {
    const row = slotCapacity.find((s) => s.slot === slot)
    return row ? row.available <= 0 : pairedForSlot(slot).length > 0
  }

  function pairedForSlot(slot: DeviceSlot) {
    return paired.filter((d) => d.slot === slot)
  }

  const shell = (
    <>
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-200">
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-200">
          {message}
        </div>
      )}

      <AdminSectionTabs tabs={TABS} active={tab} onChange={setTab} />

      <div className="min-h-[360px] rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
        {tab === 'devices' && (
          <DevicesHubPanel
            devices={devices}
            state={state}
            stores={stores}
            activeStore={activeStore}
            selectedStoreId={selectedStoreId}
            onStoreSelect={handleStoreSelect}
            paired={paired}
            slotCapacity={slotCapacity}
            pairingCode={pairingCode}
            configSlot={configSlot}
            busy={busy}
            onOpenConfig={setConfigSlot}
            onOpenRegister={() => setRegisterOpen(true)}
            onGenerateCode={(slot) => void handleGenerateCode(slot)}
            onUnpair={(id) => {
              const session = getStaffSession('crm')
              if (!session) return
              void runAction(`unpair-${id}`, async () => {
                await unpairDevice(session.token, id)
                setMessage('Appareil dissocié.')
                if (configSlot) setConfigSlot(null)
              })
            }}
            onReplaceSlot={async (slot) => {
              const device = pairedForSlot(slot)[0]
              if (!device) return
              if (
                !(await confirm({
                  title: 'Remplacer le terminal',
                  message: `Dissocier « ${device.label} » pour libérer le slot et jumeler un nouvel appareil ?`,
                  confirmLabel: 'Dissocier et remplacer',
                  destructive: true,
                }))
              ) {
                return
              }
              const session = getStaffSession('crm')
              if (!session) return
              void runAction(`replace-${slot}`, async () => {
                await unpairDevice(session.token, device.id)
                setMessage('Slot libéré — générez un nouveau code.')
              })
            }}
            pairedForSlot={pairedForSlot}
            isSlotFull={isSlotFull}
          />
        )}

        {tab === 'network' && (
          <NetworkPanel
            devices={devices}
            kitchenIp={kitchenIp}
            counterIp={counterIp}
            busy={busy}
            onKitchenIp={setKitchenIp}
            onCounterIp={setCounterIp}
            onRun={runAction}
            onMessage={setMessage}
          />
        )}

        {tab === 'setup' && (
          <SetupPanel
            devices={devices}
            state={state}
            isAdmin={isAdmin}
            busy={busy}
            pairedCount={paired.length}
            onRun={runAction}
            onMessage={setMessage}
          />
        )}
      </div>

      <DeviceConfigSheet
        open={configSlot !== null}
        onClose={() => setConfigSlot(null)}
        slot={configSlot}
        storeName={activeStore?.businessName ?? 'La boutique'}
        device={configSlot ? pairedForSlot(configSlot)[0] ?? null : null}
        pairingCode={
          configSlot && pairingCode?.slot === configSlot
            ? { code: pairingCode.code, expiresAt: pairingCode.expiresAt }
            : null
        }
        slotFull={configSlot ? isSlotFull(configSlot) : false}
        busy={!!busy}
        onGenerateCode={() => {
          if (configSlot) void handleGenerateCode(configSlot)
        }}
        onUnpair={() => {
          const d = configSlot ? pairedForSlot(configSlot)[0] : null
          if (d) {
            const session = getStaffSession('crm')
            if (!session) return
            void runAction(`unpair-${d.id}`, async () => {
              await unpairDevice(session.token, d.id)
              setMessage('Appareil dissocié.')
            })
          }
        }}
        onReplace={() => {
          if (configSlot) {
            const device = pairedForSlot(configSlot)[0]
            if (!device) return
            void (async () => {
              if (
                !(await confirm({
                  title: 'Remplacer le terminal',
                  message: `Dissocier « ${device.label} » pour libérer le slot ?`,
                  confirmLabel: 'Dissocier',
                  destructive: true,
                }))
              ) {
                return
              }
              const session = getStaffSession('crm')
              if (!session) return
              void runAction(`replace-${configSlot}`, async () => {
                await unpairDevice(session.token, device.id)
                setMessage('Slot libéré.')
              })
            })()
          }
        }}
      />

      <DeviceRegisterModal
        open={registerOpen}
        onClose={() => setRegisterOpen(false)}
        storeName={activeStore?.businessName ?? 'La boutique'}
        slotCapacity={slotCapacity}
        busy={busy === 'register'}
        onCreate={async (slot, label) => {
          setBusy('register')
          setError(null)
          try {
            const res = await handleRegisterDevice(slot, label)
            return res
          } catch (err) {
            setError(formatDeviceError(err))
            throw err
          } finally {
            setBusy(null)
          }
        }}
      />
    </>
  )

  if (embedded) {
    return <div className="w-full space-y-4">{shell}</div>
  }

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Devices & boutiques"
        description="POS, KDS, applis livreur — jumelage et isolation par point de vente."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {state && stripeBadge(state.stripeMode)}
            <button
              type="button"
              onClick={() => setRegisterOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-tomato px-4 py-2.5 text-sm font-semibold text-white hover:bg-tomato-light"
            >
              + Nouveau device
            </button>
          </div>
        }
      />
      <div className="mt-6 space-y-4">{shell}</div>
    </AdminPageShell>
  )
}

function DevicesHubPanel({
  stores,
  activeStore,
  selectedStoreId,
  onStoreSelect,
  paired,
  slotCapacity,
  pairingCode,
  configSlot,
  busy,
  onOpenConfig,
  onOpenRegister,
  onGenerateCode,
  onUnpair,
  onReplaceSlot,
  pairedForSlot,
  isSlotFull,
}: {
  devices: DevicesAdminState['devices'] | undefined
  state: DevicesAdminState | null
  stores: NonNullable<DevicesAdminState['storeInventory']>
  activeStore: ReturnType<typeof selectedStoreRow>
  selectedStoreId: string | null
  onStoreSelect: (id: string) => void
  paired: PairedDevice[]
  slotCapacity: NonNullable<DevicesAdminState['slotCapacity']>
  pairingCode: { slot: DeviceSlot; code: string; expiresAt: string } | null
  configSlot: DeviceSlot | null
  busy: string | null
  onOpenConfig: (slot: DeviceSlot | null) => void
  onOpenRegister: () => void
  onGenerateCode: (slot: DeviceSlot) => void
  onUnpair: (id: string) => void
  onReplaceSlot: (slot: DeviceSlot) => void
  pairedForSlot: (slot: DeviceSlot) => PairedDevice[]
  isSlotFull: (slot: DeviceSlot) => boolean
}) {
  const SLOTS: { slot: DeviceSlot; icon: LucideIcon; testHref: string }[] = [
    { slot: 'pos-sunmi', icon: Store, testHref: '/pos' },
    { slot: 'pos-tablet', icon: Tablet, testHref: '/pos' },
    { slot: 'kds', icon: ChefHat, testHref: '/kitchen' },
  ]

  return (
    <div className="space-y-6">
      {stores.length > 0 && (
        <StoreScopeBar stores={stores} selectedId={selectedStoreId} onSelect={onStoreSelect} />
      )}

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-cream/50">Accès rapide</h2>
          <p className="text-xs text-cream/40">Ouvre l&apos;app en plein écran sur ce navigateur</p>
        </div>
        <DeviceLaunchCards compact />
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-lg font-bold text-cream">Terminaux — {activeStore?.businessName ?? 'boutique'}</h2>
            <p className="text-xs text-cream/45">1 SUNMI · 1 tablette caisse · 1 KDS par point de vente</p>
          </div>
          <button
            type="button"
            onClick={onOpenRegister}
            className="rounded-xl border border-tomato/40 bg-tomato/10 px-3 py-2 text-sm font-medium text-tomato-light hover:bg-tomato/20"
          >
            + Nouveau device
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {SLOTS.map(({ slot, icon: Icon, testHref }) => {
            const cap = slotCapacity.find((s) => s.slot === slot)
            const device = pairedForSlot(slot)[0]
            const full = isSlotFull(slot)
            const hasPendingCode = pairingCode?.slot === slot

            return (
              <div
                key={slot}
                className={cn(
                  'rounded-2xl border p-4 transition-colors',
                  device ? 'border-emerald-500/25 bg-emerald-500/5' : 'border-white/10 bg-black/20',
                  configSlot === slot && 'ring-1 ring-tomato/40',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5">
                      <Icon className="h-5 w-5 text-cream/80" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-cream">{DEVICE_SLOT_LABELS[slot]}</p>
                      <p className="text-[11px] text-cream/40">
                        {cap ? `${cap.used}/${cap.limit}` : '—'} ·{' '}
                        {device ? device.label : full ? 'Slot occupé' : 'Disponible'}
                      </p>
                    </div>
                  </div>
                  <StatusPill ok={!!device} label={device ? 'Actif' : hasPendingCode ? 'Code actif' : 'Libre'} />
                </div>

                {hasPendingCode && !device && (
                  <p className="mt-2 font-mono text-lg tracking-widest text-tomato-light">{pairingCode!.code}</p>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenConfig(slot)}
                    className="rounded-lg bg-tomato/90 px-3 py-1.5 text-xs font-medium text-white hover:bg-tomato"
                  >
                    Configurer
                  </button>
                  {!device && !full && (
                    <button
                      type="button"
                      disabled={!!busy}
                      onClick={() => onGenerateCode(slot)}
                      className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs hover:bg-white/5 disabled:opacity-40"
                    >
                      Code
                    </button>
                  )}
                  {device && (
                    <button
                      type="button"
                      onClick={() => void onReplaceSlot(slot)}
                      className="rounded-lg border border-amber-500/30 px-2.5 py-1.5 text-xs text-amber-200 hover:bg-amber-500/10"
                    >
                      Remplacer
                    </button>
                  )}
                  <Link
                    href={testHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs hover:bg-white/5"
                  >
                    Ouvrir
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <section className="space-y-3 border-t border-white/10 pt-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-cream/50">Apps sans jumelage</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-4">
            <div className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-violet-300" />
              <p className="font-medium text-cream">App livreur</p>
            </div>
            <p className="mt-2 text-xs text-cream/45">PIN livreur — pas de code boutique. APK ou navigateur.</p>
            <Link
              href={publicSitePath('/livreur')}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block text-xs font-semibold text-violet-300 hover:underline"
            >
              Ouvrir l&apos;app livreur →
            </Link>
          </div>
          <div className="rounded-2xl border border-purple-500/20 bg-purple-500/5 p-4">
            <div className="flex items-center gap-2">
              <Tablet className="h-5 w-5 text-purple-300" />
              <p className="font-medium text-cream">Totem kiosque</p>
            </div>
            <p className="mt-2 text-xs text-cream/45">Self-service sur place — pas de jumelage CRM.</p>
            <Link
              href="/kiosk"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block text-xs font-semibold text-purple-300 hover:underline"
            >
              Ouvrir le kiosque →
            </Link>
          </div>
        </div>
      </section>

      {paired.length > 0 && (
        <section className="space-y-2 border-t border-white/10 pt-5">
          <h2 className="text-sm font-semibold text-cream">Tous les appareils jumelés</h2>
          <ul className="divide-y divide-white/10 rounded-xl border border-white/10">
            {paired.map((device) => (
              <PairedRow
                key={device.id}
                device={device}
                onUnpair={() => onUnpair(device.id)}
                busy={busy === `unpair-${device.id}`}
              />
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function SetupPanel({
  devices,
  state,
  isAdmin,
  busy,
  pairedCount,
  onRun,
  onMessage,
}: {
  devices: DevicesAdminState['devices'] | undefined
  state: DevicesAdminState | null
  isAdmin: boolean
  busy: string | null
  pairedCount: number
  onRun: (key: string, fn: () => Promise<void>) => Promise<void>
  onMessage: (msg: string) => void
}) {
  const { confirm } = useAdminFeedback()
  const badWanIp =
    devices?.allowedWanIps?.some((entry) =>
      isPrivateOrReservedIp(entry.split('/')[0] ?? entry),
    ) ?? false
  const badClientIp = state?.access.clientIp != null && isPrivateOrReservedIp(state.access.clientIp)
  const inventory = state?.storeInventory?.[0]
  const auditLog = devices?.deviceAuditLog ?? []
  const pairedList = devices?.pairedDevices ?? []

  async function handleResetOnboarding() {
    const session = getStaffSession('crm')
    if (!session) return
    if (
      !(await confirm({
        title: 'Réinitialiser la mise en service',
        message: 'Réinitialiser la mise en service ? Les appareils devront être reconfigurés.',
        confirmLabel: 'Réinitialiser',
        destructive: true,
      }))
    ) {
      return
    }
    void onRun('reset', async () => {
      await resetOnboarding(session.token)
      onMessage('Onboarding réinitialisé.')
    })
  }

  return (
    <div className="space-y-4">
      <h2 className="font-medium text-cream">État global</h2>
      <div className="flex flex-wrap gap-2">
        <StatusPill
          ok={
            (devices?.allowedWanIps?.length ?? 0) > 0 &&
            !badWanIp &&
            (devices?.pairedDevices?.length ?? 0) > 0
          }
          label={
            (devices?.pairedDevices?.length ?? 0) > 0 && devices?.allowedWanIps?.length
              ? `${devices.pairedDevices!.length} appareil(s) jumelé(s)`
              : 'Aucun appareil jumelé'
          }
        />
        <StatusPill
          ok={(devices?.allowedWanIps?.length ?? 0) > 0 && !badWanIp}
          label={
            devices?.allowedWanIps?.length
              ? badWanIp
                ? 'IP WAN invalide (réseau interne)'
                : `IP boutique : ${devices.allowedWanIps[0]?.split('/')[0] ?? devices.allowedWanIps[0]}`
              : 'IP WAN manquante'
          }
        />
        <StatusPill ok={pairedCount > 0} label={`${pairedCount} / 3 terminaux`} />
        {state?.stripeMode === 'test' && process.env.NODE_ENV === 'production' && (
          <span className="flex items-center gap-1 text-xs text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5" />
            Stripe TEST en prod
          </span>
        )}
      </div>
      {state?.access.clientIp && (
        <p className={cn('text-xs', badClientIp ? 'text-amber-400' : 'text-cream/40')}>
          Votre IP : {state.access.clientIp}
          {badClientIp
            ? ' — IP privée (Docker/VPS). Rechargez après déploiement du correctif, depuis le Wi‑Fi boutique.'
            : null}
        </p>
      )}

      <section className="space-y-3 border-t border-white/10 pt-4">
        <h3 className="text-sm font-medium text-cream">Inventaire matériel jumelé</h3>
        <p className="text-xs text-cream/50">
          Quotas : 1× SUNMI · 1× tablette caisse · 1× KDS · 2 imprimantes Epson (IP LAN, onglet Réseau).
        </p>
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full min-w-[520px] text-left text-xs">
            <thead className="bg-white/[0.04] text-cream/50">
              <tr>
                <th className="px-3 py-2 font-medium">Magasin</th>
                <th className="px-3 py-2 font-medium">IP boutique</th>
                <th className="px-3 py-2 font-medium">SUNMI</th>
                <th className="px-3 py-2 font-medium">Tablette</th>
                <th className="px-3 py-2 font-medium">KDS</th>
                <th className="px-3 py-2 font-medium">Imprimantes LAN</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-cream/80">
              <tr>
                <td className="px-3 py-2">{inventory?.businessName ?? 'La Z Pizza'}</td>
                <td className="px-3 py-2 font-mono">{inventory?.wanIp?.split('/')[0] ?? '—'}</td>
                <td className="px-3 py-2">
                  {state?.slotCapacity?.find((s) => s.slot === 'pos-sunmi')?.used ?? 0} / 1
                </td>
                <td className="px-3 py-2">
                  {state?.slotCapacity?.find((s) => s.slot === 'pos-tablet')?.used ?? 0} / 1
                </td>
                <td className="px-3 py-2">
                  {state?.slotCapacity?.find((s) => s.slot === 'kds')?.used ?? 0} / 1
                </td>
                <td className="px-3 py-2">
                  {[devices?.printers?.kitchenLanIp, devices?.printers?.counterLanIp].filter(Boolean)
                    .length || 0}{' '}
                  / 2
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        {pairedList.length > 0 && (
          <ul className="divide-y divide-white/5 rounded-xl border border-white/10">
            {pairedList.map((device) => (
              <PairedRow key={device.id} device={device} onUnpair={() => {}} busy={false} readOnly />
            ))}
          </ul>
        )}
        {auditLog.length > 0 && (
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <p className="mb-2 text-xs font-medium text-cream/70">Journal jumelage (récent)</p>
            <ul className="max-h-40 space-y-1 overflow-y-auto text-[11px] text-cream/45">
              {auditLog.slice(0, 12).map((entry, i) => (
                <li key={`${entry.at}-${i}`}>
                  {new Date(entry.at).toLocaleString('fr-FR')} — {entry.action}
                  {entry.note ? ` · ${entry.note}` : ''}
                  {entry.ip ? ` · ${entry.ip}` : ''}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {isAdmin && (
        <div className="border-t border-white/10 pt-4">
          <h3 className="mb-2 text-sm font-medium text-cream">Mise en service production</h3>
          <p className="mb-3 text-xs text-cream/50">
            Les appareils s&apos;activent automatiquement au jumelage. Ce bouton sert au reset manuel si besoin.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy === 'onboarding' || devices?.onboardingComplete === true}
              onClick={() => {
                const session = getStaffSession('crm')
                if (!session) return
                void onRun('onboarding', async () => {
                  await completeOnboarding(session.token)
                  onMessage('Mise en service effectuée.')
                })
              }}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              Activer POS / KDS
            </button>
            <button
              type="button"
              disabled={busy === 'reset'}
              onClick={() => void handleResetOnboarding()}
              className="rounded-xl border border-amber-500/30 px-3 py-2 text-sm text-amber-300 hover:bg-amber-500/10 disabled:opacity-50"
            >
              <RefreshCw className="mr-1 inline h-3.5 w-3.5" />
              Reset
            </button>
          </div>
        </div>
      )}

      <div className="border-t border-white/10 pt-4">
        <RecipePanel devices={devices} busy={busy} onRun={onRun} onMessage={onMessage} />
      </div>
    </div>
  )
}

function NetworkPanel({
  devices,
  kitchenIp,
  counterIp,
  busy,
  onKitchenIp,
  onCounterIp,
  onRun,
  onMessage,
}: {
  devices: DevicesAdminState['devices'] | undefined
  kitchenIp: string
  counterIp: string
  busy: string | null
  onKitchenIp: (v: string) => void
  onCounterIp: (v: string) => void
  onRun: (key: string, fn: () => Promise<void>) => Promise<void>
  onMessage: (msg: string) => void
}) {
  return (
    <div className="space-y-5">
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 font-medium text-cream">
          <Wifi className="h-4 w-4" />
          IP publique du restaurant (WAN)
        </h2>
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3 text-xs leading-relaxed text-cream/70">
          <p className="mb-2 font-medium text-blue-200/90">Ce que ça fait (et ce que ce n&apos;est pas)</p>
          <ul className="list-inside list-disc space-y-1 text-cream/60">
            <li>
              <strong className="text-cream/80">Oui :</strong> enregistre l&apos;IP publique de la box du shop
              (ex. Free/Orange) pour autoriser <code className="text-cream/70">/pos</code> et{' '}
              <code className="text-cream/70">/kitchen</code> depuis ce réseau uniquement.
            </li>
            <li>
              <strong className="text-cream/80">Oui :</strong> met à jour Traefik sur le VPS (whitelist IP) — le
              &quot;pont&quot; VPS ↔ boutique, pas un VPN.
            </li>
            <li>
              <strong className="text-cream/80">Non :</strong> ça ne scanne pas le réseau et ne détecte pas les
              tablettes automatiquement. Le jumelage se fait par <strong>code à 6 chiffres</strong> (onglets SUNMI /
              Tablette / KDS).
            </li>
          </ul>
        </div>
        <p className="text-xs text-cream/50">
          <strong className="text-cream/70">Procédure sur place :</strong> CRM → générer le code 6 chiffres →
          tablette : ouvrir <code className="text-cream/60">/kitchen</code> ou{' '}
          <code className="text-cream/60">/pos</code> → saisir le code → PIN employé.
        </p>
        <p className="text-xs text-amber-400/80">
          En dev local (<code>localhost</code>) cette étape est ignorée — la garde IP est désactivée.
        </p>
        <button
          type="button"
          disabled={busy === 'wan-ip'}
          onClick={() => {
            const session = getStaffSession('crm')
            if (!session) return
            void onRun('wan-ip', async () => {
              const res = await captureWanIp(session.token)
              const traefikNote =
                res.traefik?.synced === true
                  ? ' Traefik mis à jour.'
                  : res.traefik?.reason
                    ? ` Traefik : ${res.traefik.reason}.`
                    : ''
              onMessage(`IP enregistrée : ${res.capturedIp}.${traefikNote}`)
            })
          }}
          className="rounded-xl bg-tomato px-4 py-2 text-sm font-medium text-white hover:bg-tomato-light disabled:opacity-50"
        >
          {busy === 'wan-ip' ? <Loader2 className="inline h-4 w-4 animate-spin" /> : null}{' '}
          Utiliser l&apos;IP de ce réseau
        </button>
        {devices?.lastWanIpCapture && (
          <p className="text-xs text-cream/40">
            Dernière : {devices.lastWanIpCapture.ip} —{' '}
            {new Date(devices.lastWanIpCapture.at).toLocaleString('fr-FR')}
          </p>
        )}
      </section>

      <section className="space-y-3 border-t border-white/10 pt-4">
        <h2 className="font-medium text-cream">Imprimantes Epson (réseau local boutique)</h2>
        <p className="text-xs text-cream/50">
          IP <strong className="text-cream/70">privées</strong> (192.168.x.x) — accessibles seulement depuis le LAN du
          shop. Le VPS ne les voit pas ; la tablette SUNMI / KDS imprime en direct.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-cream/60">Cuisine (KDS)</span>
            <input
              value={kitchenIp}
              onChange={(e) => onKitchenIp(e.target.value)}
              placeholder="192.168.1.50"
              className="mt-1 w-full rounded-xl border border-white/15 bg-charcoal px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="text-cream/60">Comptoir (secours)</span>
            <input
              value={counterIp}
              onChange={(e) => onCounterIp(e.target.value)}
              placeholder="192.168.1.51"
              className="mt-1 w-full rounded-xl border border-white/15 bg-charcoal px-3 py-2 text-sm"
            />
          </label>
        </div>
        <button
          type="button"
          disabled={busy === 'printers'}
          onClick={() => {
            const session = getStaffSession('crm')
            if (!session) return
            void onRun('printers', async () => {
              await savePrinterIps(session.token, {
                kitchenLanIp: kitchenIp || undefined,
                counterLanIp: counterIp || undefined,
              })
              onMessage('IP imprimantes enregistrées.')
            })
          }}
          className="rounded-xl border border-white/15 px-4 py-2 text-sm hover:bg-white/5 disabled:opacity-50"
        >
          Enregistrer imprimantes
        </button>
      </section>
    </div>
  )
}

function DeviceSlotPanel({
  slot,
  paired,
  pairingCode,
  busy,
  slotFull,
  testHref,
  testLabel,
  diagnosticsVariant,
  apkKind,
  onGenerateCode,
  onUnpair,
}: {
  slot: DeviceSlot
  paired: PairedDevice[]
  pairingCode: { slot: DeviceSlot; code: string; expiresAt: string } | null
  busy: string | null
  slotFull?: boolean
  testHref: string
  testLabel: string
  diagnosticsVariant: 'pos' | 'kitchen'
  apkKind?: 'pos-sunmi' | 'pos-tablet' | 'kds' | 'livreur'
  onGenerateCode: () => void
  onUnpair: (id: string) => void
}) {
  const label = DEVICE_SLOT_LABELS[slot]

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-medium text-cream">{label}</h2>
        <p className="mt-1 text-xs text-cream/50">
          {slot === 'kds'
            ? 'Générez un code → ouvrez l’app KDS ou /kitchen → saisissez le code (une fois).'
            : slot === 'pos-sunmi'
              ? 'Installez l’APK SUNMI ci-dessous, puis générez un code de jumelage.'
              : slot === 'pos-tablet'
                ? 'Installez l’APK tablette caisse ci-dessous (paysage), puis générez un code de jumelage.'
                : 'Générez un code → ouvrez /pos sur la tablette → saisissez le code (une fois).'}
        </p>
        {slotFull && (
          <p className="mt-2 text-xs text-amber-400">
            Slot occupé — dissociez l&apos;appareil ci-dessous avant de jumeler un remplaçant.
          </p>
        )}
      </div>

      {apkKind && <ApkInstallGuide kind={apkKind} />}

      <button
        type="button"
        disabled={!!busy || slotFull}
        onClick={onGenerateCode}
        className="rounded-xl bg-tomato px-4 py-2 text-sm font-medium text-white hover:bg-tomato-light disabled:opacity-50"
      >
        Générer code jumelage
      </button>

      {pairingCode && (
        <div className="rounded-xl border border-tomato/30 bg-tomato/10 p-4 text-center">
          <p className="font-mono text-4xl font-bold tracking-widest text-cream">{pairingCode.code}</p>
          <p className="mt-1 text-xs text-cream/40">
            Expire {new Date(pairingCode.expiresAt).toLocaleTimeString('fr-FR')}
          </p>
        </div>
      )}

      {paired.length > 0 ? (
        <ul className="divide-y divide-white/10 rounded-xl border border-white/10">
          {paired.map((d) => (
            <PairedRow
              key={d.id}
              device={d}
              onUnpair={() => onUnpair(d.id)}
              busy={busy === `unpair-${d.id}`}
            />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-cream/40">Aucun appareil jumelé pour ce slot.</p>
      )}

      <div className="border-t border-white/10 pt-4">
        <DeviceDiagnosticsPanel variant={diagnosticsVariant} />
        <Link
          href={testHref}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-block rounded-xl border border-white/15 px-4 py-2 text-sm hover:bg-white/5"
        >
          {testLabel}
        </Link>
      </div>
    </div>
  )
}

function RecipePanel({
  devices,
  busy,
  onRun,
  onMessage,
}: {
  devices: DevicesAdminState['devices'] | undefined
  busy: string | null
  onRun: (key: string, fn: () => Promise<void>) => Promise<void>
  onMessage: (msg: string) => void
}) {
  return (
    <div className="space-y-4">
      <h2 className="font-medium text-cream">Recette boutique</h2>
      <p className="text-xs text-cream/50">
        Tests API, socket et impression — puis validez avant la mise en service.
      </p>
      <div className="flex flex-wrap gap-2">
        <Link
          href="/admin/kitchen"
          className="rounded-xl border border-white/15 px-3 py-2 text-sm hover:bg-white/5"
        >
          Suivi cuisine (CRM)
        </Link>
        <Link
          href="/admin/pos"
          className="rounded-xl border border-white/15 px-3 py-2 text-sm hover:bg-white/5"
        >
          Suivi caisse (CRM)
        </Link>
        <button
          type="button"
          disabled={busy === 'recipe'}
          onClick={() => {
            const session = getStaffSession('crm')
            if (!session) return
            void onRun('recipe', async () => {
              await completeRecipe(session.token)
              onMessage('Recette validée.')
            })
          }}
          className="rounded-xl border border-emerald-500/30 px-4 py-2 text-sm text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-50"
        >
          Valider la recette
        </button>
      </div>
      {devices?.recipeCompletedAt && (
        <p className="text-xs text-cream/40">
          Validée le {new Date(devices.recipeCompletedAt).toLocaleString('fr-FR')}
        </p>
      )}
    </div>
  )
}

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={cn(
        'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs',
        ok ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/10 text-cream/50',
      )}
    >
      {ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
      {label}
    </span>
  )
}

function PairedRow({
  device,
  onUnpair,
  busy,
  readOnly = false,
}: {
  device: PairedDevice
  onUnpair: () => void
  busy: boolean
  readOnly?: boolean
}) {
  const ip = device.lastIp ?? device.pairedFromIp
  return (
    <li className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
      <div className="min-w-0">
        <p className="font-medium text-cream">{device.label}</p>
        <p className="text-xs text-cream/40">
          Jumelé le {new Date(device.pairedAt).toLocaleString('fr-FR')}
          {ip ? ` · IP ${ip}` : ''}
        </p>
        {device.userAgent && (
          <p className="truncate text-[10px] text-cream/30" title={device.userAgent}>
            {device.userAgent.slice(0, 80)}
          </p>
        )}
      </div>
      {!readOnly && (
        <button
          type="button"
          onClick={onUnpair}
          disabled={busy}
          className="rounded-lg p-2 text-red-400 hover:bg-red-500/10 disabled:opacity-50"
          title="Dissocier"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        </button>
      )}
    </li>
  )
}
