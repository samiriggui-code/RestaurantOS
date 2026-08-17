'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { BarChart3, Download, Loader2, Package, Printer, ShoppingCart, TrendingUp, UserCircle, Users, Wallet } from 'lucide-react'
import { AdminStatCard, ADMIN_STAT_GRID } from '@/components/admin/AdminStatCard'
import { AdminPageHeader } from '@/components/admin/AdminSectionTabs'
import { DonutChart, type DonutSlice } from '@/components/admin/charts/DonutChart'
import { MiniBarChart } from '@/components/admin/charts/MiniBarChart'
import { formatEUR } from '@/lib/money'
import { getStaffSession } from '@/lib/staff-auth'
import { staffFetch, staffFetchText } from '@/lib/staff-api'
import { CHART_COLORS, orderTypeLabel, paymentMethodLabel } from '@/lib/report-labels'
import { cn } from '@/lib/cn'
import { useAdminRefresh } from '@/components/admin/AdminLiveProvider'
import { downloadCsv } from '@/lib/export-csv'
import { AdminPrintPreview } from '@/components/admin/AdminPrintPreview'

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
  const [period, setPeriod] = useState('7')
  const [sales, setSales] = useState<SalesRow[]>([])
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [items, setItems] = useState<ItemRow[]>([])
  const [peak, setPeak] = useState<PeakHours | null>(null)
  const [paymentMethods, setPaymentMethods] = useState<Record<string, { count: number; revenue: number }>>({})
  const [orderTypes, setOrderTypes] = useState<Record<string, { count: number; revenue: number }>>({})
  const [employees, setEmployees] = useState<EmployeeRow[]>([])
  const [drivers, setDrivers] = useState<DriverRow[]>([])
  const [loading, setLoading] = useState(true)
  const [printPreview, setPrintPreview] = useState<{ html: string; title: string } | null>(null)
  const [printLoading, setPrintLoading] = useState(false)

  const load = useCallback(() => {
    const session = getStaffSession()
    if (!session) return
    const from = new Date()
    from.setDate(from.getDate() - parseInt(period, 10))
    const params = `from=${from.toISOString()}`
    setLoading(true)
    Promise.all([
      staffFetch<SalesRow[]>(`/reports/sales?${params}&groupBy=day`, { token: session.token }),
      staffFetch<CategoryRow[]>(`/reports/categories?${params}`, { token: session.token }),
      staffFetch<ItemRow[]>(`/reports/items-performance?${params}`, { token: session.token }),
      staffFetch<PeakHours>(`/reports/peak-hours?${params}`, { token: session.token }),
      staffFetch<Record<string, { count: number; revenue: number }>>(`/reports/payment-methods?${params}`, {
        token: session.token,
      }),
      staffFetch<Record<string, { count: number; revenue: number }>>(`/reports/order-types?${params}`, {
        token: session.token,
      }),
      staffFetch<EmployeeRow[]>(`/reports/employees?${params}`, { token: session.token }),
      staffFetch<DriverRow[]>(`/reports/drivers?${params}`, { token: session.token }),
    ])
      .then(([s, c, i, p, pm, ot, emp, drv]) => {
        setSales(s)
        setCategories(c.filter((x) => x.totalSold > 0).sort((a, b) => b.revenue - a.revenue))
        setItems(i)
        setPeak(p)
        setPaymentMethods(pm)
        setOrderTypes(ot)
        setEmployees(emp.filter((e) => e.orderCount > 0).sort((a, b) => b.totalSales - a.totalSales))
        setDrivers(drv.filter((d) => d.deliveryCount > 0).sort((a, b) => b.totalSales - a.totalSales))
      })
      .finally(() => setLoading(false))
  }, [period])

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
    () =>
      sales.map((d) => ({
        label: new Date(d.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
        value: d.total,
        color: '#E85D4C',
      })),
    [sales]
  )

  const hourlyBars = useMemo(() => {
    if (!peak) return []
    return peak.hourly
      .filter((h) => h.hour >= 17 && h.hour <= 23)
      .map((h) => ({
        label: `${h.hour}h`,
        value: h.count,
        color: '#457B9D',
      }))
  }, [peak])

  const dowBars = useMemo(() => {
    if (!peak) return []
    return peak.dow.map((d) => ({
      label: DOW_LABEL[d.day],
      value: d.count,
      color: '#2A9D8F',
    }))
  }, [peak])

  const maxItemQty = items[0]?.quantity ?? 1

  function exportReportCsv() {
    const dayRows = [...sales].reverse().map((row) => [
      new Date(row.date).toLocaleDateString('fr-FR'),
      String(row.count),
      (row.total / 100).toFixed(2),
      row.count > 0 ? ((row.total / row.count) / 100).toFixed(2) : '0',
    ])
    downloadCsv(
      `rapport-ca-${period}j-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Date', 'Commandes payées', 'CA EUR', 'Panier moyen EUR'],
      dayRows,
    )
  }

  async function exportReportPdf() {
    const session = getStaffSession()
    if (!session) return
    setPrintLoading(true)
    try {
      const html = await staffFetchText(`/reports/print?period=${period}`, { token: session.token })
      setPrintPreview({ html, title: `Rapport des ventes — ${period} jours` })
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
          <div className="flex flex-wrap gap-2">
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
            {[
              { v: '7', l: '7 jours' },
              { v: '30', l: '30 jours' },
              { v: '90', l: '90 jours' },
            ].map(({ v, l }) => (
              <button
                key={v}
                type="button"
                onClick={() => setPeriod(v)}
                className={cn(
                  'rounded-xl px-4 py-2 text-sm font-medium transition',
                  period === v ? 'bg-tomato text-white' : 'border border-white/15 text-cream/60 hover:bg-white/5'
                )}
              >
                {l}
              </button>
            ))}
          </div>
        }
      />

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-tomato-light" />
        </div>
      ) : (
        <>
          <div className={ADMIN_STAT_GRID}>
            <AdminStatCard
              label="Chiffre d'affaires"
              value={formatEUR(totalSales)}
              sub={`${period} derniers jours`}
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

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-2xl border border-white/10 bg-[#1A1412] p-5">
              <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-cream">
                <BarChart3 className="h-4 w-4 text-tomato-light" />
                CA par jour
              </h2>
              {salesBars.length > 0 ? (
                <MiniBarChart data={salesBars} height={140} formatValue={(v) => formatEUR(v)} />
              ) : (
                <p className="py-10 text-center text-sm text-cream/40">Aucune vente</p>
              )}
            </section>

            <section className="rounded-2xl border border-white/10 bg-[#1A1412] p-5">
              <h2 className="mb-4 text-sm font-semibold text-cream">CA par catégorie</h2>
              <DonutChart slices={categorySlices} centerLabel="Total" valueFormat="eur" size={150} />
            </section>

            <section className="rounded-2xl border border-white/10 bg-[#1A1412] p-5">
              <h2 className="mb-4 text-sm font-semibold text-cream">Modes de commande</h2>
              <DonutChart slices={orderTypeSlices} centerLabel="CA" valueFormat="eur" size={150} />
            </section>

            <section className="rounded-2xl border border-white/10 bg-[#1A1412] p-5">
              <h2 className="mb-4 text-sm font-semibold text-cream">Modes de paiement</h2>
              <DonutChart slices={paymentSlices} centerLabel="CA" valueFormat="eur" size={150} />
            </section>

            <section className="rounded-2xl border border-white/10 bg-[#1A1412] p-5">
              <h2 className="mb-4 text-sm font-semibold text-cream">Heures de pointe (17h–23h)</h2>
              <MiniBarChart data={hourlyBars} height={120} />
            </section>

            <section className="rounded-2xl border border-white/10 bg-[#1A1412] p-5">
              <h2 className="mb-4 text-sm font-semibold text-cream">Activité par jour de semaine</h2>
              <MiniBarChart data={dowBars} height={120} />
            </section>
          </div>

          <section className="rounded-2xl border border-white/10 bg-[#1A1412] p-5">
            <h2 className="mb-4 font-semibold text-cream">Ventes par article</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-cream/45">
                  <tr>
                    <th className="pb-3 font-medium">#</th>
                    <th className="pb-3 font-medium">Article</th>
                    <th className="pb-3 font-medium text-right">Qté</th>
                    <th className="pb-3 font-medium text-right">Commandes</th>
                    <th className="pb-3 font-medium text-right">CA</th>
                    <th className="pb-3 font-medium w-32">Part</th>
                  </tr>
                </thead>
                <tbody>
                  {items.slice(0, 25).map((item, idx) => {
                    const share = totalUnits > 0 ? (item.quantity / totalUnits) * 100 : 0
                    return (
                      <tr key={item.id} className="border-t border-white/5">
                        <td className="py-3 text-cream/35">{idx + 1}</td>
                        <td className="py-3 font-medium text-cream">{item.name}</td>
                        <td className="py-3 text-right tabular-nums text-cream/80">{item.quantity}</td>
                        <td className="py-3 text-right tabular-nums text-cream/50">{item.orders}</td>
                        <td className="py-3 text-right font-medium tabular-nums text-tomato-light">
                          {formatEUR(item.revenue)}
                        </td>
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                              <div
                                className="h-full rounded-full bg-tomato/80"
                                style={{ width: `${(item.quantity / maxItemQty) * 100}%` }}
                              />
                            </div>
                            <span className="w-10 text-right text-xs tabular-nums text-cream/40">
                              {share.toFixed(0)}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  {items.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-cream/40">
                        Aucune vente par article sur cette période
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
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

          <section className="rounded-2xl border border-white/10 bg-[#1A1412] p-5">
            <h2 className="mb-4 font-semibold text-cream">Détail journalier</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-cream/45">
                  <tr>
                    <th className="pb-2 font-medium">Date</th>
                    <th className="pb-2 font-medium text-right">Commandes</th>
                    <th className="pb-2 font-medium text-right">CA</th>
                    <th className="pb-2 font-medium text-right">Panier moy.</th>
                  </tr>
                </thead>
                <tbody>
                  {[...sales].reverse().map((row) => (
                    <tr key={row.date} className="border-t border-white/5">
                      <td className="py-2 text-cream/80">
                        {new Date(row.date).toLocaleDateString('fr-FR', {
                          weekday: 'short',
                          day: 'numeric',
                          month: 'short',
                        })}
                      </td>
                      <td className="py-2 text-right text-cream/60">{row.count}</td>
                      <td className="py-2 text-right font-medium text-tomato-light">
                        {formatEUR(row.total)}
                      </td>
                      <td className="py-2 text-right text-cream/50">
                        {row.count > 0 ? formatEUR(Math.round(row.total / row.count)) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
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
