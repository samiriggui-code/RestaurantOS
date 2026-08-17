'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useFeedbackState } from '@/lib/use-feedback-state'
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
  Calendar,
  Download,
  Edit2,
  Loader2,
  Plus,
  Receipt,
  Trash2,
  TrendingDown,
  Wallet,
  X,
} from 'lucide-react'
import { AdminStatCard, ADMIN_STAT_GRID } from '@/components/admin/AdminStatCard'
import { AdminPageHeader, AdminPageShell } from '@/components/admin/AdminSectionTabs'
import {
  AdminDataGridShell,
  DataGridColumnHeader,
  createDefaultPagination,
} from '@/components/ui/data-grid'
import { centsToEuros, eurosToCents, formatEUR } from '@/lib/money'
import { getStaffSession } from '@/lib/staff-auth'
import { staffFetch } from '@/lib/staff-api'
import { cn } from '@/lib/cn'
import { useAdminRefresh } from '@/components/admin/AdminLiveProvider'
import { useAdminFeedback } from '@/components/admin/AdminFeedbackProvider'
import { downloadCsv } from '@/lib/export-csv'

type Expense = {
  id: string
  description: string
  amount: number
  category: string
  date: string
  notes?: string | null
  createdAt: string
}

const CATEGORIES = [
  'Toutes',
  'Matières premières',
  'Boissons',
  'Emballage',
  'Énergie',
  'Personnel',
  'Maintenance',
  'Marketing',
  'Assurances',
  'Hygiène',
  'Fournitures',
  'Divers',
] as const

const CATEGORY_TONE: Record<string, string> = {
  'Matières premières': 'bg-amber-500/15 text-amber-200 border-amber-500/20',
  Boissons: 'bg-sky-500/15 text-sky-200 border-sky-500/20',
  Emballage: 'bg-violet-500/15 text-violet-200 border-violet-500/20',
  Énergie: 'bg-orange-500/15 text-orange-200 border-orange-500/20',
  Personnel: 'bg-rose-500/15 text-rose-200 border-rose-500/20',
  Maintenance: 'bg-slate-500/15 text-slate-200 border-slate-500/20',
  Marketing: 'bg-pink-500/15 text-pink-200 border-pink-500/20',
  Assurances: 'bg-indigo-500/15 text-indigo-200 border-indigo-500/20',
  Hygiène: 'bg-teal-500/15 text-teal-200 border-teal-500/20',
  Fournitures: 'bg-cyan-500/15 text-cyan-200 border-cyan-500/20',
  Divers: 'bg-white/10 text-cream/60 border-white/10',
}

const fieldClass =
  'mt-1 w-full rounded-xl border border-white/15 bg-white/[0.03] px-3 py-2 text-sm text-cream outline-none focus:border-tomato/40'

function isThisMonth(d: string) {
  const date = new Date(d)
  const now = new Date()
  return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
}

