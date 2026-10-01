'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useFeedbackState } from '@/lib/use-feedback-state'
import Link from 'next/link'
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
  ArrowDownCircle,
  ArrowUpCircle,
  Boxes,
  ChefHat,
  Edit2,
  History,
  Loader2,
  Package,
  Plus,
  RefreshCw,
  Trash2,
  TrendingDown,
  Upload,
  X,
} from 'lucide-react'
import { eurosToCents, formatEUR } from '@/lib/money'
import { getStaffSession } from '@/lib/staff-auth'
import { staffFetch } from '@/lib/staff-api'
import { AdminStatCard, ADMIN_STAT_GRID } from '@/components/admin/AdminStatCard'
import { AdminPageHeader, AdminPageShell, AdminSectionTabs } from '@/components/admin/AdminSectionTabs'
import { AdminStockRecipesPanel } from '@/components/admin/AdminStockRecipesPanel'
import { AdminSumupImportPanel } from '@/components/admin/AdminSumupImportPanel'
import { adminFieldClass, adminSelectClass } from '@/lib/admin-ui'
import {
  AdminDataGridShell,
  DataGridColumnHeader,
  createDefaultPagination,
} from '@/components/ui/data-grid'
import { cn } from '@/lib/cn'
import { useAdminRefresh } from '@/components/admin/AdminLiveProvider'
import { useAdminFeedback } from '@/components/admin/AdminFeedbackProvider'

type StockMovement = {
  id: string
  type: string
  quantity: number
  note: string | null
  orderId: string | null
  createdAt: string
}

type StockItem = {
  id: string
  name: string
  category: string
  unit: string
  quantity: number
  reorderAt: number | null
  costCents: number
  isActive: boolean
  movements?: StockMovement[]
}

const STOCK_CATEGORIES = [
  'Tous',
  'Fromages',
  'Viandes',
  'Légumes',
  'Bases',
  'Pâte',
  'Boissons',
  'Emballage',
  'Hygiène',
  'Divers',
] as const

const CATEGORY_TONE: Record<string, string> = {
  Fromages: 'bg-amber-500/15 text-amber-200',
  Viandes: 'bg-red-500/15 text-red-200',
  Légumes: 'bg-emerald-500/15 text-emerald-200',
  Bases: 'bg-orange-500/15 text-orange-200',
  Pâte: 'bg-yellow-500/15 text-yellow-200',
  Boissons: 'bg-sky-500/15 text-sky-200',
  Emballage: 'bg-violet-500/15 text-violet-200',
  Hygiène: 'bg-teal-500/15 text-teal-200',
  Divers: 'bg-white/10 text-cream/60',
}

const MOVE_TYPES = [
  { id: 'IN', label: 'Réception', icon: ArrowUpCircle, tone: 'text-emerald-300' },
  { id: 'OUT', label: 'Sortie cuisine', icon: ArrowDownCircle, tone: 'text-sky-300' },
  { id: 'WASTE', label: 'Perte / casse', icon: TrendingDown, tone: 'text-red-300' },
  { id: 'ADJUST', label: 'Inventaire (ajust.)', icon: RefreshCw, tone: 'text-amber-300' },
] as const

const fieldClass = `${adminFieldClass} mt-1`

function stockLevel(item: StockItem): 'ok' | 'low' | 'critical' {
  if (item.reorderAt == null) return 'ok'
  if (item.quantity <= item.reorderAt * 0.5) return 'critical'
  if (item.quantity <= item.reorderAt) return 'low'
  return 'ok'
}

type StockTab = 'inventory' | 'recipes' | 'sumup-import'

