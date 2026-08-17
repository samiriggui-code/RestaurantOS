'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useFeedbackState } from '@/lib/use-feedback-state'
import { Activity, Loader2, Plus, Power, QrCode, Wifi } from 'lucide-react'
import { getStaffSession } from '@/lib/staff-auth'
import { staffFetch } from '@/lib/staff-api'
import { AdminPageHeader, AdminSectionTabs } from '@/components/admin/AdminSectionTabs'
import { ADMIN_STAT_GRID, AdminStatCard } from '@/components/admin/AdminStatCard'
import { cn } from '@/lib/cn'

type WifiQr = {
  id: string
  code: string
  label: string | null
  durationMinutes: number
  maxSessions: number
  isActive: boolean
  createdAt: string
  _count?: { sessions: number }
  qrImage?: string
  qrUrl?: string
}

type WifiSession = {
  id: string
  status: string
  phoneNumber: string | null
  startTime: string
  endTime: string
  wifiQrCode: { label: string | null; code: string }
}

type WifiTab = 'overview' | 'codes' | 'sessions'

export function AdminWifiView({ embedded = false }: { embedded?: boolean }) {
  const [tab, setTab] = useState<WifiTab>('overview')
  const [codes, setCodes] = useState<WifiQr[]>([])
  const [sessions, setSessions] = useState<WifiSession[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const { error, setError } = useFeedbackState()
  const [newQr, setNewQr] = useState<WifiQr | null>(null)
  const [label, setLabel] = useState('Invités salle')

  const reload = useCallback(async () => {
    const session = getStaffSession('crm')
    if (!session) return
    setLoading(true)
    try {
      const [qrList, sessList] = await Promise.all([
        staffFetch<WifiQr[]>('/wifi/qr-codes', { token: session.token, scope: 'crm' }),
        staffFetch<WifiSession[]>('/wifi/sessions', { token: session.token, scope: 'crm' }),
      ])
      setCodes(qrList)
      setSessions(sessList)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const stats = useMemo(() => {
    const activeCodes = codes.filter((c) => c.isActive).length
    const activeSessions = sessions.filter((s) => s.status === 'ACTIVE').length
    const totalScans = codes.reduce((n, c) => n + (c._count?.sessions ?? 0), 0)
    return { activeCodes, activeSessions, totalScans, codes: codes.length }
  }, [codes, sessions])

  async function createCode() {
    const session = getStaffSession('crm')
    if (!session) return
    setBusy('create')
    setError(null)
    try {
      const created = await staffFetch<WifiQr>('/wifi/qr-codes', {
        method: 'POST',
        token: session.token,
        scope: 'crm',
        body: JSON.stringify({ label, durationMinutes: 120, maxSessions: 50 }),
      })
      setNewQr(created)
      setTab('codes')
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setBusy(null)
    }
  }

  async function toggleCode(id: string) {
    const session = getStaffSession('crm')
    if (!session) return
    setBusy(id)
    try {
      await staffFetch(`/wifi/qr-codes/${id}/toggle`, {
        method: 'PATCH',
        token: session.token,
        scope: 'crm',
      })
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setBusy(null)
    }
  }

  async function disconnectSession(id: string) {
    const session = getStaffSession('crm')
    if (!session) return
    setBusy(`sess-${id}`)
    try {
      await staffFetch(`/wifi/sessions/${id}/disconnect`, {
        method: 'PATCH',
        token: session.token,
        scope: 'crm',
      })
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setBusy(null)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-tomato-light" />
      </div>
    )
  }

  return (
    <div className={cn(embedded ? 'w-full space-y-4' : 'mx-auto max-w-5xl space-y-6 p-4 md:p-6')}>
      {!embedded && (
      <AdminPageHeader
        title="WiFi invité"
        description="Accès internet limité via QR — à connecter à votre box (MikroTik, UniFi…) côté VPS."
      />
      )}

      <AdminSectionTabs
        tabs={[
          { id: 'overview' as const, label: 'Vue d\'ensemble', icon: Activity },
          { id: 'codes' as const, label: 'QR codes', icon: QrCode, badge: codes.length },
          { id: 'sessions' as const, label: 'Sessions', icon: Wifi, badge: stats.activeSessions },
        ]}
        active={tab}
        onChange={setTab}
      />

      {error && (
        <p className="rounded-xl border border-red-500/30 bg-red-950/40 px-4 py-2 text-sm text-red-200">{error}</p>
      )}

      <div className={ADMIN_STAT_GRID}>
        <AdminStatCard label="QR actifs" value={stats.activeCodes} icon={QrCode} tone="text-emerald-300" />
        <AdminStatCard label="Sessions live" value={stats.activeSessions} icon={Wifi} />
        <AdminStatCard label="Connexions totales" value={stats.totalScans} sub="Historique cumulé" />
        <AdminStatCard label="Codes créés" value={stats.codes} />
      </div>

      {tab === 'overview' && (
        <section className="rounded-2xl border border-white/10 bg-[#1A1412] p-5 space-y-4">
          <h2 className="font-semibold text-cream">Créer un QR invité</h2>
          <p className="text-sm text-cream/45">
            Imprimez le QR en salle ou sur les tables. Le client scanne → page /wifi → session limitée dans le temps.
          </p>
          <div className="flex flex-wrap gap-2">
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Libellé (ex. Terrasse)"
              className="flex-1 min-w-[160px] rounded-xl border border-white/15 bg-charcoal px-3 py-2 text-sm"
            />
            <button
              type="button"
              disabled={busy === 'create'}
              onClick={() => void createCode()}
              className="inline-flex items-center gap-2 rounded-xl bg-tomato px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              Générer QR
            </button>
          </div>
          {newQr?.qrImage && (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={newQr.qrImage} alt="QR WiFi" className="h-40 w-40 rounded-lg bg-white p-2" />
              <p className="font-mono text-xs text-cream/50">{newQr.qrUrl}</p>
            </div>
          )}
        </section>
      )}

      {tab === 'codes' && (
        <section className="rounded-2xl border border-white/10 bg-[#1A1412] p-5">
          {codes.length === 0 ? (
            <p className="text-sm text-cream/40">Aucun code — créez-en un depuis Vue d&apos;ensemble.</p>
          ) : (
            <ul className="divide-y divide-white/10">
              {codes.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                  <div>
                    <p className="font-medium text-cream">{c.label ?? c.code}</p>
                    <p className="text-xs text-cream/40">
                      {c.durationMinutes} min · max {c.maxSessions} · {c._count?.sessions ?? 0} connexions
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busy === c.id}
                    onClick={() => void toggleCode(c.id)}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium',
                      c.isActive
                        ? 'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25'
                        : 'bg-white/10 text-cream/50 hover:bg-white/15',
                    )}
                  >
                    <Power className="h-3.5 w-3.5" />
                    {c.isActive ? 'Actif' : 'Inactif'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === 'sessions' && (
        <section className="rounded-2xl border border-white/10 bg-[#1A1412] p-5">
          {sessions.length === 0 ? (
            <p className="text-sm text-cream/40">Aucune session récente.</p>
          ) : (
            <ul className="divide-y divide-white/10 text-sm">
              {sessions.slice(0, 30).map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div>
                    <p className="text-cream">{s.wifiQrCode.label ?? s.wifiQrCode.code}</p>
                    <p className="text-xs text-cream/40">
                      {s.phoneNumber ?? 'Anonyme'} · {new Date(s.startTime).toLocaleString('fr-FR')}
                      {s.status === 'ACTIVE' && (
                        <span className="ml-2 text-emerald-400">● active</span>
                      )}
                    </p>
                  </div>
                  {s.status === 'ACTIVE' && (
                    <button
                      type="button"
                      disabled={busy === `sess-${s.id}`}
                      onClick={() => void disconnectSession(s.id)}
                      className="rounded-lg border border-red-500/30 px-2 py-1 text-xs text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                    >
                      Couper
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}
