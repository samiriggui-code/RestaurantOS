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
import { Gift, Loader2, Medal, Pizza, Save, Search, Trash2, TrendingUp, Users } from 'lucide-react'
import { getStaffSession } from '@/lib/staff-auth'
import { staffFetch } from '@/lib/staff-api'
import { useAppFeedback } from '@/components/feedback/AppFeedbackProvider'
import { AdminPageHeader, AdminSectionTabs } from '@/components/admin/AdminSectionTabs'
import { ADMIN_STAT_GRID, AdminStatCard } from '@/components/admin/AdminStatCard'
import { AdminDataGridShell, DataGridColumnHeader, createDefaultPagination } from '@/components/ui/data-grid'
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

type LoyaltyTab = 'program' | 'clients' | 'search'

const EXAMPLE_ORDER_EUR = 25

export function AdminLoyaltyView() {
  const [tab, setTab] = useState<LoyaltyTab>('program')
  const [program, setProgram] = useState<LoyaltyProgram | null>(null)
  const [customers, setCustomers] = useState<LoyaltyCustomer[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const { error, setError, message, setMessage } = useFeedbackState()
  const { confirm } = useAppFeedback()
  const [searchPhone, setSearchPhone] = useState('')
  const [searchResult, setSearchResult] = useState<LoyaltyCustomer | null | undefined>(undefined)
  const [manualPoints, setManualPoints] = useState(10)
  const [memberSearch, setMemberSearch] = useState('')
  const [memberSorting, setMemberSorting] = useState<SortingState>([])
  const [memberPagination, setMemberPagination] = useState<PaginationState>(() => createDefaultPagination())

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

  async function deleteCustomer(customer: LoyaltyCustomer) {
    const session = getStaffSession('crm')
    if (!session) return
    const ok = await confirm({
      title: 'Effacer ce client',
      message: `Supprimer définitivement ${customer.name ?? customer.phone} et son historique de points (${customer.totalPoints} pts) ? Action irréversible (droit à l'effacement RGPD).`,
      confirmLabel: 'Effacer',
      destructive: true,
    })
    if (!ok) return
    setBusy(`delete-${customer.id}`)
    try {
      await staffFetch(`/loyalty/customers/${customer.id}`, {
        method: 'DELETE',
        token: session.token,
        scope: 'crm',
      })
      setCustomers((prev) => prev.filter((c) => c.id !== customer.id))
      if (searchResult?.id === customer.id) setSearchResult(null)
      setMessage('Client fidélité effacé.')
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Suppression impossible')
    } finally {
      setBusy(null)
    }
  }

  const memberColumns = useMemo<ColumnDef<LoyaltyCustomer>[]>(
    () => [
      {
        id: 'client',
        accessorFn: (row) => `${row.name ?? ''} ${row.phone}`,
        header: ({ column }) => <DataGridColumnHeader title="Client" column={column} />,
        cell: ({ row }) => (
          <div>
            <p className="font-medium text-cream">{row.original.name ?? '—'}</p>
            <p className="text-xs text-cream/40">{row.original.phone}</p>
          </div>
        ),
      },
      {
        accessorKey: 'totalPoints',
        header: ({ column }) => <DataGridColumnHeader title="Points" column={column} />,
        cell: ({ row }) => (
          <span className="font-bold tabular-nums text-tomato-light">{row.original.totalPoints}</span>
        ),
      },
      {
        accessorKey: 'freePizzasAvailable',
        header: ({ column }) => <DataGridColumnHeader title="🍕 dispo" column={column} />,
        cell: ({ row }) => (
          <span className="text-emerald-300">{row.original.freePizzasAvailable ?? 0}</span>
        ),
      },
      {
        accessorKey: 'totalSpent',
        header: ({ column }) => <DataGridColumnHeader title="Dépenses" column={column} />,
        cell: ({ row }) => <span className="text-cream/50">{formatEUR(row.original.totalSpent)}</span>,
      },
      {
        accessorKey: 'visitCount',
        header: ({ column }) => <DataGridColumnHeader title="Visites" column={column} />,
        cell: ({ row }) => <span className="text-cream/50">{row.original.visitCount}</span>,
      },
      {
        id: 'rgpd',
        header: () => <span className="text-xs font-medium uppercase tracking-wide text-cream/45">RGPD</span>,
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <button
              type="button"
              title="Effacer ce client (RGPD)"
              disabled={busy === `delete-${row.original.id}`}
              onClick={() => void deleteCustomer(row.original)}
              className="inline-flex items-center gap-1 rounded-lg border border-red-500/25 px-2 py-1 text-xs font-medium text-red-300 hover:bg-red-500/10 disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ),
      },
    ],
    [busy],
  )

  const membersTable = useReactTable({
    data: customers,
    columns: memberColumns,
    state: { pagination: memberPagination, sorting: memberSorting, globalFilter: memberSearch },
    onPaginationChange: setMemberPagination,
    onSortingChange: setMemberSorting,
    onGlobalFilterChange: setMemberSearch,
    globalFilterFn: 'includesString',
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getRowId: (row) => row.id,
  })

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
          <AdminDataGridShell
            title="Membres"
            table={membersTable}
            recordCount={membersTable.getFilteredRowModel().rows.length}
            search={memberSearch}
            onSearchChange={setMemberSearch}
            searchPlaceholder="Nom, téléphone…"
            className="rounded-none border-0"
            emptyMessage={
              customers.length === 0
                ? 'Aucun membre — les clients sont inscrits à la première commande payée avec téléphone.'
                : 'Aucun résultat pour ce filtre'
            }
          />
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
                <button
                  type="button"
                  disabled={busy === `delete-${searchResult.id}`}
                  onClick={() => void deleteCustomer(searchResult)}
                  className="ml-auto inline-flex items-center gap-1 rounded-lg border border-red-500/25 px-3 py-1.5 text-sm font-medium text-red-300 hover:bg-red-500/10 disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Effacer (RGPD)
                </button>
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