export function AdminStockView() {
  const { confirm, notifySuccess, notifyError } = useAdminFeedback()
  const [tab, setTab] = useState<StockTab>('inventory')
  const [busy, setBusy] = useState<string | null>(null)
  const [items, setItems] = useState<StockItem[]>([])
  const [recipesRefreshKey, setRecipesRefreshKey] = useState(0)
  const [loading, setLoading] = useState(true)
  const { error, setError } = useFeedbackState()
  const [filter, setFilter] = useState<string>('Tous')
  const [globalFilter, setGlobalFilter] = useState('')
  const [pagination, setPagination] = useState<PaginationState>(() => createDefaultPagination())
  const [sorting, setSorting] = useState<SortingState>([])
  const [showForm, setShowForm] = useState(false)
  const [editTarget, setEditTarget] = useState<StockItem | null>(null)
  const [moveTarget, setMoveTarget] = useState<StockItem | null>(null)
  const [historyTarget, setHistoryTarget] = useState<StockItem | null>(null)

  const load = useCallback(() => {
    const session = getStaffSession()
    if (!session) return
    setLoading(true)
    staffFetch<StockItem[]>('/stock', { token: session.token })
      .then(setItems)
      .catch((err) => setError(err instanceof Error ? err.message : 'Erreur'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useAdminRefresh('stock', load)

  const filtered = useMemo(
    () => (filter === 'Tous' ? items : items.filter((i) => i.category === filter)),
    [items, filter]
  )

  const lowStock = items.filter((i) => stockLevel(i) !== 'ok')
  const stockValue = items.reduce((s, i) => s + i.quantity * i.costCents, 0)
  const categoriesUsed = new Set(items.map((i) => i.category)).size

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const session = getStaffSession()
    if (!session) return
    const form = new FormData(e.currentTarget)
    try {
      await staffFetch('/stock', {
        method: 'POST',
        token: session.token,
        body: JSON.stringify({
          name: form.get('name'),
          category: form.get('category'),
          unit: form.get('unit'),
          quantity: parseFloat(String(form.get('quantity'))) || 0,
          reorderAt: parseFloat(String(form.get('reorderAt'))) || null,
          costCents: eurosToCents(parseFloat(String(form.get('cost'))) || 0),
        }),
      })
      setShowForm(false)
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Création impossible')
    }
  }

  async function handleUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!editTarget) return
    const session = getStaffSession()
    if (!session) return
    const form = new FormData(e.currentTarget)
    try {
      await staffFetch(`/stock/${editTarget.id}`, {
        method: 'PUT',
        token: session.token,
        body: JSON.stringify({
          name: form.get('name'),
          category: form.get('category'),
          unit: form.get('unit'),
          reorderAt: parseFloat(String(form.get('reorderAt'))) || null,
          costCents: eurosToCents(parseFloat(String(form.get('cost'))) || 0),
        }),
      })
      setEditTarget(null)
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Mise à jour impossible')
    }
  }

  async function handleMove(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!moveTarget) return
    const session = getStaffSession()
    if (!session) return
    const form = new FormData(e.currentTarget)
    try {
      await staffFetch(`/stock/${moveTarget.id}/move`, {
        method: 'POST',
        token: session.token,
        body: JSON.stringify({
          type: form.get('type'),
          quantity: parseFloat(String(form.get('quantity'))),
          note: form.get('note') || null,
        }),
      })
      setMoveTarget(null)
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Mouvement impossible')
    }
  }

  async function handleDelete(id: string) {
    if (
      !(await confirm({
        title: 'Supprimer l\'article',
        message: 'Supprimer cet article de stock ? Les mouvements associés seront perdus.',
        confirmLabel: 'Supprimer',
        destructive: true,
      }))
    ) {
      return
    }
    const session = getStaffSession()
    if (!session) return
    try {
      await staffFetch(`/stock/${id}`, { method: 'DELETE', token: session.token })
      notifySuccess('Article supprimé.')
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Suppression impossible')
    }
  }

  const columns = useMemo<ColumnDef<StockItem>[]>(
    () => [
      {
        accessorKey: 'name',
        header: ({ column }) => <DataGridColumnHeader title="Article" column={column} />,
        cell: ({ row }) => (
          <div className="min-w-[180px]">
            <p className="font-medium text-cream">{row.original.name}</p>
            {row.original.movements?.[0] && (
              <p className="mt-0.5 text-[10px] text-cream/35">
                Dernier : {MOVE_TYPES.find((t) => t.id === row.original.movements![0].type)?.label ?? row.original.movements![0].type}
                {row.original.movements[0].orderId ? (
                  <>
                    {' · '}
                    <Link
                      href={`/admin/orders?order=${row.original.movements[0].orderId}`}
                      className="text-tomato/80 hover:underline"
                    >
                      cmd. auto
                    </Link>
                  </>
                ) : null}
              </p>
            )}
          </div>
        ),
      },
      {
        accessorKey: 'category',
        header: ({ column }) => <DataGridColumnHeader title="Catégorie" column={column} />,
        cell: ({ row }) => {
          const tone = CATEGORY_TONE[row.original.category] ?? CATEGORY_TONE.Divers
          return (
            <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase', tone)}>
              {row.original.category}
            </span>
          )
        },
      },
      {
        id: 'quantity',
        accessorFn: (row) => row.quantity,
        header: ({ column }) => <DataGridColumnHeader title="Stock" column={column} />,
        cell: ({ row }) => {
          const level = stockLevel(row.original)
          return (
            <span
              className={cn(
                'font-bold tabular-nums',
                level === 'critical' ? 'text-red-300' : level === 'low' ? 'text-amber-300' : 'text-cream'
              )}
            >
              {row.original.quantity}{' '}
              <span className="text-xs font-normal text-cream/45">{row.original.unit}</span>
            </span>
          )
        },
      },
      {
        id: 'reorderAt',
        accessorFn: (row) => row.reorderAt ?? -1,
        header: ({ column }) => <DataGridColumnHeader title="Seuil" column={column} />,
        cell: ({ row }) =>
          row.original.reorderAt != null ? (
            <span className="tabular-nums text-cream/60">
              {row.original.reorderAt} {row.original.unit}
            </span>
          ) : (
            '—'
          ),
      },
      {
        id: 'costCents',
        accessorFn: (row) => row.costCents,
        header: ({ column }) => <DataGridColumnHeader title="Coût unit." column={column} />,
        cell: ({ row }) => formatEUR(row.original.costCents),
      },
      {
        id: 'value',
        accessorFn: (row) => row.quantity * row.costCents,
        header: ({ column }) => <DataGridColumnHeader title="Valeur" column={column} />,
        cell: ({ row }) => (
          <span className="font-medium text-cream/80">
            {formatEUR(Math.round(row.original.quantity * row.original.costCents))}
          </span>
        ),
      },
      {
        id: 'status',
        header: 'Statut',
        enableSorting: false,
        cell: ({ row }) => {
          const level = stockLevel(row.original)
          if (level === 'critical')
            return <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-xs text-red-300">Critique</span>
          if (level === 'low')
            return <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-300">Bas</span>
          return <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-300">OK</span>
        },
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">Actions</span>,
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex justify-end gap-1">
            <button
              type="button"
              onClick={() => setHistoryTarget(row.original)}
              className="rounded-lg p-1.5 text-cream/40 hover:bg-white/5 hover:text-cream"
              title="Historique des mouvements"
            >
              <History className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setEditTarget(row.original)}
              className="rounded-lg p-1.5 text-cream/40 hover:bg-white/5 hover:text-cream"
              title="Modifier"
            >
              <Edit2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setMoveTarget(row.original)}
              className="rounded-lg bg-white/[0.06] px-2.5 py-1.5 text-xs font-medium text-cream hover:bg-white/10"
            >
              Mouvement
            </button>
            <button
              type="button"
              onClick={() => void handleDelete(row.original.id)}
              className="rounded-lg p-1.5 text-cream/30 hover:bg-red-500/10 hover:text-red-400"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ),
      },
    ],
    []
  )

  const table = useReactTable({
    data: filtered,
    columns,
    state: { pagination, sorting, globalFilter },
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: 'includesString',
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getRowId: (row) => row.id,
  })

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-tomato-light" />
      </div>
    )
  }

  return (
    <AdminPageShell maxWidth="7xl">
      <AdminPageHeader
        title="Stock pizzeria"
        description="Fromages, boissons, emballage — seuils d'alerte, mouvements et valorisation inventaire."
        actions={
          tab === 'inventory' ? (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-tomato px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-tomato/20 hover:bg-tomato-dark"
          >
            <Plus className="h-4 w-4" />
            Nouvel article
          </button>
          ) : null
        }
      />

      <AdminSectionTabs
        tabs={[
          { id: 'inventory' as const, label: 'Inventaire', icon: Package },
          { id: 'recipes' as const, label: 'Recettes (BOM)', icon: ChefHat },
          { id: 'sumup-import' as const, label: 'Import Caisse SumUp', icon: Upload },
        ]}
        active={tab}
        onChange={setTab}
      />

      {error && (
        <p className="rounded-xl border border-red-500/30 bg-red-950/40 px-4 py-2 text-sm text-red-200">
          {error}
        </p>
      )}

      {tab === 'recipes' ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-cream/50">
              Recettes manquantes ? Synchronisez le BOM par défaut (pizzas + boissons).
            </p>
            <button
              type="button"
              disabled={busy === 'sync-recipes'}
              onClick={() => {
                const session = getStaffSession()
                if (!session) return
                setBusy('sync-recipes')
                staffFetch('/stock/recipes/sync-defaults', { method: 'POST', token: session.token })
                  .then(() => {
                    notifySuccess('Recettes synchronisées.')
                    setRecipesRefreshKey((k) => k + 1)
                  })
                  .catch((e) => notifyError(e instanceof Error ? e.message : 'Erreur'))
                  .finally(() => setBusy(null))
              }}
              className="rounded-xl border border-white/15 px-3 py-2 text-xs text-cream hover:bg-white/5 disabled:opacity-50"
            >
              {busy === 'sync-recipes' ? 'Sync…' : 'Sync recettes par défaut'}
            </button>
          </div>
          <AdminStockRecipesPanel
            refreshKey={recipesRefreshKey}
            stockItems={items.map((i) => ({ id: i.id, name: i.name, unit: i.unit, category: i.category }))}
          />
        </div>
      ) : tab === 'sumup-import' ? (
        <AdminSumupImportPanel />
      ) : (
        <>
      <p className="rounded-xl border border-emerald-500/20 bg-emerald-950/25 px-4 py-2.5 text-sm text-emerald-100/90">
        À chaque commande confirmée ou payée, les ingrédients des recettes (BOM) sont déduits automatiquement.
        Définissez les recettes dans l&apos;onglet <strong>Recettes (BOM)</strong> pour activer le suivi.
      </p>
      <div className={ADMIN_STAT_GRID}>
        <AdminStatCard label="Articles actifs" value={items.length} sub={`${categoriesUsed} catégories`} icon={Package} />
        <AdminStatCard
          label="Alertes stock"
          value={lowStock.length}
          sub={lowStock.length ? 'Sous le seuil' : 'Tout est OK'}
          icon={AlertTriangle}
          tone={lowStock.length ? 'text-amber-300' : 'text-emerald-300'}
        />
        <AdminStatCard label="Valeur estimée" value={formatEUR(Math.round(stockValue))} sub="Qté × coût unitaire" icon={Boxes} />
        <AdminStatCard
          label="Boissons & emballage"
          value={items.filter((i) => ['Boissons', 'Emballage'].includes(i.category)).length}
          sub="Comptoir / livraison"
          icon={Package}
          tone="text-sky-300"
        />
      </div>

      {lowStock.length > 0 && (
        <div className="flex flex-wrap items-start gap-3 rounded-2xl border border-amber-500/25 bg-gradient-to-r from-amber-950/40 to-transparent px-4 py-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
          <div>
            <p className="text-sm font-medium text-amber-100">
              {lowStock.length} article{lowStock.length > 1 ? 's' : ''} à réapprovisionner
            </p>
            <p className="mt-1 text-xs text-amber-200/70">
              {lowStock.map((i) => i.name).join(' · ')}
            </p>
          </div>
        </div>
      )}

      <AdminDataGridShell
        title="Inventaire"
        subtitle="Niveaux, alertes et mouvements par article"
        table={table}
        recordCount={table.getFilteredRowModel().rows.length}
        search={globalFilter}
        onSearchChange={setGlobalFilter}
        searchPlaceholder="Rechercher un article…"
        emptyMessage={
          items.length === 0
            ? 'Aucun article — npm run seed:ops pour le stock démo'
            : 'Aucun résultat pour ce filtre'
        }
        headerExtra={
          <select
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value)
              setPagination((p) => ({ ...p, pageIndex: 0 }))
            }}
            className={adminSelectClass}
          >
            {STOCK_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        }
      />

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <form
            onSubmit={(e) => void handleCreate(e)}
            className="w-full max-w-md rounded-2xl border border-white/10 bg-[#1A1412] p-6 shadow-2xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold text-cream">Nouvel article stock</h3>
              <button type="button" onClick={() => setShowForm(false)}>
                <X className="h-5 w-5 text-cream/40" />
              </button>
            </div>
            <div className="space-y-3">
              <label className="block text-xs text-cream/50">
                Nom
                <input name="name" required className={fieldClass} placeholder="Mozzarella 2,5 kg" />
              </label>
              <label className="block text-xs text-cream/50">
                Catégorie
                <select name="category" defaultValue="Fromages" className={adminSelectClass}>
                  {STOCK_CATEGORIES.filter((c) => c !== 'Tous').map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs text-cream/50">
                Unité
                <input name="unit" defaultValue="kg" className={fieldClass} />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs text-cream/50">
                  Quantité initiale
                  <input name="quantity" type="number" step="0.01" defaultValue="0" className={fieldClass} />
                </label>
                <label className="block text-xs text-cream/50">
                  Seuil alerte
                  <input name="reorderAt" type="number" step="0.01" className={fieldClass} />
                </label>
              </div>
              <label className="block text-xs text-cream/50">
                Coût unitaire (€)
                <input name="cost" type="number" step="0.01" defaultValue="0" className={fieldClass} />
              </label>
            </div>
            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="flex-1 rounded-xl border border-white/15 py-2 text-sm"
              >
                Annuler
              </button>
              <button type="submit" className="flex-1 rounded-xl bg-tomato py-2 text-sm font-semibold text-white">
                Créer
              </button>
            </div>
          </form>
        </div>
      )}

      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <form
            onSubmit={(e) => void handleUpdate(e)}
            className="w-full max-w-md rounded-2xl border border-white/10 bg-[#1A1412] p-6 shadow-2xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold text-cream">Modifier l&apos;article</h3>
              <button type="button" onClick={() => setEditTarget(null)}>
                <X className="h-5 w-5 text-cream/40" />
              </button>
            </div>
            <div className="space-y-3">
              <label className="block text-xs text-cream/50">
                Nom
                <input name="name" required defaultValue={editTarget.name} className={fieldClass} />
              </label>
              <label className="block text-xs text-cream/50">
                Catégorie
                <select name="category" defaultValue={editTarget.category} className={adminSelectClass}>
                  {STOCK_CATEGORIES.filter((c) => c !== 'Tous').map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs text-cream/50">
                Unité
                <input name="unit" defaultValue={editTarget.unit} className={fieldClass} />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs text-cream/50">
                  Seuil alerte
                  <input
                    name="reorderAt"
                    type="number"
                    step="0.01"
                    defaultValue={editTarget.reorderAt ?? ''}
                    className={fieldClass}
                  />
                </label>
                <label className="block text-xs text-cream/50">
                  Coût unitaire (€)
                  <input
                    name="cost"
                    type="number"
                    step="0.01"
                    defaultValue={(editTarget.costCents / 100).toFixed(2)}
                    className={fieldClass}
                  />
                </label>
              </div>
              <p className="text-xs text-cream/40">
                Stock actuel : {editTarget.quantity} {editTarget.unit} — utilisez « Mouvement » pour ajuster la quantité.
              </p>
            </div>
            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={() => setEditTarget(null)}
                className="flex-1 rounded-xl border border-white/15 py-2 text-sm"
              >
                Annuler
              </button>
              <button type="submit" className="flex-1 rounded-xl bg-tomato py-2 text-sm font-semibold text-white">
                Enregistrer
              </button>
            </div>
          </form>
        </div>
      )}

      {historyTarget && (
        <StockHistoryModal item={historyTarget} onClose={() => setHistoryTarget(null)} />
      )}

      {moveTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <form
            onSubmit={(e) => void handleMove(e)}
            className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#1A1412] p-6 shadow-2xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-cream">Mouvement stock</h3>
                <p className="text-xs text-cream/45">{moveTarget.name}</p>
              </div>
              <button type="button" onClick={() => setMoveTarget(null)}>
                <X className="h-5 w-5 text-cream/40" />
              </button>
            </div>
            <div className="space-y-3">
              <label className="block text-xs text-cream/50">
                Type
                <select name="type" defaultValue="IN" className={adminSelectClass}>
                  {MOVE_TYPES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs text-cream/50">
                Quantité ({moveTarget.unit})
                <input name="quantity" type="number" step="0.01" min="0.01" required className={fieldClass} />
              </label>
              <label className="block text-xs text-cream/50">
                Note (optionnel)
                <input name="note" className={fieldClass} placeholder="Livraison Metro, casse…" />
              </label>
            </div>
            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={() => setMoveTarget(null)}
                className="flex-1 rounded-xl border border-white/15 py-2 text-sm"
              >
                Annuler
              </button>
              <button type="submit" className="flex-1 rounded-xl bg-tomato py-2 text-sm font-semibold text-white">
                Valider
              </button>
            </div>
          </form>
        </div>
      )}
        </>
      )}
    </AdminPageShell>
  )
}