export function AdminExpensesView() {
  const { confirm, notifySuccess, notifyError } = useAdminFeedback()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Expense | null>(null)
  const { error, setError } = useFeedbackState()
  const [filter, setFilter] = useState<string>('Toutes')
  const [globalFilter, setGlobalFilter] = useState('')
  const [pagination, setPagination] = useState<PaginationState>(() => createDefaultPagination())
  const [sorting, setSorting] = useState<SortingState>([{ id: 'date', desc: true }])
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const load = useCallback(() => {
    const session = getStaffSession()
    if (!session) return
    setLoading(true)
    const params = new URLSearchParams()
    if (dateFrom) params.set('from', new Date(dateFrom).toISOString())
    if (dateTo) params.set('to', new Date(`${dateTo}T23:59:59`).toISOString())
    const qs = params.toString()
    staffFetch<Expense[]>(`/expenses${qs ? `?${qs}` : ''}`, { token: session.token })
      .then(setExpenses)
      .catch((err) => setError(err instanceof Error ? err.message : 'Erreur'))
      .finally(() => setLoading(false))
  }, [dateFrom, dateTo])

  useEffect(() => {
    load()
  }, [load])

  useAdminRefresh('expenses', load)

  const filtered = useMemo(
    () => (filter === 'Toutes' ? expenses : expenses.filter((e) => e.category === filter)),
    [expenses, filter]
  )

  const totalAll = expenses.reduce((s, e) => s + e.amount, 0)
  const monthExpenses = expenses.filter((e) => isThisMonth(e.date || e.createdAt))
  const totalMonth = monthExpenses.reduce((s, e) => s + e.amount, 0)

  const byCategory = useMemo(() => {
    const map = new Map<string, number>()
    for (const e of monthExpenses) {
      map.set(e.category, (map.get(e.category) ?? 0) + e.amount)
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1])
  }, [monthExpenses])

  const maxCategory = byCategory[0]?.[1] ?? 1
  const avgExpense = expenses.length > 0 ? Math.round(totalAll / expenses.length) : 0

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const session = getStaffSession()
    if (!session) return
    const form = new FormData(e.currentTarget)
    const dateStr = form.get('date') as string
    const data = {
      description: form.get('description'),
      amount: eurosToCents(parseFloat(form.get('amount') as string) || 0),
      category: form.get('category'),
      notes: form.get('notes') || null,
      date: dateStr ? new Date(dateStr).toISOString() : new Date().toISOString(),
    }
    try {
      if (editing) {
        await staffFetch(`/expenses/${editing.id}`, {
          method: 'PUT',
          token: session.token,
          body: JSON.stringify(data),
        })
      } else {
        await staffFetch('/expenses', {
          method: 'POST',
          token: session.token,
          body: JSON.stringify(data),
        })
      }
      setShowModal(false)
      setEditing(null)
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enregistrement impossible')
    }
  }

  async function handleDelete(id: string) {
    if (
      !(await confirm({
        title: 'Supprimer la dépense',
        message: 'Supprimer cette dépense ? Cette action est définitive.',
        confirmLabel: 'Supprimer',
        destructive: true,
      }))
    ) {
      return
    }
    const session = getStaffSession()
    if (!session) return
    try {
      await staffFetch(`/expenses/${id}`, { method: 'DELETE', token: session.token })
      notifySuccess('Dépense supprimée.')
      load()
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Suppression impossible')
    }
  }

  function exportExpenses() {
    downloadCsv(
      `depenses-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Date', 'Description', 'Catégorie', 'Montant EUR', 'Notes'],
      filtered.map((e) => [
        new Date(e.date || e.createdAt).toLocaleDateString('fr-FR'),
        e.description,
        e.category,
        (e.amount / 100).toFixed(2),
        e.notes?.startsWith('[demo]') ? '' : (e.notes ?? ''),
      ]),
    )
  }

  const columns = useMemo<ColumnDef<Expense>[]>(
    () => [
      {
        id: 'date',
        accessorFn: (row) => new Date(row.date || row.createdAt).getTime(),
        header: ({ column }) => <DataGridColumnHeader title="Date" column={column} />,
        cell: ({ row }) =>
          new Date(row.original.date || row.original.createdAt).toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          }),
      },
      {
        accessorKey: 'description',
        header: ({ column }) => <DataGridColumnHeader title="Description" column={column} />,
        cell: ({ row }) => (
          <div className="min-w-[160px]">
            <p className="font-medium text-cream">{row.original.description}</p>
            {row.original.notes && !row.original.notes.startsWith('[demo]') && (
              <p className="mt-0.5 text-xs text-cream/35">{row.original.notes}</p>
            )}
          </div>
        ),
      },
      {
        accessorKey: 'category',
        header: ({ column }) => <DataGridColumnHeader title="Catégorie" column={column} />,
        cell: ({ row }) => {
          const tone = CATEGORY_TONE[row.original.category] ?? CATEGORY_TONE.Divers
          return (
            <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-medium', tone)}>
              {row.original.category}
            </span>
          )
        },
      },
      {
        accessorKey: 'amount',
        header: ({ column }) => <DataGridColumnHeader title="Montant" column={column} />,
        cell: ({ row }) => (
          <span className="font-bold tabular-nums text-red-300">−{formatEUR(row.original.amount)}</span>
        ),
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">Actions</span>,
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex justify-end gap-1">
            <button
              type="button"
              onClick={() => {
                setEditing(row.original)
                setShowModal(true)
              }}
              className="rounded-lg p-2 hover:bg-white/5"
            >
              <Edit2 className="h-4 w-4 text-cream/60" />
            </button>
            <button
              type="button"
              onClick={() => void handleDelete(row.original.id)}
              className="rounded-lg p-2 hover:bg-red-500/10"
            >
              <Trash2 className="h-4 w-4 text-red-400" />
            </button>
          </div>
        ),
      },
    ],
    []
  )

  const table = useReactTable({
    data: filtered,
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
    getRowId: (row) => row.id,
  })

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-tomato-light" />
      </div>
    )
  }

  return (
    <AdminPageShell maxWidth="7xl">
      <AdminPageHeader
        title="Dépenses"
        description="Charges pizzeria — matières, énergie, personnel, marketing. Export comptable CSV."
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={exportExpenses}
              disabled={filtered.length === 0}
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-sm text-cream hover:bg-white/5 disabled:opacity-40"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(null)
                setShowModal(true)
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-tomato px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-tomato/20 hover:bg-tomato-dark"
            >
              <Plus className="h-4 w-4" />
              Nouvelle dépense
            </button>
          </div>
        }
      />

      {error && (
        <p className="rounded-xl border border-red-500/30 bg-red-950/40 px-4 py-2 text-sm text-red-200">
          {error}
        </p>
      )}

      <div className={ADMIN_STAT_GRID}>
        <AdminStatCard
          label="Ce mois-ci"
          value={formatEUR(totalMonth)}
          icon={Calendar}
          tone="text-red-300"
        />
        <AdminStatCard label="Total enregistré" value={formatEUR(totalAll)} icon={Wallet} />
        <AdminStatCard label="Écritures" value={String(expenses.length)} icon={Receipt} />
        <AdminStatCard
          label="Moyenne / dépense"
          value={formatEUR(avgExpense)}
          sub={`${byCategory.length} catégories ce mois`}
          icon={TrendingDown}
        />
      </div>

      {byCategory.length > 0 && (
        <section className="rounded-2xl border border-white/10 bg-[#1A1412] p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-cream">
            <TrendingDown className="h-4 w-4 text-red-400" />
            Répartition du mois
          </h2>
          <div className="space-y-3">
            {byCategory.map(([cat, amount]) => {
              const pct = Math.round((amount / maxCategory) * 100)
              const tone = CATEGORY_TONE[cat] ?? CATEGORY_TONE.Divers
              return (
                <div key={cat}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className={cn('rounded-full border px-2 py-0.5 font-medium', tone)}>
                      {cat}
                    </span>
                    <span className="tabular-nums text-cream/60">{formatEUR(amount)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-red-600/80 to-red-400/60"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      <AdminDataGridShell
        title="Journal des dépenses"
        subtitle="Recherche, filtres date et catégorie"
        table={table}
        recordCount={table.getFilteredRowModel().rows.length}
        search={globalFilter}
        onSearchChange={setGlobalFilter}
        searchPlaceholder="Rechercher une dépense…"
        emptyMessage={
          expenses.length === 0
            ? 'Aucune dépense — npm run seed:ops pour les charges démo'
            : 'Aucun résultat pour ce filtre'
        }
        headerExtra={
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="rounded-xl border border-white/15 bg-white/[0.03] px-3 py-2 text-sm text-cream outline-none focus:border-tomato/40"
              title="Du"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="rounded-xl border border-white/15 bg-white/[0.03] px-3 py-2 text-sm text-cream outline-none focus:border-tomato/40"
              title="Au"
            />
            <select
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value)
                setPagination((p) => ({ ...p, pageIndex: 0 }))
              }}
              className="rounded-xl border border-white/15 bg-white/[0.03] px-3 py-2 text-sm text-cream outline-none focus:border-tomato/40"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        }
      />

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#1A1412] p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold text-cream">
                {editing ? 'Modifier la dépense' : 'Nouvelle dépense'}
              </h2>
              <button type="button" onClick={() => setShowModal(false)}>
                <X className="h-5 w-5 text-cream/40" />
              </button>
            </div>
            <form onSubmit={(e) => void handleSave(e)} className="space-y-4">
              <label className="block text-xs text-cream/50">
                Description
                <input
                  name="description"
                  defaultValue={editing?.description}
                  className={fieldClass}
                  placeholder="Metro — fromages"
                  required
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs text-cream/50">
                  Montant (€)
                  <input
                    name="amount"
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue={editing ? centsToEuros(editing.amount) : ''}
                    className={fieldClass}
                    required
                  />
                </label>
                <label className="block text-xs text-cream/50">
                  Date
                  <input
                    name="date"
                    type="date"
                    defaultValue={
                      editing
                        ? new Date(editing.date || editing.createdAt).toISOString().slice(0, 10)
                        : new Date().toISOString().slice(0, 10)
                    }
                    className={fieldClass}
                  />
                </label>
              </div>
              <label className="block text-xs text-cream/50">
                Catégorie
                <select
                  name="category"
                  defaultValue={editing?.category ?? 'Matières premières'}
                  className={fieldClass}
                >
                  {CATEGORIES.filter((c) => c !== 'Toutes').map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs text-cream/50">
                Notes
                <textarea name="notes" defaultValue={editing?.notes ?? ''} rows={2} className={fieldClass} />
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-xl border border-white/15 px-4 py-2 text-sm"
                >
                  Annuler
                </button>
                <button type="submit" className="rounded-xl bg-tomato px-4 py-2 text-sm font-semibold text-white">
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminPageShell>
  )
}
