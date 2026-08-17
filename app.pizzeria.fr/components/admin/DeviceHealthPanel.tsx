'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Printer,
  Radio,
  Server,
  WifiOff,
  XCircle,
} from 'lucide-react'
import { getApiBase } from '@/lib/api-base'
import { getBoundDeviceId } from '@/lib/device-binding'
import { type PairedDevice } from '@/lib/device-onboarding'
import {
  fetchDeviceOnlineStatus,
  runRemoteDeviceDiagnostic,
} from '@/lib/device-remote-diagnostics'
import { getStaffSession } from '@/lib/staff-auth'
import {
  testApiPing,
  testPrintKitchenTicket,
  testPrintReceipt,
  testSocketConnection,
  testStaffApi,
} from '@/lib/device-diagnostics'
import { isSunmiPrinterAvailable } from '@/lib/print/sunmi-printer'
import { isEpsonBridgeAvailable } from '@/lib/print/epson-lan-print'
import { cn } from '@/lib/cn'

type CheckId = 'ping' | 'api' | 'socket' | 'printKitchen' | 'printReceipt'
type CheckState = 'idle' | 'running' | 'ok' | 'fail' | 'warn'

type CheckDef = {
  id: CheckId
  label: string
  desc: string
  icon: typeof Server
  posOnly?: boolean
}

const CHECKS: CheckDef[] = [
  { id: 'ping', label: 'Ping serveur', desc: 'Latence API / santé', icon: Activity },
  { id: 'api', label: 'Auth & catalogue', desc: 'JWT staff + menu POS', icon: Server, posOnly: true },
  { id: 'socket', label: 'Temps réel', desc: 'Socket.io boutique', icon: Radio },
  {
    id: 'printKitchen',
    label: 'Ticket cuisine',
    desc: 'Impression test (SUNMI / Epson)',
    icon: Printer,
  },
  {
    id: 'printReceipt',
    label: 'Reçu client',
    desc: 'Ticket caisse 80 mm',
    icon: Printer,
    posOnly: true,
  },
]

const METHOD_LABELS: Record<string, string> = {
  sunmi: 'SUNMI intégrée',
  'epson-kitchen': 'Epson cuisine',
  'epson-counter': 'Epson comptoir',
  'epson-lan': 'Epson réseau (serveur)',
  browser: 'Aperçu navigateur (non valide ici)',
  terminal: 'Terminal jumelé',
}

function StatusDot({ state }: { state: CheckState }) {
  if (state === 'running') return <Loader2 className="h-4 w-4 animate-spin text-cream/50" />
  if (state === 'ok') return <CheckCircle2 className="h-4 w-4 text-emerald-400" />
  if (state === 'warn') return <AlertTriangle className="h-4 w-4 text-amber-400" />
  if (state === 'fail') return <XCircle className="h-4 w-4 text-red-400" />
  return <span className="h-2 w-2 rounded-full bg-white/20" />
}

function formatPrintMeta(method?: string, detail?: string, message?: string): string {
  const parts: string[] = []
  if (method && METHOD_LABELS[method]) parts.push(METHOD_LABELS[method])
  else if (method) parts.push(method)
  if (detail) parts.push(detail)
  if (message) parts.push(message)
  return parts.join(' · ')
}

function isRunningOnPairedTerminal(pairedDevice: PairedDevice | null | undefined): boolean {
  if (!pairedDevice) return false
  const boundId = getBoundDeviceId()
  if (boundId !== pairedDevice.id) return false
  return isSunmiPrinterAvailable() || isEpsonBridgeAvailable()
}

