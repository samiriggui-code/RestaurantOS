'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ColumnDef,
  PaginationState,
  SortingState,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import {
  BarChart3,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Loader2,
  Timer,
  TrendingUp,
  Users,
} from 'lucide-react'
import { AdminPageHeader, AdminPageShell } from '@/components/admin/AdminSectionTabs'
import { ADMIN_STAT_GRID, AdminStatCard } from '@/components/admin/AdminStatCard'
import {
  AdminDataGridShell,
  DataGridColumnHeader,
  createDefaultPagination,
} from '@/components/ui/data-grid'
import { getStaffSession } from '@/lib/staff-auth'
import { staffFetch, staffFetchText } from '@/lib/staff-api'
import { downloadRawCsv } from '@/lib/export-csv'
import { roleLabel, roleStyle } from '@/lib/staff-display'
import { cn } from '@/lib/cn'

type MonthlyHoursDayEntry = {
  date: string
  clockIn: string
  clockOut: string
  minutes: number
  hoursLabel: string
  source: string
}

type MonthlyHoursRow = {
  userId: string
  name: string
  role: string
  daysWorked: number
  totalMinutes: number
  totalHoursLabel: string
  avgMinutesPerDay: number
  avgHoursLabel: string
  records: number
  days: MonthlyHoursDayEntry[]
}

type MonthlySummary = {
  month: string
  label: string
  from: string
  to: string
  rows: MonthlyHoursRow[]
}

const SOURCE_LABEL: Record<string, string> = {
  KITCHEN: 'KDS',
  POS: 'Caisse',
  ADMIN: 'Admin',
  SELF: 'Auto',
}

