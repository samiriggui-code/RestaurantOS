'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Loader2, Lock, Receipt } from 'lucide-react'
import { AdminPageHeader, AdminPageShell } from '@/components/admin/AdminSectionTabs'
import { AdminStatCard, ADMIN_STAT_GRID } from '@/components/admin/AdminStatCard'
import { getStaffSession } from '@/lib/staff-auth'
import { staffFetch } from '@/lib/staff-api'
import { ORDER_CHANNEL_COLORS, orderChannelDisplayLabel } from '@/lib/admin-nav'
import { formatEUR } from '@/lib/money'
import { useAdminRefresh } from '@/components/admin/AdminLiveProvider'

type ChannelStat = { count: number; revenue: number }

type DashboardChannels = {
  todayRevenue: number
  todayPaidCount: number
  channelsToday: Record<string, ChannelStat>
}

const CHANNEL_ORDER = ['POS', 'WEB', 'DELIVEROO', 'UBER_EATS', 'KIOSK']

export function AdminCaisseView() {
  const [data, setData] = useState<DashboardChannels | null>(null)
  const [loading, setLoading] = useState(true)
  const today = new Date().toISOString().slice(0, 10)

  const load = useCallback(async () => {
    const session = getStaffSession()
    if (!session) return
    setLoading(true)
    try {
      const d = await staffFetch<DashboardChannels>('/reports/dashboard', { token: session.token })
      setData(d)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useAdminRefresh(['dashboard', 'orders'], load)

  const stats = useMemo(() => {
    if (!data) return null
    const channels = data.channelsToday ?? {}
    const total = data.todayRevenue || 1
    const cashEstimate = Math.round((channels.POS?.revenue ?? 0) * 0.4)
    const cardEstimate = data.todayRevenue - cashEstimate
    return { channels, total, cashEstimate, cardEstimate }
  }, [data])

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Caisse & Z du jour"
        subtitle={`Journal ${today} — consolidation tous canaux (POS, web, marketplaces).`}
        actions={
          <Link
            href="/admin/fiscal"
            className="inline-flex items-center gap-2 rounded-xl bg-tomato px-4 py-2 text-sm font-semibold text-white hover:bg-tomato/90"
          >
            <Lock className="h-4 w-4" /> Clôture fiscale ISCA
          </Link>
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
            <AdminStatCard label="Espèces (estim.)" value={formatEUR(stats.cashEstimate)} icon={Receipt} />
            <AdminStatCard label="CB / en ligne" value={formatEUR(stats.cardEstimate)} icon={Receipt} />
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
