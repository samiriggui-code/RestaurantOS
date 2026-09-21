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
import { useFeedbackState } from '@/lib/use-feedback-state'
import Link from 'next/link'
import {
  ChevronLeft,
  ChevronRight,
  Globe,
  Loader2,
  ShoppingBag,
  TrendingUp,
  UtensilsCrossed,
  Wallet,
} from 'lucide-react'
import { SalesVsExpensesCards } from '@/components/admin/SalesVsExpensesCards'
import { AdminStatCard, ADMIN_STAT_GRID } from '@/components/admin/AdminStatCard'
import { AdminDataGridShell, DataGridColumnHeader } from '@/components/ui/data-grid'
import { ApexDonutChart, type DonutSlice } from '@/components/admin/charts/ApexDonutChart'
import { ApexBarChart } from '@/components/admin/charts/ApexBarChart'
import { getStaffSession } from '@/lib/staff-auth'
import { staffFetch } from '@/lib/staff-api'
import {
  ORDER_STATUS_LABEL,
  ORDER_TYPE_LABEL,
  orderCustomerLine,
  PAYMENT_STATUS_LABEL,
  type OpsOrder,
} from '@/lib/ops-orders'
import { formatEUR } from '@/lib/money'
import { CHART_COLORS, orderTypeLabel, paymentMethodLabel } from '@/lib/report-labels'
import { orderChannelDisplayLabel } from '@/lib/admin-nav'
import { cn } from '@/lib/cn'
import { useAdminRefresh } from '@/components/admin/AdminLiveProvider'
import { PeriodPicker, defaultCustomRange } from '@/components/admin/PeriodPicker'
import { periodToDateRange, type ArchivePeriod, type CustomRange } from '@/lib/order-period'

/** Heures d'ouverture du comptoir — cadre par défaut du graphique "Commandes par heure". */
const OPENING_HOUR = 18
const CLOSING_HOUR = 23

const PERIOD_LABEL: Record<ArchivePeriod, string> = {
  today: "aujourd'hui",
  week: '7 derniers jours',
  month: '30 derniers jours',
  custom: 'période sélectionnée',
  all: 'toute la période',
}

type RecentCounterSale = {
  id: string
  transactionCode: string | null
  amountCents: number
  paymentType: string
  occurredAt: string
  productSummary: string | null
}

type DashboardData = {
  todayOrders: number
  todayPaidCount: number
  todayRevenue: number
  avgBasketToday: number
  pendingOrders: number
  onlineToday: number
  counterToday: number
  topItemsToday: { id: string; name: string; quantity: number; revenue: number }[]
  hourlyToday: { hour: number; count: number; revenue: number }[]
  orderTypes: Record<string, { count: number; revenue: number }>
  paymentMethods: Record<string, { count: number; revenue: number }>
  channelsToday: Record<string, { count: number; revenue: number }>
  salesByDay: { date: string; count: number; total: number }[]
  recentOrders: OpsOrder[]
  recentCounterSales: RecentCounterSale[]
}

type RecentRow =
  | { kind: 'order'; date: string; order: OpsOrder }
  | { kind: 'counter'; date: string; sale: RecentCounterSale }

function recordToDonut(
  record: Record<string, { count: number; revenue: number }>,
  labelFn: (k: string) => string,
  byRevenue = true
): DonutSlice[] {
  return Object.entries(record)
    .filter(([, v]) => (byRevenue ? v.revenue : v.count) > 0)
    .sort((a, b) => (byRevenue ? b[1].revenue - a[1].revenue : b[1].count - a[1].count))
    .map(([key, val], i) => ({
      label: labelFn(key),
      value: byRevenue ? val.revenue : val.count,
      color: CHART_COLORS[i % CHART_COLORS.length],
    }))
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === 'CONFIRMED' || status === 'PREPARING'
      ? 'bg-blue-500/15 text-blue-200'
      : status === 'READY'
        ? 'bg-emerald-500/15 text-emerald-200'
        : status === 'PENDING_PAYMENT'
          ? 'bg-amber-500/15 text-amber-200'
          : status === 'CANCELLED'
            ? 'bg-red-500/15 text-red-200'
            : 'bg-white/10 text-cream/60'

  return (
    <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold', tone)}>
      {ORDER_STATUS_LABEL[status] ?? status}
    </span>
  )
}

