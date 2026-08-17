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
import { Loader2, MapPin, Search, Truck } from 'lucide-react'
import {
  AdminDataGridShell,
  DataGridColumnHeader,
  createDefaultPagination,
} from '@/components/ui/data-grid'
import { formatEUR } from '@/lib/money'
import { getStaffSession } from '@/lib/staff-auth'
import { staffFetch } from '@/lib/staff-api'
import { ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL } from '@/lib/ops-orders'
import { cn } from '@/lib/cn'
import { useAdminRefresh } from '@/components/admin/AdminLiveProvider'

export type DeliveryHistoryPeriod = 'day' | 'week' | 'month' | 'year' | 'all'

const PERIODS: { value: DeliveryHistoryPeriod; label: string }[] = [
  { value: 'day', label: "Aujourd'hui" },
  { value: 'week', label: '7 jours' },
  { value: 'month', label: '30 jours' },
  { value: 'year', label: '12 mois' },
  { value: 'all', label: 'Tout' },
]

type DeliveryHistoryRow = {
  id: string
  orderNumber: number
  status: string
  customerName: string | null
  customerPhone: string | null
  deliveryAddress: string | null
  deliveryPostalCode: string | null
  deliveryCity: string | null
  total: number
  paymentStatus: string
  paymentMethod: string | null
  isOnlineOrder: boolean
  driverName: string | null
  completedAt: string | null
  createdAt: string
  issueReason: string | null
}

function formatAddress(row: DeliveryHistoryRow): string {
  const parts = [row.deliveryAddress, row.deliveryPostalCode, row.deliveryCity].filter(Boolean)
  return parts.join(', ') || '—'
}

function statusTone(status: string): string {
  if (status === 'DELIVERED' || status === 'COMPLETED') return 'bg-emerald-500/15 text-emerald-200'
  if (status === 'DELIVERY_ISSUE') return 'bg-amber-500/15 text-amber-200'
  if (status === 'CANCELLED') return 'bg-red-500/15 text-red-200'
  return 'bg-white/10 text-cream/60'
}

