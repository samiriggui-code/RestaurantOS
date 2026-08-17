'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useFeedbackState } from '@/lib/use-feedback-state'
import { CalendarDays, Clock, Loader2, Plus, Users } from 'lucide-react'
import { getStaffSession } from '@/lib/staff-auth'
import { staffFetch } from '@/lib/staff-api'
import { AdminPageHeader, AdminSectionTabs } from '@/components/admin/AdminSectionTabs'
import { ADMIN_STAT_GRID, AdminStatCard } from '@/components/admin/AdminStatCard'
import { cn } from '@/lib/cn'

type Reservation = {
  id: string
  customerName: string
  customerPhone: string
  guests: number
  dateTime: string
  status: string
  notes: string | null
  table?: { number: string } | null
}

type TableOption = { id: string; number: string }

type ResTab = 'day' | 'new'

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'En attente',
  CONFIRMED: 'Confirmée',
  SEATED: 'Installée',
  CANCELLED: 'Annulée',
  NO_SHOW: 'No-show',
}

const STATUS_TONE: Record<string, string> = {
  PENDING: 'bg-amber-500/15 text-amber-300',
  CONFIRMED: 'bg-blue-500/15 text-blue-300',
  SEATED: 'bg-emerald-500/15 text-emerald-300',
  CANCELLED: 'bg-white/10 text-cream/40',
  NO_SHOW: 'bg-red-500/15 text-red-300',
}

