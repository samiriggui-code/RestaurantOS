'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useFeedbackState } from '@/lib/use-feedback-state'
import { LayoutGrid, Loader2, Plus, QrCode, Trash2, Users } from 'lucide-react'
import { getStaffSession } from '@/lib/staff-auth'
import { staffFetch } from '@/lib/staff-api'
import { AdminPageHeader, AdminSectionTabs } from '@/components/admin/AdminSectionTabs'
import { ADMIN_STAT_GRID, AdminStatCard } from '@/components/admin/AdminStatCard'
import { cn } from '@/lib/cn'
import { useAdminFeedback } from '@/components/admin/AdminFeedbackProvider'

type TableRow = {
  id: string
  number: string
  capacity: number
  status: string
  qrCode: string | null
}

type TablesTab = 'floor' | 'manage'

const STATUS_LABEL: Record<string, string> = {
  AVAILABLE: 'Libre',
  OCCUPIED: 'Occupée',
  RESERVED: 'Réservée',
  MAINTENANCE: 'Maintenance',
}

const STATUS_TONE: Record<string, string> = {
  AVAILABLE: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  OCCUPIED: 'border-red-500/30 bg-red-500/10 text-red-300',
  RESERVED: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  MAINTENANCE: 'border-white/15 bg-white/5 text-cream/45',
}

