'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, Loader2, TrendingDown, TrendingUp, Wallet } from 'lucide-react'
import { AdminStatCard, ADMIN_STAT_GRID } from '@/components/admin/AdminStatCard'
import { formatEUR } from '@/lib/money'
import { getStaffSession } from '@/lib/staff-auth'
import { staffFetch } from '@/lib/staff-api'
import { useAdminRefresh } from '@/components/admin/AdminLiveProvider'

type SalesVsExpenses = {
  sales: { onlineCents: number; counterCents: number; totalCents: number }
  expenses: { manualCents: number; supplierInvoicesCents: number; totalCents: number }
  netCents: number
  losses: { cancelledOrdersCount: number; cancelledOrdersValueCents: number }
}

type SalesVsExpensesCardsProps = {
  /** Bornes ISO à passer telles quelles à l'API ; par défaut 7 derniers jours (compat). */
  range?: { dateFrom?: string; dateTo?: string }
  periodLabel?: string
}

/** Aperçu compact ventes/dépenses/pertes sur la période sélectionnée. Détail complet dans Rapports. */
export function SalesVsExpensesCards({ range, periodLabel = '7 derniers jours' }: SalesVsExpensesCardsProps) {
  const [data, setData] = useState<SalesVsExpenses | null>(null)
  const [loading, setLoading] = useState(true)

  const load = () => {
    const session = getStaffSession()
    if (!session) return
    setLoading(true)
    const params = new URLSearchParams()
    if (range?.dateFrom) params.set('from', range.dateFrom)
    if (range?.dateTo) params.set('to', range.dateTo)
    if (!range?.dateFrom && !range?.dateTo) params.set('period', '7')
    staffFetch<SalesVsExpenses>(`/reports/sales-vs-expenses?${params.toString()}`, { token: session.token })
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [range?.dateFrom, range?.dateTo])
  useAdminRefresh(['reports', 'orders', 'dashboard'], load)

  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 font-semibold text-cream">
        <Wallet className="h-4 w-4 text-tomato-light" />
        Ventes vs dépenses — {periodLabel}
      </h2>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-tomato-light" />
        </div>
      ) : !data ? (
        <p className="py-6 text-center text-sm text-cream/40">Données indisponibles</p>
      ) : (
        <div className={ADMIN_STAT_GRID}>
          <AdminStatCard
            label="Ventes"
            value={formatEUR(data.sales.totalCents)}
            sub={`En ligne ${formatEUR(data.sales.onlineCents)} · Comptoir ${formatEUR(data.sales.counterCents)}`}
            icon={TrendingUp}
            tone="text-emerald-300"
          />
          <AdminStatCard
            label="Dépenses"
            value={formatEUR(data.expenses.totalCents)}
            sub={`Manuelles ${formatEUR(data.expenses.manualCents)} · Fournisseurs ${formatEUR(data.expenses.supplierInvoicesCents)}`}
            icon={TrendingDown}
            tone="text-amber-300"
          />
          <AdminStatCard
            label="Résultat net"
            value={formatEUR(data.netCents)}
            sub={periodLabel}
            icon={Wallet}
            tone={data.netCents >= 0 ? 'text-emerald-300' : 'text-red-300'}
          />
          <AdminStatCard
            label="Pertes (commandes annulées)"
            value={formatEUR(data.losses.cancelledOrdersValueCents)}
            sub={`${data.losses.cancelledOrdersCount} commande(s)`}
            icon={AlertTriangle}
            tone={data.losses.cancelledOrdersCount > 0 ? 'text-red-300' : undefined}
          />
        </div>
      )}
    </section>
  )
}
