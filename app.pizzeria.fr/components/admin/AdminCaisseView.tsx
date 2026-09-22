'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Loader2, Lock, Receipt } from 'lucide-react'
import { AdminPageHeader, AdminPageShell } from '@/components/admin/AdminSectionTabs'
import { AdminStatCard, ADMIN_STAT_GRID } from '@/components/admin/AdminStatCard'
import { getStaffSession } from '@/lib/staff-auth'
import { staffFetch } from '@/lib/staff-api'
import { ORDER_CHANNEL_COLORS, orderChannelDisplayLabel } from '@/lib/admin-nav'
import { isModuleEnabled } from '@/lib/modules'
import { formatEUR } from '@/lib/money'
import { useAdminRefresh } from '@/components/admin/AdminLiveProvider'
import { PeriodPicker, defaultCustomRange } from '@/components/admin/PeriodPicker'
import { periodToDateRange, type ArchivePeriod, type CustomRange } from '@/lib/order-period'

type ChannelStat = { count: number; revenue: number }

type DashboardChannels = {
  todayRevenue: number
  todayPaidCount: number
  channelsToday: Record<string, ChannelStat>
  paymentMethods: Record<string, ChannelStat>
}

// Deliveroo/Uber Eats : intégration abandonnée (jamais de commande sur ce canal, quel que soit
// ENABLED_MODULES) — POS/Totem : uniquement si le module correspondant est actif, sinon ce
// sont deux lignes à 0 € en permanence sur un tableau de bord consulté tous les jours.
const CHANNEL_ORDER = [
  'SUMUP_COUNTER',
  ...(isModuleEnabled('pos') ? ['POS'] : []),
  'WEB',
  ...(isModuleEnabled('kiosk') ? ['KIOSK'] : []),
]

export function AdminCaisseView() {
  const [data, setData] = useState<DashboardChannels | null>(null)
  const [loading, setLoading] = useState(true)
  const today = new Date().toISOString().slice(0, 10)
  const [period, setPeriod] = useState<ArchivePeriod>('today')
  const [custom, setCustom] = useState<CustomRange>(() => defaultCustomRange())

  const range = useMemo(
    () => periodToDateRange(period, period === 'custom' ? custom : undefined),
    [period, custom],
  )

  const load = useCallback(async () => {
    const session = getStaffSession()
    if (!session) return
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (range.dateFrom) params.set('from', range.dateFrom)
      if (range.dateTo) params.set('to', range.dateTo)
      const d = await staffFetch<DashboardChannels>(`/reports/dashboard?${params.toString()}`, {
        token: session.token,
      })
      setData(d)
    } finally {
      setLoading(false)
    }
  }, [range])

  useEffect(() => {
    void load()
  }, [load])

  useAdminRefresh(['dashboard', 'orders'], load)

  const stats = useMemo(() => {
    if (!data) return null
    const channels = data.channelsToday ?? {}
    const methods = data.paymentMethods ?? {}
    const total = data.todayRevenue || 1
    // Espèces = commandes app en espèces + ventes comptoir SumUp réglées en espèces (montants
    // réels, plus d'estimation depuis que le comptoir SumUp remonte son propre détail paiement).
    const cash = methods.CASH?.revenue ?? 0
    const card = data.todayRevenue - cash
    return { channels, total, cash, card }
  }, [data])

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Caisse & Z du jour"
        subtitle={`Journal ${today} — consolidation tous canaux (POS, web, SumUp, marketplaces).`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <PeriodPicker period={period} custom={custom} onPeriodChange={setPeriod} onCustomChange={setCustom} />
            <Link
              href="/admin/fiscal"
              className="inline-flex items-center gap-2 rounded-xl bg-tomato px-4 py-2 text-sm font-semibold text-white hover:bg-tomato/90"
            >
              <Lock className="h-4 w-4" /> Clôture fiscale ISCA
            </Link>
          </div>
        }
      />

      {loading || !data || !stats ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-tomato-light" />
        </div>
      ) : (
        <>
          <div className={ADMIN_STAT_GRID}>
            <AdminStatCard label="CA TTC (payé)" value={formatEUR(data.todayRevenue)} icon={Receipt} tone="text-tomato-light" />
            <AdminStatCard label="Tickets payés" value={String(data.todayPaidCount)} icon={Receipt} />
            <AdminStatCard label="Espèces" value={formatEUR(stats.cash)} icon={Receipt} />
            <AdminStatCard label="CB / en ligne" value={formatEUR(stats.card)} icon={Receipt} />
          </div>

          <div className="mt-6 rounded-xl border border-white/10 bg-[#1A1412] p-5">
            <p className="mb-4 text-[10px] uppercase tracking-[0.25em] text-cream/40">CA par canal</p>
            {CHANNEL_ORDER.map((id) => {
              const row = stats.channels[id] ?? { count: 0, revenue: 0 }
              const pct = Math.round((row.revenue / stats.total) * 100)
              const color = ORDER_CHANNEL_COLORS[id] ?? '#888'
              return (
                <div key={id} className="mb-3 last:mb-0">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-cream/80">{orderChannelDisplayLabel(id)}</span>
                    <span className="font-mono text-cream/60">
                      {formatEUR(row.revenue)} · {row.count} ticket{row.count > 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/5">
                    <div className="h-full transition-all" style={{ width: `${pct}%`, background: color }} />
                  </div>
                </div>
              )
            })}
          </div>

          <p className="mt-4 text-xs text-cream/45">
            La clôture Z légale (signature, archivage) se fait dans{' '}
            <Link href="/admin/fiscal" className="text-tomato-light hover:underline">
              Fiscal ISCA
            </Link>
            . Cette page est un tableau de bord opérationnel du jour.
          </p>
        </>
      )}
    </AdminPageShell>
  )
}
