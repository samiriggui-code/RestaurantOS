'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useFeedbackState } from '@/lib/use-feedback-state'
import { ChefHat, Loader2, Plus, Save, Trash2 } from 'lucide-react'
import { getStaffSession } from '@/lib/staff-auth'
import { staffFetch } from '@/lib/staff-api'
import { adminSelectClass } from '@/lib/admin-ui'
import { cn } from '@/lib/cn'

type RecipeMenuItem = {
  id: string
  name: string
  category: string
  isActive: boolean
  recipeLines: number
}

type RecipeRow = {
  id?: string
  stockItemId: string
  quantity: number
  stockItem?: { id: string; name: string; unit: string }
}

type DraftLine = {
  stockItemId: string
  quantity: number
}

type StockItemOption = {
  id: string
  name: string
  unit: string
  category: string
}

export function AdminStockRecipesPanel({
  stockItems,
  refreshKey = 0,
}: {
  stockItems: StockItemOption[]
  /** Incrémenter après sync-defaults pour recharger la liste menu */
  refreshKey?: number
}) {
  const [menuItems, setMenuItems] = useState<RecipeMenuItem[]>([])
  const [loadingList, setLoadingList] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [recipe, setRecipe] = useState<RecipeRow[]>([])
  const [loadingRecipe, setLoadingRecipe] = useState(false)
  const [saving, setSaving] = useState(false)
  const { error, setError, message, setMessage } = useFeedbackState()
  const [filter, setFilter] = useState('')

  const loadMenuItems = useCallback(() => {
    const session = getStaffSession()
    if (!session) return
    setLoadingList(true)
    staffFetch<RecipeMenuItem[]>('/stock/recipe-items', { token: session.token })
      .then((items) => {
        setMenuItems(items)
        setSelectedId((prev) => prev ?? items[0]?.id ?? null)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Erreur'))
      .finally(() => setLoadingList(false))
  }, [])

  useEffect(() => {
    loadMenuItems()
  }, [loadMenuItems, refreshKey])

  const loadRecipe = useCallback((menuItemId: string) => {
    const session = getStaffSession()
    if (!session) return
    setLoadingRecipe(true)
    setError(null)
    staffFetch<RecipeRow[]>(`/stock/recipes/${menuItemId}`, { token: session.token })
      .then(setRecipe)
      .catch((err) => setError(err instanceof Error ? err.message : 'Erreur'))
      .finally(() => setLoadingRecipe(false))
  }, [])

  useEffect(() => {
    if (selectedId) loadRecipe(selectedId)
    else setRecipe([])
  }, [selectedId, loadRecipe])

  const selectedItem = menuItems.find((m) => m.id === selectedId) ?? null

  const filteredMenu = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return menuItems
    return menuItems.filter(
      (m) => m.name.toLowerCase().includes(q) || m.category.toLowerCase().includes(q),
    )
  }, [menuItems, filter])

  const draftLines: DraftLine[] = recipe.map((r) => ({
    stockItemId: r.stockItemId,
    quantity: r.quantity,
  }))

  function updateLine(index: number, patch: Partial<DraftLine>) {
    setRecipe((prev) =>
      prev.map((row, i) =>
        i === index
          ? {
              ...row,
              stockItemId: patch.stockItemId ?? row.stockItemId,
              quantity: patch.quantity ?? row.quantity,
              stockItem:
                patch.stockItemId != null
                  ? stockItems.find((s) => s.id === patch.stockItemId) ?? row.stockItem
                  : row.stockItem,
            }
          : row,
      ),
    )
  }

  function addLine() {
    const first = stockItems[0]
    if (!first) return
    setRecipe((prev) => [
      ...prev,
      { stockItemId: first.id, quantity: 0.1, stockItem: { id: first.id, name: first.name, unit: first.unit } },
    ])
  }

  function removeLine(index: number) {
    setRecipe((prev) => prev.filter((_, i) => i !== index))
  }

  async function saveRecipe() {
    if (!selectedId) return
    const session = getStaffSession()
    if (!session) return
    const lines = draftLines.filter((l) => l.stockItemId && l.quantity > 0)
    const ids = lines.map((l) => l.stockItemId)
    if (new Set(ids).size !== ids.length) {
      setError('Ingrédient en double — chaque article stock ne peut apparaître qu’une fois.')
      return
    }
    setSaving(true)
    setMessage(null)
    setError(null)
    try {
      const saved = await staffFetch<RecipeRow[]>(`/stock/recipes/${selectedId}`, {
        method: 'PUT',
        token: session.token,
        body: JSON.stringify({ lines }),
      })
      setRecipe(saved)
      setMessage('Recette enregistrée.')
      loadMenuItems()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enregistrement impossible')
    } finally {
      setSaving(false)
    }
  }

  const activeMenu = menuItems.filter((m) => m.isActive)
  const withRecipe = activeMenu.filter((m) => m.recipeLines > 0).length
  const coveragePct =
    activeMenu.length === 0 ? 100 : Math.round((withRecipe / activeMenu.length) * 100)
  const withoutRecipe = activeMenu.filter((m) => m.recipeLines === 0).length

  if (loadingList) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-tomato-light" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {withoutRecipe > 0 && (
        <p className="rounded-xl border border-amber-500/25 bg-amber-950/30 px-4 py-2 text-sm text-amber-100">
          {withoutRecipe} produit(s) actif(s) sans recette BOM — la déduction auto ne s&apos;appliquera pas tant que les ingrédients ne sont pas définis.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-cream/70">
        <span>
          Couverture BOM :{' '}
          <strong className={coveragePct === 100 ? 'text-emerald-300' : 'text-amber-200'}>
            {coveragePct}%
          </strong>
        </span>
        <span className="text-cream/40">
          {withRecipe}/{activeMenu.length} produits actifs avec recette
        </span>
      </div>

      <p className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 px-4 py-2 text-xs text-emerald-100/85">
        Consommation automatique : à chaque vente encaissée (paiement en ligne, ou import CSV des ventes comptoir SumUp), les quantités ci-dessous sont sorties du stock selon ces recettes.
      </p>

      {error && (
        <p className="rounded-xl border border-red-500/30 bg-red-950/40 px-4 py-2 text-sm text-red-200">{error}</p>
      )}
      {message && (
        <p className="rounded-xl border border-emerald-500/25 bg-emerald-950/30 px-4 py-2 text-sm text-emerald-200">
          {message}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(220px,1fr)_minmax(0,2fr)]">
        <section className="rounded-2xl border border-white/10 bg-[#1A1412] p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-cream">
            <ChefHat className="h-4 w-4 text-tomato-light" />
            Produits menu
          </h2>
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filtrer…"
            className="mb-3 w-full rounded-xl border border-white/15 bg-charcoal px-3 py-2 text-sm text-cream"
          />
          <ul className="max-h-[420px] space-y-1 overflow-y-auto text-sm">
            {filteredMenu.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className={cn(
                    'w-full rounded-lg px-3 py-2 text-left transition',
                    selectedId === item.id ? 'bg-tomato/20 text-tomato-light' : 'hover:bg-white/5 text-cream/80',
                  )}
                >
                  <span className="font-medium">{item.name}</span>
                  <span className="mt-0.5 flex items-center gap-2 text-xs text-cream/40">
                    {item.category}
                    {item.recipeLines > 0 ? (
                      <span className="text-emerald-400">{item.recipeLines} ingr.</span>
                    ) : (
                      <span className="text-amber-400">Sans recette</span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-white/10 bg-[#1A1412] p-5">
          {!selectedItem ? (
            <p className="text-sm text-cream/45">Sélectionnez un produit.</p>
          ) : loadingRecipe ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-tomato-light" />
            </div>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-cream">{selectedItem.name}</h2>
                  <p className="text-xs text-cream/45">
                    Quantités consommées par unité vendue (ex. 0,12 kg mozzarella / pizza)
                  </p>
                </div>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void saveRecipe()}
                  className="inline-flex items-center gap-2 rounded-xl bg-tomato px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Enregistrer
                </button>
              </div>

              {stockItems.length === 0 ? (
                <p className="text-sm text-cream/45">Créez d&apos;abord des articles dans l&apos;inventaire.</p>
              ) : (
                <div className="space-y-3">
                  {recipe.length === 0 ? (
                    <p className="text-sm text-cream/40">Aucun ingrédient — ajoutez la première ligne.</p>
                  ) : (
                    recipe.map((line, index) => (
                      <div key={`${line.stockItemId}-${index}`} className="flex flex-wrap items-end gap-2">
                        <label className="min-w-[200px] flex-1 text-xs text-cream/50">
                          Ingrédient
                          <select
                            value={line.stockItemId}
                            onChange={(e) => updateLine(index, { stockItemId: e.target.value })}
                            className={cn(adminSelectClass, 'mt-1 w-full')}
                          >
                            {stockItems.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name} ({s.unit})
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="w-28 text-xs text-cream/50">
                          Qté / vente
                          <input
                            type="number"
                            step="0.001"
                            min="0.001"
                            value={line.quantity}
                            onChange={(e) => updateLine(index, { quantity: parseFloat(e.target.value) || 0 })}
                            className="mt-1 w-full rounded-xl border border-white/15 bg-charcoal px-3 py-2 text-sm text-cream"
                          />
                        </label>
                        <span className="pb-2 text-xs text-cream/40">
                          {line.stockItem?.unit ?? stockItems.find((s) => s.id === line.stockItemId)?.unit}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeLine(index)}
                          className="mb-1 rounded-lg p-2 text-cream/30 hover:bg-red-500/10 hover:text-red-400"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))
                  )}
                  <button
                    type="button"
                    onClick={addLine}
                    className="inline-flex items-center gap-2 text-sm text-tomato/90 hover:underline"
                  >
                    <Plus className="h-4 w-4" />
                    Ajouter un ingrédient
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  )
}
