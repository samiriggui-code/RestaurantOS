'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useFeedbackState } from '@/lib/use-feedback-state'
import { Gift, Loader2, Medal, Pizza, Save, Search, TrendingUp, Users } from 'lucide-react'
import { getStaffSession } from '@/lib/staff-auth'
import { staffFetch } from '@/lib/staff-api'
import { AdminPageHeader, AdminSectionTabs } from '@/components/admin/AdminSectionTabs'
import { ADMIN_STAT_GRID, AdminStatCard } from '@/components/admin/AdminStatCard'
import { formatEUR } from '@/lib/money'
import { cn } from '@/lib/cn'

type LoyaltyProgram = {
  id: string
  name: string
  pointsPerDinar: number
  pointsForFreePizza: number
  minPointsRedeem: number
  enabled: boolean
  rewardLabel?: string
}

type LoyaltyTransaction = {
  id: string
  type: string
  points: number
  description?: string | null
  createdAt: string
}

type LoyaltyCustomer = {
  id: string
  phone: string
  name: string | null
  totalPoints: number
  totalSpent: number
  visitCount: number
  lastVisit: string | null
  freePizzasAvailable?: number
  pointsUntilFreePizza?: number
  transactions?: LoyaltyTransaction[]
  _count?: { transactions: number }
}

const MEMBERS_PAGE_SIZE = 25

type LoyaltyTab = 'program' | 'clients' | 'search'

const EXAMPLE_ORDER_EUR = 25

