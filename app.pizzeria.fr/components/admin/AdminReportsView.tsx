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
  AlertTriangle,
  BarChart3,
  Download,
  Loader2,
  Package,
  Printer,
  Receipt,
  RotateCcw,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  UserCircle,
  Users,
  Wallet,
} from 'lucide-react'
import { AdminStatCard, ADMIN_STAT_GRID } from '@/components/admin/AdminStatCard'
import { AdminPageHeader } from '@/components/admin/AdminSectionTabs'
import { ApexDonutChart, type DonutSlice } from '@/components/admin/charts/ApexDonutChart'
import { ApexBarChart } from '@/components/admin/charts/ApexBarChart'
import { formatEUR } from '@/lib/money'
import { getStaffSession } from '@/lib/staff-auth'
import { staffFetch, staffFetchText } from '@/lib/staff-api'
import { CHART_COLORS, orderTypeLabel, paymentMethodLabel } from '@/lib/report-labels'
import { useAdminRefresh } from '@/components/admin/AdminLiveProvider'
import { downloadCsv } from '@/lib/export-csv'
import { AdminPrintPreview } from '@/components/admin/AdminPrintPreview'
import { AdminDataGridShell, DataGridColumnHeader, createDefaultPagination } from '@/components/ui/data-grid'
import { PeriodPicker, defaultCustomRange } from '@/components/admin/PeriodPicker'
import { periodToDateRange, type ArchivePeriod, type CustomRange } from '@/lib/order-period'
import { isModuleEnabled } from '@/lib/modules'
import { cn } from '@/lib/cn'

type SalesRow = { date: string; total: number; count: number }
type CategoryRow = { name: string; totalSold: number; revenue: number }
type ItemRow = { id: string; name: string; quantity: number; revenue: number; orders: number }
type PeakHours = {
  hourly: { hour: number; count: number; revenue: number }[]
  dow: { day: number; count: number; revenue: number }[]
}
type EmployeeRow = { id: string; name: string; role: string; orderCount: number; totalSales: number }
type DriverRow = {
  id: string
  name: string
  deliveryCount: number
  deliveredCount: number
  totalSales: number
}

const DOW_LABEL = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']

/** Heures d'ouverture du comptoir — cadre par défaut du graphique "Heures de pointe". */
const OPENING_HOUR = 18
const CLOSING_HOUR = 23

const PERIOD_SUBLABEL: Record<ArchivePeriod, string> = {
  today: "aujourd'hui",
  week: '7 derniers jours',
  month: '30 derniers jours',
  custom: 'période sélectionnée',
  all: 'toute la période',
}

type SalesVsExpenses = {
  sales: { onlineCents: number; counterCents: number; totalCents: number }
  expenses: { manualCents: number; supplierInvoicesCents: number; totalCents: number }
  netCents: number
  losses: { cancelledOrdersCount: number; cancelledOrdersValueCents: number }
  undeliveredOrders: {
    count: number
    orders: { id: string; orderNumber: number; customerName: string | null; total: number; deliveryIssueReason: string | null }[]
  }
  refunds: { count: number; totalCents: number }
}

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