export function AdminDeliveryHistoryView() {
  const [rows, setRows] = useState<DeliveryHistoryRow[]>([])
  const [loading, setLoading] = useState(true)
  const { error, setError } = useFeedbackState()
  const [period, setPeriod] = useState<DeliveryHistoryPeriod>('month')
  const [driverFilter, setDriverFilter] = useState('')
  const [globalFilter, setGlobalFilter] = useState('')
  const [pagination, setPagination] = useState<PaginationState>(() => createDefaultPagination())
  const [sorting, setSorting] = useState<SortingState>([{ id: 'completedAt', desc: true }])

  const load = useCallback(async () => {
    const session = getStaffSession('crm')
    if (!session) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ period })
      if (driverFilter.trim()) params.set('driverName', driverFilter.trim())
      if (globalFilter.trim()) params.set('search', globalFilter.trim())
      const res = await staffFetch<{ rows: DeliveryHistoryRow[]; total: number }>(
        `/delivery/history?${params}`,
        { token: session.token },
      )
      setRows(res.rows)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur chargement')
    } finally {
      setLoading(false)
    }
  }, [period, driverFilter, globalFilter])

  useEffect(() => {
    void load()
  }, [load])

  useAdminRefresh('orders', load)

  const columns = useMemo<ColumnDef<DeliveryHistoryRow>[]>(
    () => [
      {
        id: 'completedAt',
        accessorFn: (r) => r.completedAt ?? r.createdAt,
        header: ({ column }) => <DataGridColumnHeader title="Date" column={column} />,
        cell: ({ row }) => {
          const d = row.original.completedAt ?? row.original.createdAt
          return (
            <span className="tabular-nums text-cream/80">
              {new Date(d).toLocaleString('fr-FR', {
                day: '2-digit',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          )
        },
      },
      {
        accessorKey: 'orderNumber',
        header: ({ column }) => <DataGridColumnHeader title="N°" column={column} />,
        cell: ({ getValue }) => <span className="font-semibold text-cream">#{getValue<number>()}</span>,
      },
      {
        accessorKey: 'driverName',
        header: ({ column }) => <DataGridColumnHeader title="Livreur" column={column} />,
        cell: ({ getValue }) => (
          <span className="text-cream/75">{getValue<string | null>() ?? '—'}</span>
        ),
      },
      {
        id: 'customer',
        accessorFn: (r) => r.customerName ?? '',
        header: ({ column }) => <DataGridColumnHeader title="Client" column={column} />,
        cell: ({ row }) => (
          <div>
            <p className="font-medium text-cream">{row.original.customerName ?? '—'}</p>
            {row.original.customerPhone && (
              <p className="text-xs text-cream/45">{row.original.customerPhone}</p>
            )}
          </div>
        ),
      },
      {
        id: 'address',
        accessorFn: (r) => formatAddress(r),
        header: ({ column }) => <DataGridColumnHeader title="Adresse" column={column} />,
        cell: ({ row }) => (
          <span className="line-clamp-2 max-w-[220px] text-xs text-cream/65">
            {formatAddress(row.original)}
          </span>
        ),
      },
      {
        accessorKey: 'total',
        header: ({ column }) => <DataGridColumnHeader title="Montant" column={column} />,
        cell: ({ getValue }) => (
          <span className="font-semibold text-tomato-light">{formatEUR(getValue<number>())}</span>
        ),
      },
      {
        accessorKey: 'status',
        header: ({ column }) => <DataGridColumnHeader title="Statut" column={column} />,
        cell: ({ row }) => (
          <div className="space-y-1">
            <span
              className={cn(
                'inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold',
                statusTone(row.original.status),
              )}
            >
              {ORDER_STATUS_LABEL[row.original.status] ?? row.original.status}
            </span>
            {row.original.issueReason && (
              <p className="text-[10px] text-amber-200/80">{row.original.issueReason}</p>
            )}
          </div>
        ),
      },
      {
        id: 'channel',
        accessorFn: (r) => (r.isOnlineOrder ? 'En ligne' : 'Comptoir'),
        header: ({ column }) => <DataGridColumnHeader title="Canal" column={column} />,
        cell: ({ getValue }) => <span className="text-xs text-cream/55">{getValue<string>()}</span>,
      },
      {
        accessorKey: 'paymentStatus',
        header: ({ column }) => <DataGridColumnHeader title="Paiement" column={column} />,
        cell: ({ getValue }) => (
          <span className="text-xs text-cream/55">
            {PAYMENT_STATUS_LABEL[getValue<string>()] ?? getValue<string>()}
          </span>
        ),
      },
    ],
    [],
  )

  const table = useReactTable({
    data: rows,
    columns,
    state: { pagination, sorting, globalFilter },
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })

  const delivered = rows.filter((r) => r.status === 'DELIVERED' || r.status === 'COMPLETED').length
  const revenue = rows
    .filter((r) => r.status === 'DELIVERED' || r.status === 'COMPLETED')
    .reduce((s, r) => s + r.total, 0)

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-cream">
            <Truck className="h-5 w-5 text-tomato-light" />
            Historique livraisons
          </h2>
          <p className="mt-1 text-sm text-cream/45">
            {delivered} livrée(s) · {formatEUR(revenue)} sur la période
          </p>
        </div>
        <div className="flex flex-wrap gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setPeriod(p.value)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-medium transition',
                period === p.value
                  ? 'bg-tomato/20 text-tomato-light'
                  : 'text-cream/55 hover:text-cream',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <label className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cream/35" />
          <input
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void load()}
            placeholder="Client, adresse, n° commande…"
            className="w-full rounded-xl border border-white/15 bg-white/[0.03] py-2 pl-9 pr-3 text-sm text-cream outline-none focus:border-tomato/40"
          />
        </label>
        <input
          value={driverFilter}
          onChange={(e) => setDriverFilter(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void load()}
          placeholder="Filtrer livreur"
          className="w-full max-w-[180px] rounded-xl border border-white/15 bg-white/[0.03] px-3 py-2 text-sm text-cream outline-none focus:border-tomato/40"
        />
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-xl border border-white/15 px-4 py-2 text-sm hover:bg-white/5"
        >
          Filtrer
        </button>
      </div>

      {error && (
        <p className="rounded-xl border border-red-500/30 bg-red-950/40 px-4 py-2 text-sm text-red-200">
          {error}
        </p>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-tomato-light" />
        </div>
      ) : (
        <AdminDataGridShell
          title="Livraisons"
          subtitle="Historique des commandes livrées sur la période"
          table={table}
          recordCount={table.getFilteredRowModel().rows.length}
          isLoading={loading}
          emptyMessage="Aucune livraison sur cette période"
        />
      )}
    </section>
  )
}