export function AdminLoyaltyView() {
  const [tab, setTab] = useState<LoyaltyTab>('program')
  const [program, setProgram] = useState<LoyaltyProgram | null>(null)
  const [customers, setCustomers] = useState<LoyaltyCustomer[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const { error, setError, message, setMessage } = useFeedbackState()
  const [searchPhone, setSearchPhone] = useState('')
  const [searchResult, setSearchResult] = useState<LoyaltyCustomer | null | undefined>(undefined)
  const [manualPoints, setManualPoints] = useState(10)
  const [memberPage, setMemberPage] = useState(0)

  const reload = useCallback(async () => {
    const session = getStaffSession('crm')
    if (!session) return
    setLoading(true)
    try {
      const [prog, cust] = await Promise.all([
        staffFetch<LoyaltyProgram>('/loyalty/program', { token: session.token, scope: 'crm' }),
        staffFetch<LoyaltyCustomer[]>('/loyalty/customers', { token: session.token, scope: 'crm' }),
      ])
      setProgram(prog)
      setCustomers(cust)
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
    const totalPoints = customers.reduce((n, c) => n + c.totalPoints, 0)
    const totalSpent = customers.reduce((n, c) => n + c.totalSpent, 0)
    const freePizzasReady = customers.reduce((n, c) => n + (c.freePizzasAvailable ?? 0), 0)
    return { members: customers.length, totalPoints, totalSpent, freePizzasReady }
  }, [customers])

  const threshold = program?.pointsForFreePizza ?? program?.minPointsRedeem ?? 100
  const exampleEarn = program ? Math.round(EXAMPLE_ORDER_EUR * program.pointsPerDinar) : 0
  const exampleProgress = program
    ? Math.min(100, Math.round((exampleEarn / threshold) * 100))
    : 0

  async function saveProgram(e: React.FormEvent) {
    e.preventDefault()
    if (!program) return
    const session = getStaffSession('crm')
    if (!session) return
    setBusy('save')
    try {
      const updated = await staffFetch<LoyaltyProgram>('/loyalty/program', {
        method: 'PUT',
        token: session.token,
        scope: 'crm',
        body: JSON.stringify({
          ...program,
          pointsForFreePizza: threshold,
          minPointsRedeem: threshold,
        }),
      })
      setProgram(updated)
      setMessage('Programme fidélité enregistré.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setBusy(null)
    }
  }

  async function searchCustomer() {
    if (!searchPhone.trim()) return
    const session = getStaffSession('crm')
    if (!session) return
    setBusy('search')
    setSearchResult(undefined)
    try {
      const found = await staffFetch<LoyaltyCustomer | null>(
        `/loyalty/customers/search?phone=${encodeURIComponent(searchPhone.trim())}`,
        { token: session.token, scope: 'crm' },
      )
      setSearchResult(found)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setBusy(null)
    }
  }

  async function addPoints(customerId: string) {
    const session = getStaffSession('crm')
    if (!session) return
    setBusy(`add-${customerId}`)
    try {
      await staffFetch('/loyalty/points/add', {
        method: 'POST',
        token: session.token,
        scope: 'crm',
        body: JSON.stringify({ customerId, points: manualPoints, description: 'Ajustement CRM' }),
      })
      setMessage(`${manualPoints} points ajoutés.`)
      await reload()
      if (searchResult?.id === customerId) await searchCustomer()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setBusy(null)
    }
  }

  async function redeemPizza(customerId: string) {
    const session = getStaffSession('crm')
    if (!session) return
    setBusy(`redeem-${customerId}`)
    try {
      const res = await staffFetch<{ message: string }>('/loyalty/points/redeem-pizza', {
        method: 'POST',
        token: session.token,
        scope: 'crm',
        body: JSON.stringify({ customerId }),
      })
      setMessage(res.message ?? '1 pizza offerte enregistrée.')
      await reload()
      if (searchResult?.id === customerId) await searchCustomer()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échange impossible')
    } finally {
      setBusy(null)
    }
  }

  const memberPages = Math.max(1, Math.ceil(customers.length / MEMBERS_PAGE_SIZE))
  const pagedCustomers = customers.slice(
    memberPage * MEMBERS_PAGE_SIZE,
    memberPage * MEMBERS_PAGE_SIZE + MEMBERS_PAGE_SIZE,
  )

  if (loading || !program) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-tomato-light" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <AdminPageHeader
        title="Fidélité clients"
        description="1 pizza offerte — pas de réduction en euros. Les points sont crédités automatiquement à chaque commande payée (téléphone requis)."
      />

      <AdminSectionTabs
        tabs={[
          { id: 'program' as const, label: 'Programme', icon: Medal },
          { id: 'clients' as const, label: 'Membres', icon: Users, badge: customers.length },
          { id: 'search' as const, label: 'Recherche', icon: Search },
        ]}
        active={tab}
        onChange={setTab}
      />

      {error && (
        <p className="rounded-xl border border-red-500/30 bg-red-950/40 px-4 py-2 text-sm text-red-200">{error}</p>
      )}
      {message && (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-200">
          {message}
        </p>
      )}

      <div className={ADMIN_STAT_GRID}>
        <AdminStatCard
          label="Programme"
          value={program.enabled ? 'Actif' : 'Inactif'}
          tone={program.enabled ? 'text-emerald-300' : 'text-cream/45'}
          icon={Medal}
        />
        <AdminStatCard label="Membres" value={stats.members} icon={Users} />
        <AdminStatCard label="Points en circulation" value={stats.totalPoints} icon={TrendingUp} />
        <AdminStatCard
          label="Pizzas à offrir"
          value={stats.freePizzasReady}
          sub="Solde membres"
          icon={Pizza}
        />
      </div>

      {tab === 'program' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <form
            onSubmit={(e) => void saveProgram(e)}
            className="rounded-2xl border border-white/10 bg-[#1A1412] p-5 space-y-4"
          >
            <h2 className="font-semibold text-cream">Règles du programme</h2>
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <input
                type="checkbox"
                checked={program.enabled}
                onChange={(e) => setProgram((p) => (p ? { ...p, enabled: e.target.checked } : p))}
                className="h-5 w-5 rounded border-white/20"
              />
              <span className="text-sm text-cream/80">Programme actif — crédit auto sur commandes payées</span>
            </label>
            <label className="block text-sm text-cream/60">
              Points gagnés par euro dépensé
              <input
                type="number"
                step="0.1"
                min="0.1"
                value={program.pointsPerDinar}
                onChange={(e) =>
                  setProgram((p) => (p ? { ...p, pointsPerDinar: Number(e.target.value) } : p))
                }
                className="mt-1 w-full rounded-xl border border-white/15 bg-charcoal px-3 py-2 text-cream"
              />
            </label>
            <label className="block text-sm text-cream/60">
              Points pour <strong className="text-tomato-light">1 pizza offerte</strong>
              <input
                type="number"
                min="1"
                value={threshold}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  setProgram((p) =>
                    p ? { ...p, pointsForFreePizza: v, minPointsRedeem: v } : p,
                  )
                }}
                className="mt-1 w-full rounded-xl border border-white/15 bg-charcoal px-3 py-2 text-cream"
              />
            </label>
            <p className="text-xs text-cream/45">
              Récompense = une pizza au choix (taille selon votre politique en caisse), pas d&apos;avoir en
              euros.
            </p>
            <button
              type="submit"
              disabled={busy === 'save'}
              className="inline-flex items-center gap-2 rounded-xl bg-tomato px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              Enregistrer
            </button>
          </form>

          <div className="rounded-2xl border border-tomato/20 bg-tomato/[0.04] p-5 space-y-3">
            <h2 className="flex items-center gap-2 font-semibold text-cream">
              <Pizza className="h-5 w-5 text-tomato-light" />
              Exemple concret
            </h2>
            <p className="text-sm text-cream/55">
              Un client commande pour <strong className="text-cream">{EXAMPLE_ORDER_EUR} €</strong> :
            </p>
            <ul className="space-y-2 text-sm text-cream/70">
              <li className="flex justify-between rounded-lg bg-black/20 px-3 py-2">
                <span>Points gagnés</span>
                <span className="font-bold text-tomato-light">+{exampleEarn} pts</span>
              </li>
              <li className="rounded-lg bg-black/20 px-3 py-2">
                <div className="mb-1 flex justify-between">
                  <span>Progression vers 1 pizza</span>
                  <span className="font-bold text-emerald-300">{threshold} pts</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all"
                    style={{ width: `${exampleProgress}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-cream/40">
                  Après ~{Math.ceil(threshold / Math.max(exampleEarn, 1))} commandes de {EXAMPLE_ORDER_EUR} €
                  → 1 pizza offerte
                </p>
              </li>
            </ul>
            <p className="text-xs text-cream/40">
              Formule : points = montant € × {program.pointsPerDinar} · échange = {threshold} pts → 🍕
              gratuite
            </p>
          </div>
        </div>
      )}

      {tab === 'clients' && (
        <section className="rounded-2xl border border-white/10 bg-[#1A1412] overflow-hidden">
          {customers.length === 0 ? (
            <p className="p-8 text-center text-sm text-cream/40">
              Aucun membre — les clients sont inscrits à la première commande payée avec téléphone.
            </p>
          ) : (
            <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wide text-cream/40">
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Points</th>
                  <th className="px-4 py-3 hidden sm:table-cell">🍕 dispo</th>
                  <th className="px-4 py-3 hidden md:table-cell">Dépenses</th>
                  <th className="px-4 py-3 hidden lg:table-cell">Visites</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {pagedCustomers.map((c) => (
                  <tr key={c.id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <p className="font-medium text-cream">{c.name ?? '—'}</p>
                      <p className="text-xs text-cream/40">{c.phone}</p>
                    </td>
                    <td className="px-4 py-3 font-bold tabular-nums text-tomato-light">{c.totalPoints}</td>
                    <td className="px-4 py-3 hidden sm:table-cell text-emerald-300">
                      {c.freePizzasAvailable ?? 0}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-cream/50">
                      {formatEUR(c.totalSpent / 100)}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-cream/50">{c.visitCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {memberPages > 1 && (
              <div className="flex items-center justify-between border-t border-white/10 px-4 py-3 text-sm">
                <span className="text-cream/45">
                  {memberPage * MEMBERS_PAGE_SIZE + 1}–{Math.min((memberPage + 1) * MEMBERS_PAGE_SIZE, customers.length)} sur {customers.length}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={memberPage === 0}
                    onClick={() => setMemberPage((p) => p - 1)}
                    className="rounded-lg border border-white/15 px-3 py-1 disabled:opacity-40"
                  >
                    Préc.
                  </button>
                  <button
                    type="button"
                    disabled={memberPage >= memberPages - 1}
                    onClick={() => setMemberPage((p) => p + 1)}
                    className="rounded-lg border border-white/15 px-3 py-1 disabled:opacity-40"
                  >
                    Suiv.
                  </button>
                </div>
              </div>
            )}
            </>
          )}
        </section>
      )}

      {tab === 'search' && (
        <section className="rounded-2xl border border-white/10 bg-[#1A1412] p-5 space-y-4">
          <h2 className="font-semibold text-cream">Rechercher un client</h2>
          <div className="flex flex-wrap gap-2">
            <input
              value={searchPhone}
              onChange={(e) => setSearchPhone(e.target.value)}
              placeholder="06 12 34 56 78"
              className="flex-1 min-w-[180px] rounded-xl border border-white/15 bg-charcoal px-3 py-2 text-sm text-cream"
            />
            <button
              type="button"
              disabled={busy === 'search'}
              onClick={() => void searchCustomer()}
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm hover:bg-white/5 disabled:opacity-50"
            >
              <Search className="h-4 w-4" />
              Chercher
            </button>
          </div>

          {searchResult && (
            <div className="rounded-xl border border-white/10 bg-charcoal p-4">
              <p className="font-medium text-cream">{searchResult.name ?? searchResult.phone}</p>
              <p className="mt-1 text-sm text-cream/50">
                {searchResult.totalPoints} pts
                {(searchResult.freePizzasAvailable ?? 0) > 0 && (
                  <span className="ml-2 text-emerald-300">
                    · {searchResult.freePizzasAvailable} pizza(s) à offrir
                  </span>
                )}
                {(searchResult.pointsUntilFreePizza ?? 0) > 0 && (
                  <span className="ml-2 text-cream/40">
                    · encore {searchResult.pointsUntilFreePizza} pts
                  </span>
                )}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input
                  type="number"
                  value={manualPoints}
                  onChange={(e) => setManualPoints(Number(e.target.value))}
                  className="w-24 rounded-lg border border-white/15 bg-[#1A1412] px-2 py-1.5 text-sm text-cream"
                />
                <button
                  type="button"
                  disabled={busy === `add-${searchResult.id}`}
                  onClick={() => void addPoints(searchResult.id)}
                  className="rounded-lg bg-tomato/20 px-3 py-1.5 text-sm font-medium text-tomato-light hover:bg-tomato/30 disabled:opacity-50"
                >
                  Ajouter points
                </button>
                {(searchResult.freePizzasAvailable ?? 0) > 0 && (
                  <button
                    type="button"
                    disabled={busy === `redeem-${searchResult.id}`}
                    onClick={() => void redeemPizza(searchResult.id)}
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-600/80 px-3 py-1.5 text-sm font-bold text-white disabled:opacity-50"
                  >
                    <Gift className="h-3.5 w-3.5" />
                    Offrir 1 pizza
                  </button>
                )}
              </div>

              {searchResult.transactions && searchResult.transactions.length > 0 && (
                <div className="mt-4 border-t border-white/10 pt-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-cream/40">
                    Historique ({searchResult.transactions.length} derniers mouvements)
                  </p>
                  <ul className="max-h-48 space-y-2 overflow-y-auto text-sm">
                    {searchResult.transactions.map((tx) => (
                      <li
                        key={tx.id}
                        className="flex items-center justify-between gap-2 rounded-lg bg-white/[0.03] px-3 py-2"
                      >
                        <div>
                          <p className="text-cream/80">{tx.description ?? tx.type}</p>
                          <p className="text-xs text-cream/35">
                            {new Date(tx.createdAt).toLocaleString('fr-FR')}
                          </p>
                        </div>
                        <span
                          className={cn(
                            'font-bold tabular-nums',
                            tx.points >= 0 ? 'text-emerald-300' : 'text-amber-300',
                          )}
                        >
                          {tx.points >= 0 ? '+' : ''}
                          {tx.points} pts
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          {searchResult === null && searchPhone && busy !== 'search' && (
            <p className="text-sm text-cream/40">
              Aucun membre pour ce numéro — inscription à la prochaine commande payée.
            </p>
          )}
        </section>
      )}
    </div>
  )
}