export function AdminReservationsView() {
  const [tab, setTab] = useState<ResTab>('day')
  const [list, setList] = useState<Reservation[]>([])
  const [tables, setTables] = useState<TableOption[]>([])
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const { error, setError } = useFeedbackState()
  const [form, setForm] = useState({
    customerName: '',
    customerPhone: '',
    guests: 2,
    tableId: '',
    dateTime: '',
    notes: '',
  })

  const reload = useCallback(async () => {
    const session = getStaffSession('crm')
    if (!session) return
    setLoading(true)
    try {
      const [reservations, tableList] = await Promise.all([
        staffFetch<Reservation[]>(`/reservations?date=${date}`, { token: session.token, scope: 'crm' }),
        staffFetch<TableOption[]>('/tables', { token: session.token, scope: 'crm' }),
      ])
      setList(reservations)
      setTables(tableList.map((t) => ({ id: t.id, number: t.number })))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setLoading(false)
    }
  }, [date])

  useEffect(() => {
    void reload()
  }, [reload])

  const stats = useMemo(() => {
    const s = { total: list.length, guests: 0, confirmed: 0, pending: 0 }
    for (const r of list) {
      s.guests += r.guests
      if (r.status === 'CONFIRMED' || r.status === 'SEATED') s.confirmed++
      if (r.status === 'PENDING') s.pending++
    }
    return s
  }, [list])

  const sorted = useMemo(
    () => [...list].sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime()),
    [list],
  )

  async function createReservation(e: React.FormEvent) {
    e.preventDefault()
    const session = getStaffSession('crm')
    if (!session) return
    setBusy('create')
    try {
      await staffFetch('/reservations', {
        method: 'POST',
        token: session.token,
        scope: 'crm',
        body: JSON.stringify({
          ...form,
          tableId: form.tableId || undefined,
          dateTime: new Date(form.dateTime).toISOString(),
        }),
      })
      setForm({ customerName: '', customerPhone: '', guests: 2, tableId: '', dateTime: '', notes: '' })
      setTab('day')
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setBusy(null)
    }
  }

  async function patchStatus(id: string, status: string) {
    const session = getStaffSession('crm')
    if (!session) return
    setBusy(id)
    try {
      await staffFetch(`/reservations/${id}/status`, {
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

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <AdminPageHeader
        title="Réservations"
        description="Agenda salle — créneaux, tables assignées et suivi des statuts client."
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <AdminSectionTabs
          tabs={[
            { id: 'day' as const, label: 'Journée', icon: CalendarDays, badge: list.length },
            { id: 'new' as const, label: 'Nouvelle', icon: Plus },
          ]}
          active={tab}
          onChange={setTab}
        />
        {tab === 'day' && (
          <label className="flex items-center gap-2 text-sm text-cream/60">
            <CalendarDays className="h-4 w-4" />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-lg border border-white/15 bg-charcoal px-2 py-1.5"
            />
          </label>
        )}
      </div>

      {error && (
        <p className="rounded-xl border border-red-500/30 bg-red-950/40 px-4 py-2 text-sm text-red-200">{error}</p>
      )}

      {tab === 'day' && (
        <>
          <div className={ADMIN_STAT_GRID}>
            <AdminStatCard label="Réservations" value={stats.total} icon={CalendarDays} />
            <AdminStatCard label="Couverts" value={stats.guests} icon={Users} />
            <AdminStatCard label="Confirmées" value={stats.confirmed} tone="text-emerald-300" />
            <AdminStatCard label="En attente" value={stats.pending} tone="text-amber-300" />
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-tomato-light" />
            </div>
          ) : sorted.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/15 py-16 text-center">
              <CalendarDays className="mx-auto h-10 w-10 text-cream/20" />
              <p className="mt-3 text-cream/50">Aucune réservation ce jour.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sorted.map((r) => {
                const time = new Date(r.dateTime).toLocaleTimeString('fr-FR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })
                return (
                  <article
                    key={r.id}
                    className="flex flex-wrap items-center gap-4 rounded-2xl border border-white/10 bg-[#1A1412] px-4 py-3"
                  >
                    <div className="flex min-w-[4rem] flex-col items-center rounded-xl bg-white/5 px-3 py-2">
                      <Clock className="mb-0.5 h-3.5 w-3.5 text-cream/40" />
                      <span className="font-mono text-sm font-bold text-cream">{time}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-cream">{r.customerName}</p>
                      <p className="text-xs text-cream/45">
                        {r.guests} pers. · {r.customerPhone}
                        {r.table ? ` · Table ${r.table.number}` : ''}
                      </p>
                    </div>
                    <span
                      className={cn(
                        'rounded-full px-2.5 py-0.5 text-[10px] font-semibold',
                        STATUS_TONE[r.status] ?? '',
                      )}
                    >
                      {STATUS_LABEL[r.status] ?? r.status}
                    </span>
                    <select
                      disabled={busy === r.id}
                      value={r.status}
                      onChange={(e) => void patchStatus(r.id, e.target.value)}
                      className="rounded-lg border border-white/15 bg-charcoal px-2 py-1.5 text-xs"
                    >
                      {Object.entries(STATUS_LABEL).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </article>
                )
              })}
            </div>
          )}
        </>
      )}

      {tab === 'new' && (
        <form
          onSubmit={(e) => void createReservation(e)}
          className="rounded-2xl border border-white/10 bg-[#1A1412] p-5 space-y-4"
        >
          <h2 className="font-semibold text-cream">Nouvelle réservation</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm text-cream/60">
              Nom client
              <input
                required
                value={form.customerName}
                onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-white/15 bg-charcoal px-3 py-2"
              />
            </label>
            <label className="block text-sm text-cream/60">
              Téléphone
              <input
                required
                value={form.customerPhone}
                onChange={(e) => setForm((f) => ({ ...f, customerPhone: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-white/15 bg-charcoal px-3 py-2"
              />
            </label>
            <label className="block text-sm text-cream/60">
              Couverts
              <input
                type="number"
                min={1}
                value={form.guests}
                onChange={(e) => setForm((f) => ({ ...f, guests: Number(e.target.value) }))}
                className="mt-1 w-full rounded-xl border border-white/15 bg-charcoal px-3 py-2"
              />
            </label>
            <label className="block text-sm text-cream/60">
              Date & heure
              <input
                required
                type="datetime-local"
                value={form.dateTime}
                onChange={(e) => setForm((f) => ({ ...f, dateTime: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-white/15 bg-charcoal px-3 py-2"
              />
            </label>
            <label className="block text-sm text-cream/60 sm:col-span-2">
              Table (optionnel)
              <select
                value={form.tableId}
                onChange={(e) => setForm((f) => ({ ...f, tableId: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-white/15 bg-charcoal px-3 py-2"
              >
                <option value="">— Non assignée —</option>
                {tables.map((t) => (
                  <option key={t.id} value={t.id}>
                    Table {t.number}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button
            type="submit"
            disabled={busy === 'create'}
            className="rounded-xl bg-tomato px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            Enregistrer la réservation
          </button>
        </form>
      )}
    </div>
  )
}
