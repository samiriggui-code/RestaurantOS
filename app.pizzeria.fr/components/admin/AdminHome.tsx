'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useFeedbackState } from '@/lib/use-feedback-state'
import Link from 'next/link'
import {
  Globe,
  Loader2,
  ShoppingBag,
  Store,
  TrendingUp,
  UtensilsCrossed,
  Wallet,
} from 'lucide-react'
import { DeviceLaunchCards } from '@/components/ops/DeviceLaunchCards'
import { AdminStatCard, ADMIN_STAT_GRID } from '@/components/admin/AdminStatCard'
import { DonutChart, type DonutSlice } from '@/components/admin/charts/DonutChart'
import { MiniBarChart } from '@/components/admin/charts/MiniBarChart'
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
import { cn } from '@/lib/cn'
import { useAdminRefresh } from '@/components/admin/AdminLiveProvider'

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
  salesByDay: { date: string; count: number; total: number }[]
  recentOrders: OpsOrder[]
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

  const load = useCallback(() => {
    const session = getStaffSession()
    if (!session) return
    setLoading(true)
    staffFetch<DashboardData>('/reports/dashboard', { token: session.token })
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Chargement impossible'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useAdminRefresh(['dashboard', 'orders'], load)

  const orderTypeSlices = useMemo(
    () => (data ? recordToDonut(data.orderTypes, orderTypeLabel, true) : []),
    [data]
  )
  const paymentSlices = useMemo(
    () => (data ? recordToDonut(data.paymentMethods, paymentMethodLabel, true) : []),
    [data]
  )

  const weekBars = useMemo(() => {
    if (!data) return []
    return data.salesByDay.map((d) => ({
      label: new Date(d.date).toLocaleDateString('fr-FR', { weekday: 'short' }).slice(0, 3),
      value: d.total,
      color: '#E85D4C',
    }))
  }, [data])

  const hourlyBars = useMemo(() => {
    if (!data) return []
    return data.hourlyToday.map((h) => ({
      label: `${h.hour}h`,
      value: h.count,
      color: '#2A9D8F',
    }))
  }, [data])

  const topItemSlices: DonutSlice[] = useMemo(() => {
    if (!data?.topItemsToday.length) return []
    return data.topItemsToday.slice(0, 6).map((item, i) => ({
      label: item.name.length > 22 ? `${item.name.slice(0, 20)}…` : item.name,
      value: item.quantity,
      color: CHART_COLORS[i % CHART_COLORS.length],
    }))
  }, [data])

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-tomato-light" />
      </div>
    )
  }

  const orders = data?.recentOrders ?? []

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-cream">Tableau de bord</h1>
          <p className="text-sm text-cream/50">Activité du jour — La Z Pizza</p>
        </div>
        <Link
          href="/admin/reports"
          className="rounded-xl border border-white/15 px-4 py-2 text-sm text-cream/70 hover:bg-white/5"
        >
          Rapports détaillés →
        </Link>
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
          label="Commandes aujourd'hui"
          value={data?.todayOrders ?? 0}
          sub={`${data?.todayPaidCount ?? 0} payées`}
          icon={ShoppingBag}
        />
        <AdminStatCard
          label="CA du jour"
          value={formatEUR(data?.todayRevenue ?? 0)}
          sub={`Panier moy. ${formatEUR(data?.avgBasketToday ?? 0)}`}
          icon={Wallet}
          tone="text-emerald-300"
        />
        <AdminStatCard
          label="Canaux"
          value={`${data?.onlineToday ?? 0} / ${data?.counterToday ?? 0}`}
          sub="En ligne · Comptoir"
          icon={Globe}
          tone="text-sky-300"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <section className="rounded-2xl border border-white/10 bg-[#1A1412] p-5 lg:col-span-1">
          <h2 className="mb-4 text-sm font-semibold text-cream">CA — 7 derniers jours</h2>
          <MiniBarChart data={weekBars} height={120} formatValue={(v) => formatEUR(v)} />
        </section>

        <section className="rounded-2xl border border-white/10 bg-[#1A1412] p-5">
          <h2 className="mb-4 text-sm font-semibold text-cream">Modes de commande (jour)</h2>
          <DonutChart
            slices={orderTypeSlices}
            centerLabel="CA"
            valueFormat="eur"
            size={140}
          />
        </section>

        <section className="rounded-2xl border border-white/10 bg-[#1A1412] p-5">
          <h2 className="mb-4 text-sm font-semibold text-cream">Paiements (jour)</h2>
          <DonutChart slices={paymentSlices} centerLabel="CA" valueFormat="eur" size={140} />
        </section>

        <section className="rounded-2xl border border-white/10 bg-[#1A1412] p-5">
          <h2 className="mb-4 text-sm font-semibold text-cream">Commandes par heure (18h–23h)</h2>
          <MiniBarChart data={hourlyBars} height={100} />
        </section>

        <section className="rounded-2xl border border-white/10 bg-[#1A1412] p-5 lg:col-span-2">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-cream">
            <TrendingUp className="h-4 w-4 text-tomato-light" />
            Top articles vendus aujourd&apos;hui
          </h2>
          {topItemSlices.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2">
              <DonutChart slices={topItemSlices} centerLabel="Unités" valueFormat="number" size={150} />
              <ul className="space-y-2">
                {data?.topItemsToday.slice(0, 8).map((item, i) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between rounded-xl bg-white/[0.03] px-3 py-2 text-sm"
                  >
                    <span className="flex items-center gap-2 text-cream/80">
                      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/5 text-xs font-bold text-cream/40">
                        {i + 1}
                      </span>
                      {item.name}
                    </span>
                    <span className="tabular-nums text-tomato-light">
                      {item.quantity} · {formatEUR(item.revenue)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-cream/40">Pas encore de ventes aujourd&apos;hui</p>
          )}
        </section>
      </div>

      <section className="space-y-3">
        <h2 className="font-semibold text-cream">Apps opérationnelles</h2>
        <p className="text-sm text-cream/45">
          Quatre apps isolées — caisse, cuisine, livreur, totem. Ouvrir en plein écran ou télécharger
          l&apos;APK.
        </p>
        <DeviceLaunchCards />
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-semibold text-cream">
            <Store className="h-4 w-4 text-cream/40" />
            Dernières commandes
          </h2>
          <Link href="/admin/orders" className="text-sm text-tomato-light hover:underline">
            Voir tout →
          </Link>
        </div>
        <div className="overflow-hidden rounded-2xl border border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/5 text-cream/45">
              <tr>
                <th className="px-4 py-3 font-medium">N°</th>
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="px-4 py-3 font-medium">Mode</th>
                <th className="px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3 font-medium">Paiement</th>
                <th className="px-4 py-3 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {orders.slice(0, 10).map((order) => (
                <tr key={order.id} className="border-t border-white/5 hover:bg-white/[0.02]">
                  <td className="px-4 py-3 font-semibold text-cream">#{order.orderNumber}</td>
                  <td className="px-4 py-3 text-cream/80">{orderCustomerLine(order)}</td>
                  <td className="px-4 py-3 text-cream/60">
                    {ORDER_TYPE_LABEL[order.type] ?? order.type}
                    {order.isOnlineOrder && (
                      <span className="ml-1 text-[10px] text-sky-400">web</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={order.status} />
                  </td>
                  <td className="px-4 py-3 text-cream/60">
                    {PAYMENT_STATUS_LABEL[order.paymentStatus] ?? order.paymentStatus}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-tomato-light">
                    {formatEUR(order.total)}
                  </td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-cream/40">
                    <ShoppingBag className="mx-auto mb-2 h-8 w-8 opacity-40" />
                    Aucune commande
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