export function AdminTablesView() {
  const { confirm, notifySuccess } = useAdminFeedback()
  const [tab, setTab] = useState<TablesTab>('floor')
  const [tables, setTables] = useState<TableRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const { error, setError } = useFeedbackState()
  const [number, setNumber] = useState('')
  const [capacity, setCapacity] = useState(4)
  const [qrPreview, setQrPreview] = useState<TableRow | null>(null)

  const reload = useCallback(async () => {
    const session = getStaffSession('crm')
    if (!session) return
    setLoading(true)
    try {
      const data = await staffFetch<TableRow[]>('/tables', { token: session.token, scope: 'crm' })
      setTables(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const stats = useMemo(() => {
    const counts = { AVAILABLE: 0, OCCUPIED: 0, RESERVED: 0, MAINTENANCE: 0 }
    for (const t of tables) {
      if (t.status in counts) counts[t.status as keyof typeof counts]++
    }
    return counts
  }, [tables])

  async function addTable() {
    if (!number.trim()) return
    const session = getStaffSession('crm')
    if (!session) return
    setBusy('add')
    try {
      await staffFetch('/tables', {
        method: 'POST',
        token: session.token,
        scope: 'crm',
        body: JSON.stringify({ number: number.trim(), capacity }),
      })
      setNumber('')
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setBusy(null)
    }
  }

  async function setStatus(id: string, status: string) {
    const session = getStaffSession('crm')
    if (!session) return
    setBusy(id)
    try {
      await staffFetch(`/tables/${id}/status`, {
        method: 'PATCH',
        token: session.token,
        scope: 'crm',
        body: JSON.stringify({ status }),
      })
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setBusy(null)
    }
  }

  async function removeTable(id: string) {
    const session = getStaffSession('crm')
    if (!session) return
    if (
      !(await confirm({
        title: 'Retirer la table',
        message: 'Retirer cette table de la salle ?',
        confirmLabel: 'Retirer',
        destructive: true,
      }))
    ) {
      return
    }
    setBusy(`del-${id}`)
    try {
      await staffFetch(`/tables/${id}`, {
        method: 'DELETE',
        token: session.token,
        scope: 'crm',
      })
      notifySuccess('Table retirée.')
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setBusy(null)
    }
  }

  async function regenQr(id: string) {
    const session = getStaffSession('crm')
    if (!session) return
    setBusy(`qr-${id}`)
    try {
      const updated = await staffFetch<TableRow>(`/tables/${id}/regenerate-qr`, {
        method: 'POST',
        token: session.token,
        scope: 'crm',
      })
      setQrPreview(updated)
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setBusy(null)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-tomato-light" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <AdminPageHeader
        title="Plan de salle"
        description="QR code → menu avec numéro de table pour commande sur place sans caissier."
      />

      <AdminSectionTabs
        tabs={[
          { id: 'floor' as const, label: 'Plan salle', icon: LayoutGrid, badge: tables.length },
          { id: 'manage' as const, label: 'Gestion', icon: Plus },
        ]}
        active={tab}
        onChange={setTab}
      />

      {error && (
        <p className="rounded-xl border border-red-500/30 bg-red-950/40 px-4 py-2 text-sm text-red-200">{error}</p>
      )}

      <div className={ADMIN_STAT_GRID}>
        <AdminStatCard label="Tables" value={tables.length} icon={LayoutGrid} />
        <AdminStatCard label="Libres" value={stats.AVAILABLE} tone="text-emerald-300" />
        <AdminStatCard label="Occupées" value={stats.OCCUPIED} tone="text-red-300" />
        <AdminStatCard label="Réservées" value={stats.RESERVED} tone="text-amber-300" />
      </div>

      {tab === 'floor' ? (
        tables.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/15 py-16 text-center">
            <LayoutGrid className="mx-auto h-10 w-10 text-cream/20" />
            <p className="mt-3 text-cream/50">Aucune table — ajoutez-en dans l&apos;onglet Gestion.</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {tables.map((t) => (
              <article
                key={t.id}
                className={cn(
                  'rounded-2xl border p-4 transition hover:brightness-110',
                  STATUS_TONE[t.status] ?? STATUS_TONE.AVAILABLE,
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-display text-2xl font-bold">T{t.number}</p>
                    <p className="mt-0.5 flex items-center gap-1 text-xs opacity-80">
                      <Users className="h-3 w-3" />
                      {t.capacity} couverts
                    </p>
                  </div>
                  <span className="rounded-full bg-black/20 px-2 py-0.5 text-[10px] font-semibold uppercase">
                    {STATUS_LABEL[t.status] ?? t.status}
                  </span>
                </div>
                <div className="mt-3 flex gap-2">
                  <select
                    value={t.status}
                    disabled={busy === t.id}
                    onChange={(e) => void setStatus(t.id, e.target.value)}
                    className="flex-1 rounded-lg border border-black/20 bg-black/10 px-2 py-1.5 text-xs"
                  >
                    {Object.entries(STATUS_LABEL).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => (t.qrCode ? setQrPreview(t) : void regenQr(t.id))}
                    className="rounded-lg border border-black/20 bg-black/10 p-1.5 hover:bg-black/20"
                    title="QR menu"
                  >
                    <QrCode className="h-4 w-4" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )
      ) : (
        <section className="rounded-2xl border border-white/10 bg-[#1A1412] p-5 space-y-4">
          <h2 className="font-semibold text-cream">Ajouter une table</h2>
          <div className="flex flex-wrap gap-2">
            <input
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              placeholder="N° (ex. 12)"
              className="w-28 rounded-xl border border-white/15 bg-charcoal px-3 py-2 text-sm"
            />
            <input
              type="number"
              min={1}
              max={20}
              value={capacity}
              onChange={(e) => setCapacity(Number(e.target.value))}
              className="w-20 rounded-xl border border-white/15 bg-charcoal px-3 py-2 text-sm"
            />
            <span className="self-center text-xs text-cream/40">places</span>
            <button
              type="button"
              disabled={busy === 'add'}
              onClick={() => void addTable()}
              className="rounded-xl bg-tomato px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Créer la table
            </button>
          </div>

          <ul className="divide-y divide-white/10 rounded-xl border border-white/10 text-sm">
            {tables.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="text-cream">
                  Table {t.number} · {t.capacity} pl.
                </span>
                <button
                  type="button"
                  onClick={() => void removeTable(t.id)}
                  disabled={busy === `del-${t.id}`}
                  className="text-red-400 hover:text-red-300 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {qrPreview?.qrCode && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setQrPreview(null)}
        >
          <div className="rounded-2xl bg-charcoal p-6 text-center shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <p className="mb-1 font-display text-lg text-cream">Table {qrPreview.number}</p>
            <p className="mb-4 text-xs text-cream/45">Scan → menu avec table pré-remplie</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrPreview.qrCode} alt="QR table" className="mx-auto h-52 w-52 rounded-lg bg-white p-3" />
            <button
              type="button"
              onClick={() => setQrPreview(null)}
              className="mt-4 rounded-lg border border-white/15 px-4 py-2 text-sm text-cream/70 hover:bg-white/5"
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