export function AdminReportsView() {
  const [period, setPeriod] = useState<ArchivePeriod>('week')
  const [custom, setCustom] = useState<CustomRange>(() => defaultCustomRange())
  const [sales, setSales] = useState<SalesRow[]>([])
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [items, setItems] = useState<ItemRow[]>([])
  const [peak, setPeak] = useState<PeakHours | null>(null)
  const [paymentMethods, setPaymentMethods] = useState<Record<string, { count: number; revenue: number }>>({})
  const [orderTypes, setOrderTypes] = useState<Record<string, { count: number; revenue: number }>>({})
  const [employees, setEmployees] = useState<EmployeeRow[]>([])
  const [drivers, setDrivers] = useState<DriverRow[]>([])
  const [salesVsExpenses, setSalesVsExpenses] = useState<SalesVsExpenses | null>(null)
  const [loading, setLoading] = useState(true)
  const [printPreview, setPrintPreview] = useState<{ html: string; title: string } | null>(null)
  const [printLoading, setPrintLoading] = useState(false)

  const range = useMemo(
    () => periodToDateRange(period, period === 'custom' ? custom : undefined),
    [period, custom],
  )

  // "Performance équipe" lit Order.cashierId, renseigné uniquement par les routes du
  // module POS (désactivé) — cette section serait donc toujours vide. On évite même
  // l'appel réseau plutôt que de l'afficher vide en permanence.
  const posEnabled = isModuleEnabled('pos')

  const load = useCallback(() => {
    const session = getStaffSession()
    if (!session) return
    const params = new URLSearchParams()
    if (range.dateFrom) params.set('from', range.dateFrom)
    if (range.dateTo) params.set('to', range.dateTo)
    const qs = params.toString()
    setLoading(true)
    Promise.all([
      staffFetch<SalesRow[]>(`/reports/sales?${qs}&groupBy=day`, { token: session.token }),
      staffFetch<CategoryRow[]>(`/reports/categories?${qs}`, { token: session.token }),
      staffFetch<ItemRow[]>(`/reports/items-performance?${qs}`, { token: session.token }),
      staffFetch<PeakHours>(`/reports/peak-hours?${qs}`, { token: session.token }),
      staffFetch<Record<string, { count: number; revenue: number }>>(`/reports/payment-methods?${qs}`, {
        token: session.token,
      }),
      staffFetch<Record<string, { count: number; revenue: number }>>(`/reports/order-types?${qs}`, {
        token: session.token,
      }),
      posEnabled
        ? staffFetch<EmployeeRow[]>(`/reports/employees?${qs}`, { token: session.token })
        : Promise.resolve<EmployeeRow[]>([]),
      staffFetch<DriverRow[]>(`/reports/drivers?${qs}`, { token: session.token }),
      staffFetch<SalesVsExpenses>(`/reports/sales-vs-expenses?${qs}`, { token: session.token }),
    ])
      .then(([s, c, i, p, pm, ot, emp, drv, sve]) => {
        setSales(s)
        setCategories(c.filter((x) => x.totalSold > 0).sort((a, b) => b.revenue - a.revenue))
        setItems(i)
        setPeak(p)
        setPaymentMethods(pm)
        setOrderTypes(ot)
        setEmployees(emp.filter((e) => e.orderCount > 0).sort((a, b) => b.totalSales - a.totalSales))
        setDrivers(drv.filter((d) => d.deliveryCount > 0).sort((a, b) => b.totalSales - a.totalSales))
        setSalesVsExpenses(sve)
      })
      .finally(() => setLoading(false))
  }, [range, posEnabled])

  useEffect(() => {
    load()
  }, [load])

  useAdminRefresh(['reports', 'orders', 'dashboard'], load)

  const totalSales = sales.reduce((s, d) => s + d.total, 0)
  const totalOrders = sales.reduce((s, d) => s + d.count, 0)
  const totalUnits = items.reduce((s, i) => s + i.quantity, 0)

  const categorySlices: DonutSlice[] = useMemo(
    () =>
      categories.slice(0, 8).map((cat, i) => ({
        label: cat.name,
        value: cat.revenue,
        color: CHART_COLORS[i % CHART_COLORS.length],
      })),
    [categories]
  )

  const paymentSlices = useMemo(
    () => recordToDonut(paymentMethods, paymentMethodLabel, true),
    [paymentMethods]
  )
  const orderTypeSlices = useMemo(() => recordToDonut(orderTypes, orderTypeLabel, true), [orderTypes])

  const salesBars = useMemo(
    () => ({
      categories: sales.map((d) => new Date(d.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })),
      series: sales.map((d) => d.total),
    }),
    [sales]
  )

  // Fenêtre par défaut = heures d'ouverture (18h-23h), élargie automatiquement si une vente
  // apparaît en dehors — avant, un filtre 17h-23h en dur faisait carrément disparaître toute
  // activité hors de cette plage (service du midi, etc.), sans que ce soit visible nulle part.
  const hourlyBars = useMemo(() => {
    if (!peak) return { categories: [] as string[], series: [] as number[] }
    const activeHours = peak.hourly.filter((h) => h.count > 0).map((h) => h.hour)
    const start = Math.min(OPENING_HOUR, ...activeHours)
    const end = Math.max(CLOSING_HOUR, ...activeHours)
    const slice = peak.hourly.slice(start, end + 1)
    return { categories: slice.map((h) => `${h.hour}h`), series: slice.map((h) => h.count) }
  }, [peak])

  const dowBars = useMemo(
    () => ({
      categories: peak?.dow.map((d) => DOW_LABEL[d.day]) ?? [],
      series: peak?.dow.map((d) => d.count) ?? [],
    }),
    [peak]
  )

  const maxItemQty = items[0]?.quantity ?? 1

  const [itemSearch, setItemSearch] = useState('')
  const [itemSorting, setItemSorting] = useState<SortingState>([{ id: 'quantity', desc: true }])
  const [itemPagination, setItemPagination] = useState<PaginationState>(() => createDefaultPagination())

  const itemColumns = useMemo<ColumnDef<ItemRow>[]>(
    () => [
      {
        id: 'rank',
        header: '#',
        enableSorting: false,
        cell: ({ row }) => <span className="text-cream/35">{row.index + 1}</span>,
      },
      {
        accessorKey: 'name',
        header: ({ column }) => <DataGridColumnHeader title="Article" column={column} />,
        cell: ({ row }) => <span className="font-medium text-cream">{row.original.name}</span>,
      },
      {
        accessorKey: 'quantity',
        header: ({ column }) => <DataGridColumnHeader title="Qté" column={column} />,
        cell: ({ row }) => <span className="tabular-nums text-cream/80">{row.original.quantity}</span>,
      },
      {
        accessorKey: 'orders',
        header: ({ column }) => <DataGridColumnHeader title="Commandes" column={column} />,
        cell: ({ row }) => <span className="tabular-nums text-cream/50">{row.original.orders}</span>,
      },
      {
        accessorKey: 'revenue',
        header: ({ column }) => <DataGridColumnHeader title="CA" column={column} />,
        cell: ({ row }) => (
          <span className="font-medium tabular-nums text-tomato-light">{formatEUR(row.original.revenue)}</span>
        ),
      },
      {
        id: 'share',
        accessorFn: (row) => row.quantity,
        header: () => <span className="text-xs font-medium uppercase tracking-wide text-cream/45">Part</span>,
        enableSorting: false,
        cell: ({ row }) => {
          const share = totalUnits > 0 ? (row.original.quantity / totalUnits) * 100 : 0
          return (
            <div className="flex w-32 items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-tomato/80"
                  style={{ width: `${(row.original.quantity / maxItemQty) * 100}%` }}
                />
              </div>
              <span className="w-10 text-right text-xs tabular-nums text-cream/40">{share.toFixed(0)}%</span>
            </div>
          )
        },
      },
    ],
    [totalUnits, maxItemQty],
  )

  const itemsTable = useReactTable({
    data: items,
    columns: itemColumns,
    state: { pagination: itemPagination, sorting: itemSorting, globalFilter: itemSearch },
    onPaginationChange: setItemPagination,
    onSortingChange: setItemSorting,
    onGlobalFilterChange: setItemSearch,
    globalFilterFn: 'includesString',
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getRowId: (row) => row.id,
  })

  const [dailySearch, setDailySearch] = useState('')
  const [dailySorting, setDailySorting] = useState<SortingState>([{ id: 'date', desc: true }])
  const [dailyPagination, setDailyPagination] = useState<PaginationState>(() => createDefaultPagination())

  const dailyColumns = useMemo<ColumnDef<SalesRow>[]>(
    () => [
      {
        id: 'date',
        accessorFn: (row) => new Date(row.date).getTime(),
        header: ({ column }) => <DataGridColumnHeader title="Date" column={column} />,
        cell: ({ row }) => (
          <span className="text-cream/80">
            {new Date(row.original.date).toLocaleDateString('fr-FR', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
            })}
          </span>
        ),
      },
      {
        accessorKey: 'count',
        header: ({ column }) => <DataGridColumnHeader title="Commandes" column={column} />,
        cell: ({ row }) => <span className="text-cream/60">{row.original.count}</span>,
      },
      {
        accessorKey: 'total',
        header: ({ column }) => <DataGridColumnHeader title="CA" column={column} />,
        cell: ({ row }) => (
          <span className="font-medium text-tomato-light">{formatEUR(row.original.total)}</span>
        ),
      },
      {
        id: 'avgBasket',
        accessorFn: (row) => (row.count > 0 ? row.total / row.count : 0),
        header: ({ column }) => <DataGridColumnHeader title="Panier moy." column={column} />,
        cell: ({ row }) => (
          <span className="text-cream/50">
            {row.original.count > 0 ? formatEUR(Math.round(row.original.total / row.original.count)) : '—'}
          </span>
        ),
      },
    ],
    [],
  )

  const dailyTable = useReactTable({
    data: sales,
    columns: dailyColumns,
    state: { pagination: dailyPagination, sorting: dailySorting, globalFilter: dailySearch },
    onPaginationChange: setDailyPagination,
    onSortingChange: setDailySorting,
    onGlobalFilterChange: setDailySearch,
    globalFilterFn: 'includesString',
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getRowId: (row) => row.date,
  })

  function exportReportCsv() {
    const dayRows = [...sales].reverse().map((row) => [
      new Date(row.date).toLocaleDateString('fr-FR'),
      String(row.count),
      (row.total / 100).toFixed(2),
      row.count > 0 ? ((row.total / row.count) / 100).toFixed(2) : '0',
    ])
    downloadCsv(
      `rapport-ca-${period}-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Date', 'Commandes payées', 'CA EUR', 'Panier moyen EUR'],
      dayRows,
    )
  }

  async function exportReportPdf() {
    const session = getStaffSession()
    if (!session) return
    setPrintLoading(true)
    try {
      const params = new URLSearchParams()
      if (range.dateFrom) params.set('from', range.dateFrom)
      if (range.dateTo) params.set('to', range.dateTo)
      const html = await staffFetchText(`/reports/print?${params.toString()}`, { token: session.token })
      setPrintPreview({ html, title: 'Rapport des ventes' })
    } finally {
      setPrintLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <AdminPageHeader
        title="Rapports"
        description="Ventes encaissées, articles, catégories et canaux — données filtrées sur commandes payées."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void exportReportPdf()}
              disabled={sales.length === 0 || printLoading}
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm text-cream hover:bg-white/5 disabled:opacity-40"
            >
              {printLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
              Rapport PDF
            </button>
            <button
              type="button"
              onClick={exportReportCsv}
              disabled={sales.length === 0}
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm text-cream hover:bg-white/5 disabled:opacity-40"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
            <PeriodPicker period={period} custom={custom} onPeriodChange={setPeriod} onCustomChange={setCustom} />
          </div>
        }
      />

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-tomato-light" />
        </div>
      ) : (
        <>
          {salesVsExpenses ? (
            <section className="rounded-2xl border border-white/10 bg-[#1A1412] p-5">
              <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-cream">
                <Wallet className="h-4 w-4 text-tomato-light" />
                Ventes vs dépenses
              </h2>
              <div className={ADMIN_STAT_GRID}>
                <AdminStatCard
                  label="Ventes"
                  value={formatEUR(salesVsExpenses.sales.totalCents)}
                  sub={`En ligne ${formatEUR(salesVsExpenses.sales.onlineCents)} · Comptoir ${formatEUR(salesVsExpenses.sales.counterCents)}`}
                  icon={TrendingUp}
                  tone="text-emerald-300"
                />
                <AdminStatCard
                  label="Dépenses"
                  value={formatEUR(salesVsExpenses.expenses.totalCents)}
                  sub={`Manuelles ${formatEUR(salesVsExpenses.expenses.manualCents)} · Fournisseurs ${formatEUR(salesVsExpenses.expenses.supplierInvoicesCents)}`}
                  icon={TrendingDown}
                  tone="text-amber-300"
                />
                <AdminStatCard
                  label="Résultat net"
                  value={formatEUR(salesVsExpenses.netCents)}
                  sub={PERIOD_SUBLABEL[period]}
                  icon={Wallet}
                  tone={salesVsExpenses.netCents >= 0 ? 'text-emerald-300' : 'text-red-300'}
                />
                <AdminStatCard
                  label="Pertes (commandes annulées)"
                  value={formatEUR(salesVsExpenses.losses.cancelledOrdersValueCents)}
                  sub={`${salesVsExpenses.losses.cancelledOrdersCount} commande(s)`}
                  icon={AlertTriangle}
                  tone={salesVsExpenses.losses.cancelledOrdersCount > 0 ? 'text-red-300' : undefined}
                />
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-black/25 p-4">
                  <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-cream/45">
                    <RotateCcw className="h-3.5 w-3.5" />
                    Remboursements
                  </h3>
                  {salesVsExpenses.refunds.count === 0 ? (
                    <p className="text-sm text-cream/40">Aucun remboursement sur la période.</p>
                  ) : (
                    <p className="text-sm text-cream">
                      <strong className="text-cream">{salesVsExpenses.refunds.count}</strong> commande(s)
                      remboursée(s), pour{' '}
                      <strong className="text-red-300">{formatEUR(salesVsExpenses.refunds.totalCents)}</strong>
                    </p>
                  )}
                </div>

                <div className="rounded-xl border border-white/10 bg-black/25 p-4">
                  <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-cream/45">
                    <Receipt className="h-3.5 w-3.5" />
                    Commandes non livrées ({salesVsExpenses.undeliveredOrders.count})
                  </h3>
                  {salesVsExpenses.undeliveredOrders.orders.length === 0 ? (
                    <p className="text-sm text-cream/40">Aucune commande en incident de livraison.</p>
                  ) : (
                    <ul className="max-h-40 space-y-1.5 overflow-y-auto">
                      {salesVsExpenses.undeliveredOrders.orders.slice(0, 10).map((o) => (
                        <li key={o.id} className="flex items-center justify-between text-xs">
                          <span className="text-cream/70">
                            #{o.orderNumber} {o.customerName ?? 'Sans nom'}
                            {o.deliveryIssueReason ? ` · ${o.deliveryIssueReason}` : ''}
                          </span>
                          <span className="font-mono text-cream">{formatEUR(o.total)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </section>
          ) : null}

          <div className={ADMIN_STAT_GRID}>
            <AdminStatCard
              label="Chiffre d'affaires"
              value={formatEUR(totalSales)}
              sub={PERIOD_SUBLABEL[period]}
              icon={Wallet}
              tone="text-emerald-300"
            />
            <AdminStatCard
              label="Commandes payées"
              value={totalOrders}
              icon={ShoppingCart}
            />
            <AdminStatCard
              label="Panier moyen"
              value={totalOrders > 0 ? formatEUR(Math.round(totalSales / totalOrders)) : formatEUR(0)}
              icon={TrendingUp}
            />
            <AdminStatCard
              label="Articles vendus"
              value={totalUnits}
              sub={`${items.length} références actives`}
              icon={Package}
            />
          </div>

          <section className="rounded-2xl border border-white/10 bg-[#1A1412] p-5">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-cream">
              <BarChart3 className="h-4 w-4 text-tomato-light" />
              CA par jour
            </h2>
            {salesBars.series.length > 0 ? (
              <ApexBarChart
                categories={salesBars.categories}
                series={salesBars.series}
                color="#E85D4C"
                height={220}
                formatValue={(v) => formatEUR(v)}
              />
            ) : (
              <p className="py-10 text-center text-sm text-cream/40">Aucune vente</p>
            )}
          </section>

          <div className="grid gap-4 md:grid-cols-3">
            <section className="flex min-h-[240px] flex-col rounded-2xl border border-white/10 bg-[#1A1412] p-5">
              <h2 className="mb-4 text-sm font-semibold text-cream">CA par catégorie</h2>
              <div className="flex flex-1 items-center">
                <ApexDonutChart slices={categorySlices} centerLabel="Total" valueFormat="eur" size={150} className="w-full" />
              </div>
            </section>

            <section className="flex min-h-[240px] flex-col rounded-2xl border border-white/10 bg-[#1A1412] p-5">
              <h2 className="mb-4 text-sm font-semibold text-cream">Modes de commande</h2>
              <div className="flex flex-1 items-center">
                <ApexDonutChart slices={orderTypeSlices} centerLabel="CA" valueFormat="eur" size={150} className="w-full" />
              </div>
            </section>

            <section className="flex min-h-[240px] flex-col rounded-2xl border border-white/10 bg-[#1A1412] p-5">
              <h2 className="mb-4 text-sm font-semibold text-cream">Modes de paiement</h2>
              <div className="flex flex-1 items-center">
                <ApexDonutChart slices={paymentSlices} centerLabel="CA" valueFormat="eur" size={150} className="w-full" />
              </div>
            </section>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <section className="flex min-h-[220px] flex-col rounded-2xl border border-white/10 bg-[#1A1412] p-5">
              <h2 className="mb-4 text-sm font-semibold text-cream">Heures de pointe</h2>
              {hourlyBars.series.length > 0 ? (
                <div className="flex flex-1 items-end">
                  <ApexBarChart categories={hourlyBars.categories} series={hourlyBars.series} color="#457B9D" height={180} className="w-full" />
                </div>
              ) : (
                <div className="flex flex-1 items-center justify-center">
                  <p className="text-sm text-cream/40">Aucune vente sur cette période</p>
                </div>
              )}
            </section>

            <section className="flex min-h-[220px] flex-col rounded-2xl border border-white/10 bg-[#1A1412] p-5">
              <h2 className="mb-4 text-sm font-semibold text-cream">Activité par jour de semaine</h2>
              <div className="flex flex-1 items-end">
                <ApexBarChart categories={dowBars.categories} series={dowBars.series} color="#2A9D8F" height={180} className="w-full" />
              </div>
            </section>
          </div>

          <AdminDataGridShell
            title="Ventes par article"
            table={itemsTable}
            recordCount={itemsTable.getFilteredRowModel().rows.length}
            search={itemSearch}
            onSearchChange={setItemSearch}
            searchPlaceholder="Article…"
            emptyMessage={
              items.length === 0 ? 'Aucune vente par article sur cette période' : 'Aucun résultat pour ce filtre'
            }
          />

          <div className={cn('grid gap-4', posEnabled && 'lg:grid-cols-2')}>
            {posEnabled && (
              <section className="rounded-2xl border border-white/10 bg-[#1A1412] p-5">
                <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-cream">
                  <Users className="h-4 w-4 text-tomato-light" />
                  Performance équipe (caisse)
                </h2>
                {employees.length === 0 ? (
                  <p className="py-6 text-center text-sm text-cream/40">Aucune vente caissier sur la période</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="text-xs text-cream/45">
                      <tr>
                        <th className="pb-2 text-left">Employé</th>
                        <th className="pb-2 text-right">Cmd.</th>
                        <th className="pb-2 text-right">CA</th>
                      </tr>
                    </thead>
                    <tbody>
                      {employees.map((e) => (
                        <tr key={e.id} className="border-t border-white/5">
                          <td className="py-2.5 text-cream">
                            {e.name}
                            <span className="ml-2 text-xs text-cream/35">{e.role}</span>
                          </td>
                          <td className="py-2.5 text-right tabular-nums text-cream/70">{e.orderCount}</td>
                          <td className="py-2.5 text-right font-medium tabular-nums text-tomato-light">
                            {formatEUR(e.totalSales)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>
            )}

            <section className="rounded-2xl border border-white/10 bg-[#1A1412] p-5">
              <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-cream">
                <UserCircle className="h-4 w-4 text-sky-300" />
                Performance livreurs
              </h2>
              {drivers.length === 0 ? (
                <p className="py-6 text-center text-sm text-cream/40">Aucune livraison assignée sur la période</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-xs text-cream/45">
                    <tr>
                      <th className="pb-2 text-left">Livreur</th>
                      <th className="pb-2 text-right">Courses</th>
                      <th className="pb-2 text-right">Livrées</th>
                      <th className="pb-2 text-right">CA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {drivers.map((d) => (
                      <tr key={d.id} className="border-t border-white/5">
                        <td className="py-2.5 text-cream">{d.name}</td>
                        <td className="py-2.5 text-right tabular-nums text-cream/70">{d.deliveryCount}</td>
                        <td className="py-2.5 text-right tabular-nums text-emerald-300">{d.deliveredCount}</td>
                        <td className="py-2.5 text-right font-medium tabular-nums text-tomato-light">
                          {formatEUR(d.totalSales)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          </div>

          <AdminDataGridShell
            title="Détail journalier"
            table={dailyTable}
            recordCount={dailyTable.getFilteredRowModel().rows.length}
            search={dailySearch}
            onSearchChange={setDailySearch}
            searchPlaceholder="Date…"
            emptyMessage="Aucun résultat pour ce filtre"
          />
        </>
      )}

      {printPreview && (
        <AdminPrintPreview
          title={printPreview.title}
          html={printPreview.html}
          onClose={() => setPrintPreview(null)}
        />
      )}
    </div>
  )
}
