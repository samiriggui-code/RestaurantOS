'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ChefHat,
  Loader2,
  MonitorSmartphone,
  RefreshCw,
  Store,
  Tablet,
  Truck,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import {
  fetchDeviceFleet,
  fleetOpenHref,
  type FleetSurfaceStatus,
} from '@/lib/device-fleet'
import { getStaffSession } from '@/lib/staff-auth'
import { cn } from '@/lib/cn'

const ICONS: Record<string, LucideIcon> = {
  'pos-sunmi': Store,
  'pos-tablet': Tablet,
  kds: ChefHat,
  livreur: Truck,
  kiosk: MonitorSmartphone,
}

function statusTone(status: FleetSurfaceStatus['status']) {
  switch (status) {
    case 'online':
      return {
        pill: 'bg-emerald-500/20 text-emerald-300',
        border: 'border-emerald-500/30 bg-emerald-500/5',
        label: 'En ligne',
      }
    case 'idle':
      return {
        pill: 'bg-amber-500/20 text-amber-200',
        border: 'border-amber-500/25 bg-amber-500/5',
        label: 'Récent',
      }
    case 'unpaired':
      return {
        pill: 'bg-white/10 text-cream/50',
        border: 'border-white/10 bg-black/20',
        label: 'Non jumelé',
      }
    case 'offline':
      return {
        pill: 'bg-red-500/15 text-red-300',
        border: 'border-red-500/20 bg-red-500/5',
        label: 'Hors ligne',
      }
    default: {
      const _exhaustive: never = status
      return _exhaustive
    }
  }
}

function formatSeen(iso: string | null) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function DeviceFleetOverview({
  compact = false,
  pollMs = 15_000,
  showManageLink = true,
}: {
  compact?: boolean
  pollMs?: number
  showManageLink?: boolean
}) {
  const [surfaces, setSurfaces] = useState<FleetSurfaceStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [at, setAt] = useState<string | null>(null)

  const load = useCallback(async () => {
    const session = getStaffSession('crm')
    if (!session) return
    try {
      const data = await fetchDeviceFleet(session.token)
      setSurfaces(data.surfaces)
      setAt(data.at)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Parc indisponible')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    if (pollMs <= 0) return
    const id = window.setInterval(() => void load(), pollMs)
    return () => window.clearInterval(id)
  }, [load, pollMs])

  return (
    <section className={cn('space-y-3', compact && 'space-y-2')}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2
            className={cn(
              'font-semibold text-cream',
              compact ? 'text-sm uppercase tracking-wider text-cream/50' : 'font-display text-lg',
            )}
          >
            Parc périphériques
          </h2>
          {!compact && (
            <p className="text-xs text-cream/45">
              Vue gérant — POS, KDS, livreur et totem (rafraîchi automatiquement)
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {at && (
            <span className="text-[11px] text-cream/35">
              {new Date(at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-lg border border-white/10 p-1.5 text-cream/50 hover:bg-white/5 hover:text-cream"
            aria-label="Actualiser le parc"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          </button>
          {showManageLink ? (
            <Link
              href="/admin/devices"
              className="text-xs font-medium text-tomato-light hover:underline"
            >
              Gérer →
            </Link>
          ) : null}
        </div>
      </div>

      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-950/40 px-3 py-2 text-xs text-red-200">
          {error}
        </p>
      )}

      {loading && surfaces.length === 0 ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-6 w-6 animate-spin text-tomato-light" />
        </div>
      ) : (
        <div
          className={cn(
            'grid gap-3',
            compact ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5' : 'sm:grid-cols-2 lg:grid-cols-5',
          )}
        >
          {surfaces.map((s) => {
            const Icon = ICONS[s.id] ?? MonitorSmartphone
            const tone = statusTone(s.status)
            const seen = formatSeen(s.lastSeenAt)
            return (
              <div
                key={s.id}
                className={cn('rounded-2xl border p-3', tone.border)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-black/20">
                      <Icon className="h-4 w-4 text-cream/80" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-cream">{s.label}</p>
                      <p className="truncate text-[11px] text-cream/45">{s.detail}</p>
                    </div>
                  </div>
                  <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold', tone.pill)}>
                    {tone.label}
                  </span>
                </div>
                {seen && (
                  <p className="mt-2 text-[10px] text-cream/35">Vu {seen}</p>
                )}
                <a
                  href={fleetOpenHref(s.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block text-[11px] font-medium text-cream/60 hover:text-tomato-light"
                >
                  Ouvrir →
                </a>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
