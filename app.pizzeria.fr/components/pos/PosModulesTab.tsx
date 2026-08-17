'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/cn'
import { getStaffSession } from '@/lib/staff-auth'
import { staffFetch } from '@/lib/staff-api'

const ROOMS = [
  { id: 'salle', label: 'Salle principale', tables: 8 },
  { id: 'terrasse', label: 'Terrasse', tables: 4 },
] as const

export function PosTablesTab() {
  const [occupied, setOccupied] = useState<Record<string, boolean>>({})

  return (
    <div className="flex h-full flex-col overflow-hidden bg-charcoal text-cream">
      <header className="border-b border-white/10 px-5 py-4">
        <h1 className="font-display text-xl font-bold">Salles &amp; tables</h1>
        <p className="text-xs text-cream/45">Plan simplifié — touchez une table pour changer son statut</p>
      </header>
      <div className="flex-1 space-y-6 overflow-y-auto p-5">
        {ROOMS.map((room) => (
          <section key={room.id}>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-cream/40">{room.label}</h2>
            <div className="grid grid-cols-4 gap-3 sm:grid-cols-6">
              {Array.from({ length: room.tables }, (_, i) => {
                const id = `${room.id}-T${i + 1}`
                const busy = occupied[id]
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setOccupied((o) => ({ ...o, [id]: !o[id] }))}
                    className={cn(
                      'flex aspect-square flex-col items-center justify-center rounded-2xl border-2 text-sm font-bold transition active:scale-95',
                      busy
                        ? 'border-tomato/50 bg-tomato/15 text-tomato-light'
                        : 'border-emerald-500/30 bg-emerald-500/5 text-emerald-300',
                    )}
                  >
                    T{i + 1}
                    <span className="mt-1 text-[10px] font-normal opacity-70">{busy ? 'Occupée' : 'Libre'}</span>
                  </button>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

export function PosReservationsTab() {
  const slots = [
    { time: '19:00', name: 'Martin · 4 pers.', note: 'Anniversaire' },
    { time: '19:30', name: 'Dupont · 2 pers.', note: 'Terrasse si possible' },
  ]
  return (
    <div className="flex h-full flex-col bg-charcoal text-cream">
      <header className="border-b border-white/10 px-5 py-4">
        <h1 className="font-display text-xl font-bold">Réservations</h1>
        <p className="text-xs text-cream/45">Soirée en cours — synchronisation CRM à venir</p>
      </header>
      <ul className="flex-1 space-y-2 overflow-y-auto p-4">
        {slots.map((s) => (
          <li key={s.time} className="rounded-xl border border-white/10 bg-[#141010] px-4 py-3">
            <p className="font-mono text-tomato-light">{s.time}</p>
            <p className="font-medium">{s.name}</p>
            <p className="text-xs text-cream/45">{s.note}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function PosWifiTab() {
  return (
    <div className="flex h-full flex-col bg-charcoal p-6 text-cream">
      <h1 className="font-display text-xl font-bold">WiFi invité</h1>
      <p className="mt-1 text-sm text-cream/45">QR code et stats — configurez dans le CRM → WiFi invité</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {[
          { label: 'Connexions aujourd\'hui', value: '—' },
          { label: 'Temps moyen', value: '—' },
          { label: 'Captifs actifs', value: '—' },
        ].map((c) => (
          <div key={c.label} className="rounded-2xl border border-white/10 bg-[#141010] p-4">
            <p className="text-xs text-cream/40">{c.label}</p>
            <p className="mt-2 font-display text-3xl text-tomato-light">{c.value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export function PosStockTab() {
  const [items, setItems] = useState<
    { id: string; name: string; quantity: number; reorderAt: number | null; unit: string }[]
  >([])
  const [loading, setLoading] = useState(true)

  const load = () => {
    const session = getStaffSession('device')
    if (!session) {
      setLoading(false)
      return
    }
    setLoading(true)
    staffFetch<{ id: string; name: string; quantity: number; reorderAt: number | null; unit: string }[]>(
      '/stock',
      { token: session.token },
    )
      .then((rows) => setItems(rows.filter((r) => r.reorderAt != null)))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    const id = window.setInterval(load, 60_000)
    return () => window.clearInterval(id)
  }, [])

  const rows = useMemo(() => {
    return items.map((item) => {
      const max = item.reorderAt ? item.reorderAt * 2 : item.quantity || 1
      const level = Math.min(100, Math.round((item.quantity / max) * 100))
      const low = item.reorderAt != null && item.quantity <= item.reorderAt
      return { ...item, level, low }
    })
  }, [items])

  return (
    <div className="flex h-full flex-col bg-charcoal p-6 text-cream">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold">Stock live</h1>
          <p className="mt-1 text-sm text-cream/45">
            Alertes rupture — synchronisé CRM ·{' '}
            <Link href="/admin/stock" className="text-tomato-light underline">
              détail complet
            </Link>
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="rounded-lg border border-white/10 p-2 text-cream/50 hover:bg-white/5"
          aria-label="Actualiser"
        >
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
        </button>
      </div>
      {loading && rows.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-tomato" />
        </div>
      ) : rows.length === 0 ? (
        <p className="mt-8 text-center text-sm text-cream/40">Aucune alerte stock — tout est au vert</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {rows.map((r) => (
            <li
              key={r.id}
              className={cn(
                'rounded-xl border px-4 py-3',
                r.low ? 'border-amber-500/30 bg-amber-500/5' : 'border-white/10 bg-[#141010]',
              )}
            >
              <div className="flex justify-between text-sm">
                <span className="flex items-center gap-2">
                  {r.low && <AlertTriangle className="h-4 w-4 text-amber-400" />}
                  {r.name}
                </span>
                <span className="text-cream/50">
                  {r.quantity} {r.unit}
                  {r.reorderAt != null ? ` · seuil ${r.reorderAt}` : ''}
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className={cn('h-full rounded-full', r.low ? 'bg-amber-500' : 'bg-tomato')}
                  style={{ width: `${r.level}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