export function AdminHome() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const { error, setError } = useFeedbackState()
  const [period, setPeriod] = useState<ArchivePeriod>('today')
  const [custom, setCustom] = useState<CustomRange>(() => defaultCustomRange())
  const [topItemsPage, setTopItemsPage] = useState(0)
  const TOP_ITEMS_PAGE_SIZE = 5

  const range = useMemo(
    () => periodToDateRange(period, period === 'custom' ? custom : undefined),
    [period, custom],
  )

  const load = useCallback(() => {
    const session = getStaffSession()
    if (!session) return
    setLoading(true)
    const params = new URLSearchParams()
    if (range.dateFrom) params.set('from', range.dateFrom)
    if (range.dateTo) params.set('to', range.dateTo)
    staffFetch<DashboardData>(`/reports/dashboard?${params.toString()}`, { token: session.token })
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Chargement impossible'))
      .finally(() => setLoading(false))
  }, [range, setError])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    setTopItemsPage(0)
  }, [range])

  useAdminRefresh(['dashboard', 'orders'], load)

  const orderTypeSlices = useMemo(
    () => (data ? recordToDonut(data.orderTypes, orderTypeLabel, true) : []),
    [data]
  )
  const paymentSlices = useMemo(
    () => (data ? recordToDonut(data.paymentMethods, paymentMethodLabel, true) : []),
    [data]
  )
  // Détail réel par canal (Web/Deliveroo/Uber Eats/Comptoir SumUp) — avant, la carte
  // "Canaux" ne montrait qu'un ratio "X en ligne / Y comptoir" en nombre de commandes qui
  // pouvait sembler contredire "Commandes" (0 commande app + 14 ventes comptoir = confus).
  const channelSlices = useMemo(
    () => (data ? recordToDonut(data.channelsToday, (k) => orderChannelDisplayLabel(k), false) : []),
    [data]
  )

  const weekBars = useMemo(() => {
    if (!data) return { categories: [] as string[], series: [] as number[] }
    return {
      categories: data.salesByDay.map((d) =>
        new Date(d.date).toLocaleDateString('fr-FR', { weekday: 'short' }).slice(0, 3)
      ),
      series: data.salesByDay.map((d) => d.total),
    }
  }, [data])

  // Fenêtre par défaut = heures d'ouverture (18h-23h) — pas besoin d'afficher 24h pleines
  // pour un comptoir qui n'ouvre que le soir. S'élargit automatiquement si une vente
  // apparaît en dehors (jamais de donnée cachée, juste un cadrage par défaut réaliste).
  const hourlyBars = useMemo(() => {
    if (!data) return { categories: [] as string[], series: [] as number[] }
    const activeHours = data.hourlyToday.filter((h) => h.count > 0).map((h) => h.hour)
    const start = Math.min(OPENING_HOUR, ...activeHours)
    const end = Math.max(CLOSING_HOUR, ...activeHours)
    const slice = data.hourlyToday.slice(start, end + 1)
    return {
      categories: slice.map((h) => `${h.hour}h`),
      series: slice.map((h) => h.count),
    }
  }, [data])

  // Fusionne commandes (Order) et ventes comptoir SumUp (pas de Order) — sans ça, le
  // comptoir n'apparaît jamais dans "Dernières commandes" alors que c'est un canal réel.
  const recentRows: RecentRow[] = useMemo(() => {
    if (!data) return []
    const orderRows: RecentRow[] = data.recentOrders.map((order) => ({
      kind: 'order',
      date: order.createdAt,
      order,
    }))
    const counterRows: RecentRow[] = data.recentCounterSales.map((sale) => ({
      kind: 'counter',
      date: sale.occurredAt,
      sale,
    }))
    return [...orderRows, ...counterRows].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    )
  }, [data])

  const [recentSearch, setRecentSearch] = useState('')
  const [recentSorting, setRecentSorting] = useState<SortingState>([{ id: 'date', desc: true }])
  const [recentPagination, setRecentPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 })

  const recentColumns = useMemo<ColumnDef<RecentRow>[]>(
    () => [
      {
        id: 'number',
        header: ({ column }) => <DataGridColumnHeader title="N°" column={column} />,
        accessorFn: (row) => (row.kind === 'order' ? `#${row.order.orderNumber}` : row.sale.transactionCode ?? ''),
        cell: ({ row }) =>
          row.original.kind === 'order' ? (
            <span className="font-semibold text-cream">#{row.original.order.orderNumber}</span>
          ) : (
            <span className="font-mono text-xs text-cream/40">{row.original.sale.transactionCode ?? '—'}</span>
          ),
      },
      {
        id: 'client',
        header: ({ column }) => <DataGridColumnHeader title="Client" column={column} />,
        accessorFn: (row) => (row.kind === 'order' ? orderCustomerLine(row.order) : 'Comptoir'),
        cell: ({ row }) => (
          <span className="text-cream/80">
            {row.original.kind === 'order' ? orderCustomerLine(row.original.order) : 'Comptoir'}
          </span>
        ),
      },
      {
        id: 'mode',
        header: ({ column }) => <DataGridColumnHeader title="Mode" column={column} />,
        accessorFn: (row) => (row.kind === 'order' ? ORDER_TYPE_LABEL[row.order.type] ?? row.order.type : 'SumUp'),
        cell: ({ row }) =>
          row.original.kind === 'order' ? (
            <span className="text-cream/60">
              {ORDER_TYPE_LABEL[row.original.order.type] ?? row.original.order.type}
              {row.original.order.isOnlineOrder && <span className="ml-1 text-[10px] text-sky-400">web</span>}
            </span>
          ) : (
            <span className="text-[10px] text-amber-400">SumUp</span>
          ),
      },
      {
        id: 'date',
        header: ({ column }) => <DataGridColumnHeader title="Date" column={column} />,
        accessorFn: (row) => new Date(row.date).getTime(),
        cell: ({ row }) => (
          <span className="text-cream/60">{new Date(row.original.date).toLocaleString('fr-FR')}</span>
        ),
      },
      {
        id: 'status',
        header: ({ column }) => <DataGridColumnHeader title="Statut" column={column} />,
        accessorFn: (row) => (row.kind === 'order' ? ORDER_STATUS_LABEL[row.order.status] ?? row.order.status : 'Payée'),
        cell: ({ row }) =>
          row.original.kind === 'order' ? (
            <StatusBadge status={row.original.order.status} />
          ) : (
            <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-200">
              Payée
            </span>
          ),
      },
      {
        id: 'payment',
        header: ({ column }) => <DataGridColumnHeader title="Paiement" column={column} />,
        accessorFn: (row) =>
          row.kind === 'order'
            ? PAYMENT_STATUS_LABEL[row.order.paymentStatus] ?? row.order.paymentStatus
            : row.sale.paymentType === 'CASH' ? 'Espèces' : 'Carte',
        cell: ({ row }) => (
          <span className="text-cream/60">
            {row.original.kind === 'order'
              ? PAYMENT_STATUS_LABEL[row.original.order.paymentStatus] ?? row.original.order.paymentStatus
              : row.original.sale.paymentType === 'CASH' ? 'Espèces' : 'Carte'}
          </span>
        ),
      },
      {
        id: 'total',
        header: ({ column }) => <DataGridColumnHeader title="Total" column={column} />,
        accessorFn: (row) => (row.kind === 'order' ? row.order.total : row.sale.amountCents),
        cell: ({ row }) => (
          <span className="font-medium tabular-nums text-tomato-light">
            {formatEUR(row.original.kind === 'order' ? row.original.order.total : row.original.sale.amountCents)}
          </span>
        ),
      },
    ],
    [],
  )

  const recentTable = useReactTable({
    data: recentRows,
    columns: recentColumns,
    state: { pagination: recentPagination, sorting: recentSorting, globalFilter: recentSearch },
    onPaginationChange: setRecentPagination,
    onSortingChange: setRecentSorting,
    onGlobalFilterChange: setRecentSearch,
    globalFilterFn: 'includesString',
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getRowId: (row) => (row.kind === 'order' ? `order-${row.order.id}` : `counter-${row.sale.id}`),
  })

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-tomato-light" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-cream">Tableau de bord</h1>
          <p className="text-sm text-cream/50">La Z Pizza — {PERIOD_LABEL[period]}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PeriodPicker period={period} custom={custom} onPeriodChange={setPeriod} onCustomChange={setCustom} />
          <Link
            href="/admin/reports"
            className="rounded-xl border border-white/15 px-4 py-2 text-sm text-cream/70 hover:bg-white/5"
          >
            Rapports détaillés →
          </Link>
        </div>
      </div>

      {error && (
        <p className="rounded-xl border border-red-500/30 bg-red-950/40 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      )}

      <div className={ADMIN_STAT_GRID}>
        <AdminStatCard
          label="À traiter"
          value={data?.pendingOrders ?? 0}
          sub="Cuisine + caisse"
          icon={UtensilsCrossed}
          tone="text-tomato-light"
        />
        <AdminStatCard
          label="Commandes"
          value={data?.todayOrders ?? 0}
          sub={`${data?.todayPaidCount ?? 0} payées`}
          icon={ShoppingBag}
        />
        <AdminStatCard
          label="CA"
          value={formatEUR(data?.todayRevenue ?? 0)}
          icon={Wallet}
          tone="text-emerald-300"
        />
        <AdminStatCard
          label="Panier moyen"
          value={formatEUR(data?.avgBasketToday ?? 0)}
          sub="Toutes ventes confondues"
          icon={Globe}
          tone="text-sky-300"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        <section className="flex min-h-[220px] flex-col rounded-2xl border border-white/10 bg-[#1A1412] p-5">
          <h2 className="mb-4 text-sm font-semibold text-cream">Commandes par heure</h2>
          <div className="flex flex-1 items-end">
            <ApexBarChart
              categories={hourlyBars.categories}
              series={hourlyBars.series}
              color="#2A9D8F"
              height={180}
              className="w-full"
            />
          </div>
        </section>

        <section className="flex min-h-[220px] flex-col rounded-2xl border border-white/10 bg-[#1A1412] p-5">
          <h2 className="mb-4 text-sm font-semibold text-cream">Modes de commande</h2>
          <div className="flex flex-1 items-center">
            <ApexDonutChart slices={orderTypeSlices} centerLabel="CA" valueFormat="eur" size={130} className="w-full" />
          </div>
        </section>

        <section className="flex min-h-[220px] flex-col rounded-2xl border border-white/10 bg-[#1A1412] p-5">
          <h2 className="mb-4 text-sm font-semibold text-cream">Paiements</h2>
          <div className="flex flex-1 items-center">
            <ApexDonutChart slices={paymentSlices} centerLabel="CA" valueFormat="eur" size={130} className="w-full" />
          </div>
        </section>

        <section className="flex min-h-[220px] flex-col rounded-2xl border border-white/10 bg-[#1A1412] p-5">
          <h2 className="mb-4 text-sm font-semibold text-cream">Canaux</h2>
          <div className="flex flex-1 items-center">
            <ApexDonutChart slices={channelSlices} centerLabel="Ventes" valueFormat="number" size={130} className="w-full" />
          </div>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="flex min-h-[220px] flex-col rounded-2xl border border-white/10 bg-[#1A1412] p-5 lg:col-span-2">
          <h2 className="mb-4 text-sm font-semibold text-cream">CA par jour</h2>
          <div className="flex flex-1 items-end">
            <ApexBarChart
              categories={weekBars.categories}
              series={weekBars.series}
              color="#E85D4C"
              height={180}
              formatValue={(v) => formatEUR(v)}
              className="w-full"
            />
          </div>
        </section>

        <section className="flex min-h-[220px] flex-col rounded-2xl border border-white/10 bg-[#1A1412] p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-cream">
            <TrendingUp className="h-4 w-4 text-tomato-light" />
            Top articles vendus
          </h2>
          {data && data.topItemsToday.length > 0 ? (
            <>
              <ul className="space-y-2">
                {data.topItemsToday
                  .slice(topItemsPage * TOP_ITEMS_PAGE_SIZE, topItemsPage * TOP_ITEMS_PAGE_SIZE + TOP_ITEMS_PAGE_SIZE)
                  .map((item, i) => (
                    <li
                      key={item.id}
                      className="flex items-center justify-between gap-2 rounded-xl bg-white/[0.03] px-3 py-2 text-sm"
                    >
                      <span className="flex min-w-0 items-center gap-2 text-cream/80">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white/5 text-xs font-bold text-cream/40">
                          {topItemsPage * TOP_ITEMS_PAGE_SIZE + i + 1}
                        </span>
                        <span className="truncate">{item.name}</span>
                      </span>
                      <span className="shrink-0 tabular-nums text-tomato-light">
                        {item.quantity} · {formatEUR(item.revenue)}
                      </span>
                    </li>
                  ))}
              </ul>
              {data.topItemsToday.length > TOP_ITEMS_PAGE_SIZE && (
                <div className="mt-3 flex items-center justify-between text-xs text-cream/40">
                  <button
                    type="button"
                    disabled={topItemsPage === 0}
                    onClick={() => setTopItemsPage((p) => p - 1)}
                    className="flex items-center gap-1 rounded-lg px-2 py-1 hover:bg-white/5 disabled:opacity-30"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" /> Préc.
                  </button>
                  <span>
                    Page {topItemsPage + 1} / {Math.ceil(data.topItemsToday.length / TOP_ITEMS_PAGE_SIZE)}
                  </span>
                  <button
                    type="button"
                    disabled={(topItemsPage + 1) * TOP_ITEMS_PAGE_SIZE >= data.topItemsToday.length}
                    onClick={() => setTopItemsPage((p) => p + 1)}
                    className="flex items-center gap-1 rounded-lg px-2 py-1 hover:bg-white/5 disabled:opacity-30"
                  >
                    Suiv. <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <p className="text-sm text-cream/40">Aucune vente sur cette période</p>
            </div>
          )}
        </section>
      </div>

      <SalesVsExpensesCards range={range} periodLabel={PERIOD_LABEL[period]} />

      <AdminDataGridShell
        title="Dernières commandes"
        table={recentTable}
        recordCount={recentTable.getFilteredRowModel().rows.length}
        search={recentSearch}
        onSearchChange={setRecentSearch}
        searchPlaceholder="N°, client, code…"
        emptyMessage={recentRows.length === 0 ? 'Aucune commande' : 'Aucun résultat pour ce filtre'}
        paginationSizes={[5, 10, 50]}
        headerExtra={
          <Link href="/admin/orders" className="text-sm text-tomato-light hover:underline">
            Voir tout →
          </Link>
        }
      />
    </div>
  )
}