export function DeviceHealthPanel({
  variant,
  pairedDevice,
}: {
  variant: 'pos' | 'kitchen'
  pairedDevice?: PairedDevice | null
}) {
  const isPos = variant === 'pos'
  const visible = CHECKS.filter((c) => !c.posOnly || isPos)
  const onTerminal = isRunningOnPairedTerminal(pairedDevice)

  const [states, setStates] = useState<Record<CheckId, CheckState>>({
    ping: 'idle',
    api: 'idle',
    socket: 'idle',
    printKitchen: 'idle',
    printReceipt: 'idle',
  })
  const [meta, setMeta] = useState<Partial<Record<CheckId, string>>>({})
  const [runningAll, setRunningAll] = useState(false)
  const [terminalOnline, setTerminalOnline] = useState<boolean | null>(null)

  useEffect(() => {
    const session = getStaffSession('crm')
    if (!session || !pairedDevice) {
      setTerminalOnline(null)
      return
    }
    void fetchDeviceOnlineStatus(session.token, pairedDevice.id)
      .then((s) => setTerminalOnline(s.online))
      .catch(() => setTerminalOnline(null))
  }, [pairedDevice?.id])

  const runPrintTest = useCallback(
    async (id: 'printKitchen' | 'printReceipt', session: { token: string }): Promise<boolean> => {
      if (onTerminal) {
        const r =
          id === 'printKitchen'
            ? await testPrintKitchenTicket({ allowBrowser: false })
            : await testPrintReceipt({ allowBrowser: false })
        const label = formatPrintMeta(r.method, undefined, r.ok ? 'Vérifiez le ticket sorti' : r.error)
        setMeta((m) => ({ ...m, [id]: label }))
        const state: CheckState = r.ok ? 'ok' : 'fail'
        setStates((s) => ({ ...s, [id]: state }))
        return r.ok
      }

      if (!pairedDevice) {
        setMeta((m) => ({ ...m, [id]: 'Jumelez un terminal pour ce slot' }))
        setStates((s) => ({ ...s, [id]: 'fail' }))
        return false
      }

      const remote = await runRemoteDeviceDiagnostic(session.token, pairedDevice.id, id)
      const methodKey = remote.method ?? remote.source
      const label = formatPrintMeta(
        methodKey,
        remote.detail,
        remote.message ?? remote.error,
      )
      setMeta((m) => ({ ...m, [id]: label }))
      if (remote.ok) {
        setStates((s) => ({ ...s, [id]: 'ok' }))
        setTerminalOnline(true)
        return true
      }
      setStates((s) => ({ ...s, [id]: remote.offline ? 'warn' : 'fail' }))
      if (remote.offline) setTerminalOnline(false)
      return false
    },
    [onTerminal, pairedDevice],
  )

  const runOne = useCallback(
    async (id: CheckId): Promise<boolean> => {
      const session = getStaffSession('crm')
      setStates((s) => ({ ...s, [id]: 'running' }))
      setMeta((m) => ({ ...m, [id]: undefined }))

      try {
        if (id === 'ping') {
          const r = await testApiPing()
          setMeta((m) => ({ ...m, ping: r.ok ? `${r.ms} ms` : 'Hors ligne' }))
          setStates((s) => ({ ...s, ping: r.ok ? 'ok' : 'fail' }))
          return r.ok
        }
        if (!session) {
          setMeta((m) => ({ ...m, [id]: 'Session CRM requise' }))
          setStates((s) => ({ ...s, [id]: 'fail' }))
          return false
        }
        if (id === 'api') {
          const ok = await testStaffApi(session.token)
          setStates((s) => ({ ...s, api: ok ? 'ok' : 'fail' }))
          return ok
        }
        if (id === 'socket') {
          const ok = await testSocketConnection(session.token, session.businessId)
          setStates((s) => ({ ...s, socket: ok ? 'ok' : 'fail' }))
          return ok
        }
        if (id === 'printKitchen' || id === 'printReceipt') {
          return runPrintTest(id, session)
        }
      } catch {
        setStates((s) => ({ ...s, [id]: 'fail' }))
        return false
      }
      return false
    },
    [runPrintTest],
  )

  async function runAll() {
    setRunningAll(true)
    for (const check of visible) {
      await runOne(check.id)
    }
    setRunningAll(false)
  }

  const okCount = visible.filter((c) => states[c.id] === 'ok').length
  const failCount = visible.filter((c) => states[c.id] === 'fail' || states[c.id] === 'warn').length

  return (
    <div className="space-y-4">
      {pairedDevice && !onTerminal && (
        <div
          className={cn(
            'rounded-xl border px-4 py-3 text-xs',
            terminalOnline === true
              ? 'border-emerald-500/25 bg-emerald-500/5 text-emerald-200/90'
              : terminalOnline === false
                ? 'border-amber-500/25 bg-amber-500/5 text-amber-200/90'
                : 'border-white/10 bg-white/[0.02] text-cream/50',
          )}
        >
          {terminalOnline === true ? (
            <p>
              <strong className="text-cream">{pairedDevice.label}</strong> connecté — les tests
              d&apos;impression sont envoyés au terminal (vérifiez le ticket qui sort).
            </p>
          ) : terminalOnline === false ? (
            <p>
              <strong className="text-cream">{pairedDevice.label}</strong> hors ligne — ouvrez
              l&apos;app POS/KDS sur le SUNMI, ou configurez une imprimante Epson LAN.
            </p>
          ) : (
            <p>Vérification de la connexion du terminal…</p>
          )}
        </div>
      )}

      {onTerminal && (
        <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-4 py-3 text-xs text-emerald-200/90">
          Tests exécutés sur ce terminal — vérifiez le ticket ou le bip sorti.
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3">
        <div>
          <p className="text-sm font-medium text-cream">Diagnostic boutique</p>
          <p className="text-xs text-cream/45">
            {getApiBase()} · {okCount} OK · {failCount > 0 ? `${failCount} échec(s)` : '—'}
          </p>
        </div>
        <button
          type="button"
          disabled={runningAll}
          onClick={() => void runAll()}
          className="inline-flex items-center gap-2 rounded-xl bg-tomato px-4 py-2 text-sm font-semibold text-white hover:bg-tomato-light disabled:opacity-50"
        >
          {runningAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />}
          Tout tester
        </button>
      </div>

      <ul className="space-y-2">
        {visible.map((check) => {
          const Icon = check.icon
          const state = states[check.id]
          return (
            <li
              key={check.id}
              className={cn(
                'flex items-center gap-3 rounded-xl border px-4 py-3',
                state === 'ok'
                  ? 'border-emerald-500/25 bg-emerald-500/5'
                  : state === 'warn'
                    ? 'border-amber-500/25 bg-amber-500/5'
                    : state === 'fail'
                      ? 'border-red-500/25 bg-red-500/5'
                      : 'border-white/10 bg-white/[0.02]',
              )}
            >
              <Icon className="h-5 w-5 shrink-0 text-cream/50" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-cream">{check.label}</p>
                <p className="text-xs text-cream/45">
                  {check.desc}
                  {meta[check.id] ? ` · ${meta[check.id]}` : ''}
                </p>
              </div>
              <StatusDot state={state} />
              <button
                type="button"
                disabled={state === 'running' || runningAll}
                onClick={() => void runOne(check.id)}
                className="rounded-lg border border-white/10 px-2.5 py-1 text-xs hover:bg-white/5 disabled:opacity-40"
              >
                Test
              </button>
            </li>
          )
        })}
      </ul>

      {failCount > 0 && (
        <p className="flex items-start gap-2 text-xs text-amber-200/90">
          <WifiOff className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Un test échoué ? Vérifiez le Wi‑Fi boutique, l&apos;IP WAN (onglet Réseau), que le terminal
          est jumelé et que l&apos;app POS/KDS est ouverte sur le SUNMI.
        </p>
      )}
    </div>
  )
}