/** Historique complet des mouvements d'un article — la liste principale n'en garde que 5. */
function StockHistoryModal({ item, onClose }: { item: StockItem; onClose: () => void }) {
  const [movements, setMovements] = useState<StockMovement[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const session = getStaffSession()
    if (!session) return
    let cancelled = false
    staffFetch<{ movements: StockMovement[] }>(`/stock/${item.id}/movements`, { token: session.token })
      .then((data) => {
        if (!cancelled) setMovements(data.movements)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Chargement impossible')
      })
    return () => {
      cancelled = true
    }
  }, [item.id])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-2xl border border-white/10 bg-[#1A1412] p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-cream">Historique des mouvements</h3>
            <p className="text-xs text-cream/45">{item.name}</p>
          </div>
          <button type="button" onClick={onClose}>
            <X className="h-5 w-5 text-cream/40" />
          </button>
        </div>

        {error && <p className="text-sm text-red-300">{error}</p>}
        {!error && movements === null && (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-cream/40" />
          </div>
        )}
        {!error && movements?.length === 0 && (
          <p className="py-8 text-center text-sm text-cream/40">Aucun mouvement enregistré.</p>
        )}
        {!error && movements && movements.length > 0 && (
          <div className="-mr-2 space-y-2 overflow-y-auto pr-2">
            {movements.map((m) => {
              const meta = MOVE_TYPES.find((t) => t.id === m.type)
              const Icon = meta?.icon ?? RefreshCw
              const sign = m.type === 'IN' ? '+' : m.type === 'ADJUST' ? '=' : '−'
              return (
                <div
                  key={m.id}
                  className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2.5"
                >
                  <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', meta?.tone ?? 'text-cream/40')} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-cream">{meta?.label ?? m.type}</span>
                      <span className={cn('text-sm font-mono', meta?.tone ?? 'text-cream/70')}>
                        {sign}
                        {m.quantity} {item.unit}
                      </span>
                    </div>
                    <p className="text-xs text-cream/40">
                      {new Date(m.createdAt).toLocaleString('fr-FR', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      {m.note ? ` · ${m.note}` : ''}
                    </p>
                    {m.orderId && (
                      <Link
                        href={`/admin/orders?order=${m.orderId}`}
                        className="text-xs text-tomato-light hover:underline"
                      >
                        Voir la commande →
                      </Link>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