function AttendanceDetailPanel({
  row,
  monthLabel,
}: {
  row: MonthlyHoursRow
  monthLabel?: string
}) {
  return (
    <div className="px-4 py-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-cream/45">
            Heures effectuées — pointages KDS
          </p>
          <p className="mt-0.5 text-sm text-cream/70">
            {monthLabel ?? 'Période'} · {row.totalHoursLabel} · {row.days.length} journée
            {row.days.length > 1 ? 's' : ''}
          </p>
        </div>
        <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-0.5 text-[10px] text-cream/45">
          {row.records} pointage{row.records > 1 ? 's' : ''}
        </span>
      </div>
      {row.days.length === 0 ? (
        <p className="rounded-xl border border-dashed border-white/10 px-4 py-6 text-center text-sm text-cream/40">
          Aucun pointage clôturé pour cet employé sur la période.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/10 bg-[#100C0A]">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="bg-white/[0.03] text-[10px] font-semibold uppercase tracking-wider text-cream/40">
              <tr>
                <th className="px-4 py-2.5 font-medium">Date</th>
                <th className="px-4 py-2.5 font-medium">Entrée</th>
                <th className="px-4 py-2.5 font-medium">Sortie</th>
                <th className="px-4 py-2.5 font-medium">Durée</th>
                <th className="px-4 py-2.5 font-medium">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {row.days.map((day) => (
                <tr
                  key={`${row.userId}-${day.date}-${day.clockIn}`}
                  className="text-cream/85 transition-colors hover:bg-white/[0.02]"
                >
                  <td className="px-4 py-2.5 font-medium">{formatDayLabel(day.date)}</td>
                  <td className="px-4 py-2.5 font-mono text-sm text-cream/65">
                    {formatTime(day.clockIn)}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-sm text-cream/65">
                    {formatTime(day.clockOut)}
                  </td>
                  <td className="px-4 py-2.5 font-mono font-semibold text-amber-200/90">
                    {day.hoursLabel}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] text-cream/50">
                      {SOURCE_LABEL[day.source] ?? day.source}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-white/10 bg-white/[0.02] text-sm font-semibold text-cream">
              <tr>
                <td className="px-4 py-2.5" colSpan={3}>
                  Total {row.name}
                </td>
                <td className="px-4 py-2.5 font-mono">{row.totalHoursLabel}</td>
                <td className="px-4 py-2.5 text-cream/45">{row.records} ptg.</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}

function currentMonthKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function shiftMonth(monthKey: string, delta: number): string {
  const [yStr, mStr] = monthKey.split('-')
  const d = new Date(Number(yStr), Number(mStr) - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function formatTotalHours(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h} h ${String(m).padStart(2, '0')}`
}
function formatDayLabel(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

export function AdminMonthlyHoursView() {
  const [month, setMonth] = useState(currentMonthKey)
  const [data, setData] = useState<MonthlySummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [roleFilter, setRoleFilter] = useState('Tous')
  const [globalFilter, setGlobalFilter] = useState('')
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [pagination, setPagination] = useState<PaginationState>(() => createDefaultPagination())
  const [sorting, setSorting] = useState<SortingState>([{ id: 'totalMinutes', desc: true }])

  const load = useCallback(async () => {
    const session = getStaffSession()
    if (!session) return
    setLoading(true)
    setError(null)
    try {
      const res = await staffFetch<MonthlySummary>(
        `/employees/attendance/monthly?month=${encodeURIComponent(month)}`,
        { token: session.token },
      )
      setData(res)
      setSelectedUserId((prev) =>
        prev && res.rows.some((r) => r.userId === prev) ? prev : null,
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur chargement')
    } finally {
      setLoading(false)
    }
  }, [month])

  useEffect(() => {
    void load()
  }, [load])

  const roles = useMemo(() => {
    const set = new Set(data?.rows.map((r) => r.role) ?? [])
    return ['Tous', ...[...set].sort((a, b) => a.localeCompare(b, 'fr'))]
  }, [data])

  const filteredRows = useMemo(() => {
    if (!data) return []
    return roleFilter === 'Tous' ? data.rows : data.rows.filter((r) => r.role === roleFilter)
  }, [data, roleFilter])

  const totalMinutes = useMemo(
    () => filteredRows.reduce((s, r) => s + r.totalMinutes, 0),
    [filteredRows],
  )

  const teamTotalMinutes = useMemo(
    () => data?.rows.reduce((s, r) => s + r.totalMinutes, 0) ?? 0,
    [data],
  )

  const avgPerEmployee = filteredRows.length
    ? Math.round(totalMinutes / filteredRows.length)
    : 0

  const topEmployee = useMemo(() => {
    if (!filteredRows.length) return null
    return [...filteredRows].sort((a, b) => b.totalMinutes - a.totalMinutes)[0]
  }, [filteredRows])

  const byRole = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of filteredRows) {
      map.set(r.role, (map.get(r.role) ?? 0) + r.totalMinutes)
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1])
  }, [filteredRows])

  const maxEmployeeMinutes = filteredRows[0]
    ? Math.max(...filteredRows.map((r) => r.totalMinutes))
    : 1

  const renderSubRow = useCallback(
    (row: MonthlyHoursRow) => (
      <AttendanceDetailPanel row={row} monthLabel={data?.label} />
    ),
    [data?.label],
  )

  async function exportCsv() {
    const session = getStaffSession()
    if (!session) return
    const csv = await staffFetchText(
      `/employees/attendance/monthly/export?month=${encodeURIComponent(month)}`,
      { token: session.token },
    )
    downloadRawCsv(`heures-${month}.csv`, csv)
  }

  const columns = useMemo<ColumnDef<MonthlyHoursRow>[]>(
    () => [
      {
        accessorKey: 'name',
        header: ({ column }) => <DataGridColumnHeader title="Employé" column={column} />,
        cell: ({ row }) => (
          <div className="min-w-[140px]">
            <p className="font-medium text-cream">{row.original.name}</p>
            <p className="mt-0.5 text-xs text-cream/35">
              {row.original.daysWorked} jour{row.original.daysWorked > 1 ? 's' : ''} travaillé
              {row.original.daysWorked > 1 ? 's' : ''}
            </p>
          </div>
        ),
      },
      {
        accessorKey: 'role',
        header: ({ column }) => <DataGridColumnHeader title="Rôle" column={column} />,
        cell: ({ row }) => {
          const rs = roleStyle(row.original.role)
          return (
            <span
              className={cn(
                'inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset',
                rs.badge,
              )}
            >
              {roleLabel(row.original.role)}
            </span>
          )
        },
      },
      {
        accessorKey: 'daysWorked',
        header: ({ column }) => <DataGridColumnHeader title="Jours" column={column} />,
        cell: ({ row }) => (
          <span className="tabular-nums text-cream/80">{row.original.daysWorked}</span>
        ),
      },
      {
        accessorKey: 'avgMinutesPerDay',
        header: ({ column }) => <DataGridColumnHeader title="Moy. / jour" column={column} />,
        cell: ({ row }) => (
          <span className="font-mono text-sm text-cream/70">{row.original.avgHoursLabel}</span>
        ),
      },
      {
        accessorKey: 'totalMinutes',
        header: ({ column }) => <DataGridColumnHeader title="Total mois" column={column} />,
        cell: ({ row }) => {
          const pct = teamTotalMinutes
            ? Math.round((row.original.totalMinutes / teamTotalMinutes) * 100)
            : 0
          const bar = Math.round((row.original.totalMinutes / maxEmployeeMinutes) * 100)
          return (
            <div className="min-w-[120px]">
              <p className="font-mono font-semibold text-cream">{row.original.totalHoursLabel}</p>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-tomato/90 to-amber-400/70"
                  style={{ width: `${bar}%` }}
                />
              </div>
              <p className="mt-1 text-[10px] text-cream/35">{pct} % de l&apos;équipe</p>
            </div>
          )
        },
      },
      {
        accessorKey: 'records',
        header: ({ column }) => <DataGridColumnHeader title="Pointages" column={column} />,
        cell: ({ row }) => (
          <span className="tabular-nums text-cream/55">{row.original.records}</span>
        ),
      },
      {
        id: 'detail',
        header: () => <span className="sr-only">Détail</span>,
        enableSorting: false,
        cell: ({ row }) => {
          const open = selectedUserId === row.original.userId
          return (
            <button
              type="button"
              title="Voir entrées / sorties et heures jour par jour"
              onClick={() =>
                setSelectedUserId((id) => (id === row.original.userId ? null : row.original.userId))
              }
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition',
                open
                  ? 'border-tomato/40 bg-tomato/15 text-tomato-light'
                  : 'border-white/10 text-cream/50 hover:border-white/20 hover:text-cream/80',
              )}
            >
              <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
              Détail
            </button>
          )
        },
      },
    ],
    [maxEmployeeMinutes, selectedUserId, teamTotalMinutes],
  )

  const table = useReactTable({
    data: filteredRows,
    columns,
    state: { pagination, sorting, globalFilter },
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: 'includesString',
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getRowId: (row) => row.userId,
  })

  if (loading && !data) {
    return (
      <AdminPageShell maxWidth="7xl">
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-tomato-light" />
        </div>
      </AdminPageShell>
    )
  }

  return (
    <AdminPageShell maxWidth="7xl">
      <AdminPageHeader
        title="Heures mensuelles"
        description="Synthèse des pointages KDS clôturés — export comptable, BS et contrôle paie."
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!data?.rows.length}
              onClick={() => void exportCsv()}
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-sm text-cream hover:bg-white/5 disabled:opacity-40"
            >
              <Download className="h-4 w-4" />
              Export CSV comptable
            </button>
          </div>
        }
      />

      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-end gap-2">
          <button
            type="button"
            onClick={() => setMonth((m) => shiftMonth(m, -1))}
            className="rounded-xl border border-white/15 p-2.5 text-cream/70 hover:bg-white/5 hover:text-cream"
            aria-label="Mois précédent"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <label className="text-sm text-cream/60">
            Période
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="mt-1 block rounded-xl border border-white/15 bg-white/[0.03] px-3 py-2 text-sm text-cream outline-none focus:border-tomato/40"
            />
          </label>
          <button
            type="button"
            onClick={() => setMonth((m) => shiftMonth(m, 1))}
            disabled={month >= currentMonthKey()}
            className="rounded-xl border border-white/15 p-2.5 text-cream/70 hover:bg-white/5 hover:text-cream disabled:opacity-30"
            aria-label="Mois suivant"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <p className="text-xs text-cream/40">
          {data?.label ?? '—'} · {data?.from ?? '—'} → {data?.to ?? '—'} · fuseau Europe/Paris
        </p>
      </div>

      {error && (
        <p className="mb-4 rounded-xl border border-red-500/30 bg-red-950/40 px-4 py-2 text-sm text-red-200">
          {error}
        </p>
      )}

      <div className={ADMIN_STAT_GRID}>
        <AdminStatCard
          label={data?.label ?? 'Mois'}
          value={`${filteredRows.length} employé(s)`}
          sub={`${data?.rows.reduce((s, r) => s + r.records, 0) ?? 0} pointages clôturés`}
          icon={Calendar}
        />
        <AdminStatCard
          label="Total heures"
          value={formatTotalHours(totalMinutes)}
          sub={roleFilter !== 'Tous' ? `Filtre : ${roleLabel(roleFilter)}` : 'Équipe complète'}
          icon={Clock}
          tone="text-amber-200"
        />
        <AdminStatCard
          label="Moyenne / employé"
          value={formatTotalHours(avgPerEmployee)}
          icon={Timer}
        />
        <AdminStatCard
          label="Plus actif"
          value={topEmployee?.name ?? '—'}
          sub={topEmployee ? topEmployee.totalHoursLabel : 'Aucun pointage'}
          icon={TrendingUp}
          tone="text-emerald-200"
        />
      </div>

      {filteredRows.length > 0 && (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <section className="rounded-2xl border border-white/10 bg-[#1A1412] p-5">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-cream">
              <BarChart3 className="h-4 w-4 text-tomato-light" />
              Répartition par employé
            </h2>
            <div className="space-y-3">
              {[...filteredRows]
                .sort((a, b) => b.totalMinutes - a.totalMinutes)
                .slice(0, 8)
                .map((row) => {
                  const pct = Math.round((row.totalMinutes / maxEmployeeMinutes) * 100)
                  return (
                    <div key={row.userId}>
                      <div className="mb-1 flex justify-between text-xs">
                        <span className="font-medium text-cream/85">{row.name}</span>
                        <span className="font-mono tabular-nums text-cream/55">
                          {row.totalHoursLabel}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-red-700/80 to-orange-400/70"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-[#1A1412] p-5">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-cream">
              <Users className="h-4 w-4 text-sky-300" />
              Par rôle
            </h2>
            <div className="space-y-3">
              {byRole.map(([role, minutes]) => {
                const pct = totalMinutes ? Math.round((minutes / totalMinutes) * 100) : 0
                const rs = roleStyle(role)
                return (
                  <div key={role}>
                    <div className="mb-1 flex justify-between text-xs">
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 font-medium ring-1 ring-inset',
                          rs.badge,
                        )}
                      >
                        {roleLabel(role)}
                      </span>
                      <span className="font-mono tabular-nums text-cream/55">
                        {formatTotalHours(minutes)} · {pct} %
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-sky-600/70 to-indigo-400/60"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        </div>
      )}

      <div className="mt-6">
        <AdminDataGridShell
          title="Synthèse employés"
          subtitle="Cliquez Détail pour les heures jour par jour (entrée / sortie KDS)"
          table={table}
          recordCount={table.getFilteredRowModel().rows.length}
          isLoading={loading}
          search={globalFilter}
          onSearchChange={setGlobalFilter}
          searchPlaceholder="Rechercher un employé…"
          expandedRowId={selectedUserId}
          renderSubRow={renderSubRow}
          emptyMessage={
            data?.rows.length
              ? 'Aucun résultat pour ce filtre'
              : 'Aucun pointage clôturé ce mois — vérifiez les entrées / sorties sur le KDS.'
          }
          headerExtra={
            <select
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value)
                setPagination((p) => ({ ...p, pageIndex: 0 }))
                setSelectedUserId(null)
              }}
              className="rounded-xl border border-white/15 bg-white/[0.03] px-3 py-2 text-sm text-cream outline-none focus:border-tomato/40"
            >
              {roles.map((role) => (
                <option key={role} value={role}>
                  {role === 'Tous' ? 'Tous les rôles' : roleLabel(role)}
                </option>
              ))}
            </select>
          }
        />
      </div>

      <p className={cn('mt-5 text-xs leading-relaxed text-cream/40')}>
        Les heures proviennent des pointages KDS clôturés (sortie enregistrée). Exportez le CSV pour votre
        comptable ou liasse sociale (BS). Les durées sont calculées en fuseau Europe/Paris.
      </p>
    </AdminPageShell>
  )
}
