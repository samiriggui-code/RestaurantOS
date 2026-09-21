'use client'

import { useCallback, useEffect, useState } from 'react'
import { useFeedbackState } from '@/lib/use-feedback-state'
import { Edit2, Image, Loader2, Plus, ToggleLeft, ToggleRight, Trash2, X } from 'lucide-react'
import { resolveMenuItemImageUrl } from '@/lib/menu-image-url'
import { centsToEuros, eurosToCents, formatEUR } from '@/lib/money'
import { getStaffSession } from '@/lib/staff-auth'
import { staffFetch, staffUpload } from '@/lib/staff-api'
import { adminFieldClass } from '@/lib/admin-ui'
import { cn } from '@/lib/cn'
import { useAdminFeedback } from '@/components/admin/AdminFeedbackProvider'

/** Libellés compacts pour le bandeau d’onglets CRM (nom complet dans le panneau + tooltip). */
const CATEGORY_TAB_LABEL: Record<string, string> = {
  tomate: 'Base tomate',
  creme: 'Base crème',
  'z-pizzas': 'Z Pizzas',
  supplements: 'Suppléments',
  desserts: 'Desserts',
  boissons: 'Boissons',
  alcool: 'Alcool',
}

function categoryTabLabel(cat: MenuCategory): string {
  if (cat.slug && CATEGORY_TAB_LABEL[cat.slug]) return CATEGORY_TAB_LABEL[cat.slug]
  return cat.name.length > 16 ? `${cat.name.slice(0, 14)}…` : cat.name
}

const VAT_RATE_OPTIONS = [
  { bps: 550, label: '5,5 % (à emporter)' },
  { bps: 1000, label: '10 % (restauration)' },
  { bps: 2000, label: '20 % (alcool / standard)' },
] as const

function vatRateLabel(bps?: number | null): string {
  const opt = VAT_RATE_OPTIONS.find((o) => o.bps === bps)
  if (opt) return opt.label
  if (bps == null) return '10 %'
  return `${(bps / 100).toFixed(1).replace(/\.0$/, '')} %`
}

type MenuItem = {
  id: string
  name: string
  nameAr?: string | null
  price: number
  discountPrice?: number | null
  prepTime: number
  description?: string | null
  image?: string | null
  isAvailable: boolean
  isActive?: boolean
  categoryId: string
  sortOrder: number
  vatRateBps?: number
}

type MenuCategory = {
  id: string
  name: string
  nameAr?: string | null
  slug?: string | null
  sortOrder: number
  isActive?: boolean
  items: MenuItem[]
}

type MenuManageResponse = {
  categories: MenuCategory[]
  stats: {
    categories: number
    items: number
    expectedCategories: number
    expectedItems: number
  }
}

const fieldClass = adminFieldClass

export function AdminMenuView() {
  const { confirm, notifySuccess, notifyError } = useAdminFeedback()
  const [categories, setCategories] = useState<MenuCategory[]>([])
  const [menuStats, setMenuStats] = useState<MenuManageResponse['stats'] | null>(null)
  const [loading, setLoading] = useState(true)
  const { error, setError } = useFeedbackState()
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [showItemModal, setShowItemModal] = useState(false)
  const [editingCategory, setEditingCategory] = useState<MenuCategory | null>(null)
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null)
  const [itemImageFile, setItemImageFile] = useState<File | null>(null)
  const [itemImagePreview, setItemImagePreview] = useState<string | null>(null)
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null)
  const [defaultItemCategoryId, setDefaultItemCategoryId] = useState<string | undefined>(undefined)

  const loadMenu = useCallback(async () => {
    const session = getStaffSession('crm')
    if (!session) return
    try {
      const data = await staffFetch<MenuManageResponse>('/menu/categories/manage', {
        token: session.token,
      })
      setCategories(data.categories)
      setMenuStats(data.stats)
      setError(null)
      setActiveCategoryId((prev) => {
        if (prev && data.categories.some((c) => c.id === prev)) return prev
        return data.categories[0]?.id ?? null
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chargement impossible')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadMenu()
  }, [loadMenu])

  async function handleSaveCategory(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const session = getStaffSession('crm')
    if (!session) return
    const form = new FormData(e.currentTarget)
    const data = {
      name: form.get('name'),
      nameAr: form.get('nameAr') || form.get('name'),
      sortOrder: parseInt(form.get('sortOrder') as string, 10) || 0,
    }
    try {
      if (editingCategory) {
        await staffFetch(`/menu/categories/${editingCategory.id}`, {
          method: 'PUT',
          token: session.token,
          body: JSON.stringify(data),
        })
      } else {
        await staffFetch('/menu/categories', {
          method: 'POST',
          token: session.token,
          body: JSON.stringify(data),
        })
      }
      setShowCategoryModal(false)
      setEditingCategory(null)
      await loadMenu()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    }
  }

  async function handleSaveItem(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const session = getStaffSession('crm')
    if (!session) return
    const form = new FormData(e.currentTarget)
    const categoryId = (form.get('categoryId') as string) || categories[0]?.id
    if (!categoryId) return

    const data = {
      name: form.get('name'),
      nameAr: form.get('nameAr') || form.get('name'),
      price: eurosToCents(parseFloat(form.get('price') as string) || 0),
      discountPrice: form.get('discountPrice')
        ? eurosToCents(parseFloat(form.get('discountPrice') as string) || 0)
        : null,
      prepTime: parseInt(form.get('prepTime') as string, 10) || 15,
      description: form.get('description') || '',
      categoryId,
      sortOrder: parseInt(form.get('sortOrder') as string, 10) || 0,
      vatRateBps: parseInt(form.get('vatRateBps') as string, 10) || 1000,
    }

    try {
      let itemId = editingItem?.id
      if (editingItem) {
        await staffFetch(`/menu/items/${editingItem.id}`, {
          method: 'PUT',
          token: session.token,
          body: JSON.stringify(data),
        })
      } else {
        const created = await staffFetch<MenuItem>('/menu/items', {
          method: 'POST',
          token: session.token,
          body: JSON.stringify(data),
        })
        itemId = created.id
      }
      if (itemImageFile && itemId) {
        const fd = new FormData()
        fd.append('image', itemImageFile)
        await staffUpload(`/menu/items/${itemId}/image`, fd, session.token)
      }
      setShowItemModal(false)
      setEditingItem(null)
      setItemImageFile(null)
      setItemImagePreview(null)
      await loadMenu()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    }
  }

  async function handleDeleteCategory(id: string) {
    if (
      !(await confirm({
        title: 'Supprimer la catégorie',
        message: 'Supprimer cette catégorie ? Elle doit être vide — déplacez ou supprimez ses produits avant.',
        confirmLabel: 'Supprimer',
        destructive: true,
      }))
    ) {
      return
    }
    const session = getStaffSession('crm')
    if (!session) return
    try {
      await staffFetch(`/menu/categories/${id}`, { method: 'DELETE', token: session.token })
      notifySuccess('Catégorie supprimée.')
      await loadMenu()
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Suppression impossible')
    }
  }

  async function handleDeleteItem(id: string) {
    if (
      !(await confirm({
        title: 'Supprimer le produit',
        message: 'Supprimer ce produit du catalogue ?',
        confirmLabel: 'Supprimer',
        destructive: true,
      }))
    ) {
      return
    }
    const session = getStaffSession('crm')
    if (!session) return
    try {
      await staffFetch(`/menu/items/${id}`, { method: 'DELETE', token: session.token })
      notifySuccess('Produit supprimé.')
      await loadMenu()
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Suppression impossible')
    }
  }

  async function handleToggleItem(id: string) {
    const session = getStaffSession('crm')
    if (!session) return
    await staffFetch(`/menu/items/${id}/toggle`, { method: 'PATCH', token: session.token })
    await loadMenu()
  }

  async function handleToggleItemVisibility(id: string) {
    const session = getStaffSession('crm')
    if (!session) return
    await staffFetch(`/menu/items/${id}/visibility`, { method: 'PATCH', token: session.token })
    await loadMenu()
  }

  async function handleToggleCategory(id: string) {
    const session = getStaffSession('crm')
    if (!session) return
    await staffFetch(`/menu/categories/${id}/toggle`, { method: 'PATCH', token: session.token })
    await loadMenu()
  }

  async function handleBulkCategory(
    categoryId: string,
    payload: { isActive?: boolean; isAvailable?: boolean }
  ) {
    const session = getStaffSession('crm')
    if (!session) return
    await staffFetch(`/menu/categories/${categoryId}/bulk-items`, {
      method: 'PATCH',
      token: session.token,
      body: JSON.stringify(payload),
    })
    await loadMenu()
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-tomato-light" />
      </div>
    )
  }

  const activeCategory = categories.find((c) => c.id === activeCategoryId) ?? categories[0] ?? null

  function openNewItem(categoryId?: string) {
    setEditingItem(null)
    setDefaultItemCategoryId(categoryId ?? activeCategory?.id ?? categories[0]?.id)
    setShowItemModal(true)
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col p-4 md:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="admin-page-title">Gestion du menu</h1>
          <p className="admin-page-subtitle">Carte La Z Pizza</p>
          {menuStats && (
            <p className="mt-1 text-xs text-cream/40">
              {menuStats.items} produits actifs · {menuStats.categories} catégories
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setEditingCategory(null)
              setShowCategoryModal(true)
            }}
            className="rounded-xl border border-white/15 px-4 py-2 text-sm font-medium hover:bg-white/5"
          >
            <Plus className="mr-1 inline h-4 w-4" />
            Catégorie
          </button>
          <button
            type="button"
            onClick={() => openNewItem()}
            disabled={!categories.length}
            className="rounded-xl bg-tomato px-4 py-2 text-sm font-semibold text-white hover:bg-tomato-dark disabled:opacity-50"
          >
            <Plus className="mr-1 inline h-4 w-4" />
            Produit
          </button>
        </div>
      </div>

      {error && (
        <p className="mb-3 rounded-xl border border-red-500/30 bg-red-950/40 px-4 py-2 text-sm text-red-200">
          {error}
        </p>
      )}

      {categories.length === 0 ? (
        <p className="rounded-2xl border border-white/10 bg-[#1A1412] p-8 text-center text-sm text-cream/40">
          Aucune catégorie — créez-en une pour commencer.
        </p>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                title={cat.name}
                onClick={() => setActiveCategoryId(cat.id)}
                className={cn(
                  'flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors sm:px-2.5 sm:text-sm',
                  activeCategoryId === cat.id
                    ? 'bg-tomato/20 text-tomato-light'
                    : 'text-cream/55 hover:bg-white/5 hover:text-cream',
                  cat.isActive === false && activeCategoryId !== cat.id && 'opacity-60',
                )}
              >
                {categoryTabLabel(cat)}
                <span className="rounded-full bg-white/10 px-1 py-0.5 text-[10px] tabular-nums text-cream/50">
                  {cat.items.filter((i) => i.isActive).length}/{cat.items.length}
                </span>
              </button>
            ))}
          </div>

          {activeCategory && (
            <CategoryPanel
              cat={activeCategory}
              onToggleCategory={() => void handleToggleCategory(activeCategory.id)}
              onEditCategory={() => {
                setEditingCategory(activeCategory)
                setShowCategoryModal(true)
              }}
              onDeleteCategory={() => void handleDeleteCategory(activeCategory.id)}
              onBulk={(payload) => void handleBulkCategory(activeCategory.id, payload)}
              onAddItem={() => openNewItem(activeCategory.id)}
              onToggleItemVisibility={(id) => void handleToggleItemVisibility(id)}
              onToggleItem={(id) => void handleToggleItem(id)}
              onEditItem={(item) => {
                setEditingItem(item)
                setDefaultItemCategoryId(item.categoryId)
                setShowItemModal(true)
              }}
              onDeleteItem={(id) => void handleDeleteItem(id)}
            />
          )}
        </>
      )}

      {showCategoryModal && (
        <Modal onClose={() => setShowCategoryModal(false)}>
          <h2 className="mb-4 font-display text-lg font-bold text-cream">
            {editingCategory ? 'Modifier la catégorie' : 'Nouvelle catégorie'}
          </h2>
          <form onSubmit={(e) => void handleSaveCategory(e)} className="space-y-4">
            <label className="block text-sm">
              Nom (FR)
              <input name="name" defaultValue={editingCategory?.name} className={fieldClass} required />
            </label>
            <label className="block text-sm">
              Nom secondaire
              <input name="nameAr" defaultValue={editingCategory?.nameAr ?? ''} className={fieldClass} />
            </label>
            <label className="block text-sm">
              Ordre d&apos;affichage
              <input
                name="sortOrder"
                type="number"
                defaultValue={editingCategory?.sortOrder ?? 0}
                className={fieldClass}
              />
            </label>
            <div className="flex gap-2">
              <button type="submit" className="flex-1 rounded-xl bg-tomato py-2 text-sm font-semibold text-white">
                Enregistrer
              </button>
              <button
                type="button"
                onClick={() => setShowCategoryModal(false)}
                className="flex-1 rounded-xl border border-white/15 py-2 text-sm"
              >
                Annuler
              </button>
            </div>
          </form>
        </Modal>
      )}

      {showItemModal && (
        <Modal onClose={() => setShowItemModal(false)}>
          <h2 className="mb-4 font-display text-lg font-bold text-cream">
            {editingItem ? 'Modifier le produit' : 'Nouveau produit'}
          </h2>
          <form onSubmit={(e) => void handleSaveItem(e)} className="space-y-4">
            <label className="block text-sm">
              Nom
              <input name="name" defaultValue={editingItem?.name} className={fieldClass} required />
            </label>
            <label className="block text-sm">
              Nom secondaire
              <input name="nameAr" defaultValue={editingItem?.nameAr ?? ''} className={fieldClass} />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm">
                Prix (€)
                <input
                  name="price"
                  type="number"
                  step="0.01"
                  defaultValue={editingItem ? centsToEuros(editingItem.price) : ''}
                  className={fieldClass}
                  required
                />
              </label>
              <label className="block text-sm">
                Prix promo (€)
                <input
                  name="discountPrice"
                  type="number"
                  step="0.01"
                  defaultValue={
                    editingItem?.discountPrice ? centsToEuros(editingItem.discountPrice) : ''
                  }
                  className={fieldClass}
                />
              </label>
            </div>
            <label className="block text-sm">
              Catégorie
              <select
                name="categoryId"
                defaultValue={editingItem?.categoryId ?? defaultItemCategoryId ?? categories[0]?.id}
                className={fieldClass}
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              Temps de préparation (min)
              <input name="prepTime" type="number" defaultValue={editingItem?.prepTime ?? 15} className={fieldClass} />
            </label>
            <label className="block text-sm">
              Taux TVA
              <select
                name="vatRateBps"
                defaultValue={String(editingItem?.vatRateBps ?? 1000)}
                className={fieldClass}
              >
                {VAT_RATE_OPTIONS.map((opt) => (
                  <option key={opt.bps} value={opt.bps}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              Description
              <textarea name="description" defaultValue={editingItem?.description ?? ''} rows={2} className={fieldClass} />
            </label>
            <div>
              <p className="mb-2 text-sm">Photo</p>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-white/15 px-3 py-2 text-sm hover:bg-white/5">
                <Image className="h-4 w-4" />
                Choisir une image
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      setItemImageFile(file)
                      setItemImagePreview(URL.createObjectURL(file))
                    }
                  }}
                />
              </label>
              {(itemImagePreview || editingItem?.image) && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={itemImagePreview ?? resolveMenuItemImageUrl(editingItem?.image) ?? ''}
                  alt=""
                  className="mt-2 h-16 w-16 rounded-xl object-cover"
                />
              )}
            </div>
            <div className="flex gap-2">
              <button type="submit" className="flex-1 rounded-xl bg-tomato py-2 text-sm font-semibold text-white">
                Enregistrer
              </button>
              <button
                type="button"
                onClick={() => setShowItemModal(false)}
                className="flex-1 rounded-xl border border-white/15 py-2 text-sm"
              >
                Annuler
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

function CategoryPanel({
  cat,
  onToggleCategory,
  onEditCategory,
  onDeleteCategory,
  onBulk,
  onAddItem,
  onToggleItemVisibility,
  onToggleItem,
  onEditItem,
  onDeleteItem,
}: {
  cat: MenuCategory
  onToggleCategory: () => void
  onEditCategory: () => void
  onDeleteCategory: () => void
  onBulk: (payload: { isActive?: boolean; isAvailable?: boolean }) => void
  onAddItem: () => void
  onToggleItemVisibility: (id: string) => void
  onToggleItem: (id: string) => void
  onEditItem: (item: MenuItem) => void
  onDeleteItem: (id: string) => void
}) {
  return (
    <section className="min-h-0 flex-1 rounded-2xl border border-white/10 bg-[#1A1412] p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-cream">
            {cat.name}
            {cat.isActive === false && (
              <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-xs text-cream/50">
                Catégorie inactive
              </span>
            )}
          </h2>
          {cat.nameAr && cat.nameAr !== cat.name && (
            <p className="text-xs text-cream/40">{cat.nameAr}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={onAddItem}
            className="rounded-lg border border-tomato/30 bg-tomato/10 px-3 py-1.5 text-xs font-medium text-tomato-light hover:bg-tomato/20"
          >
            <Plus className="mr-1 inline h-3.5 w-3.5" />
            Produit
          </button>
          <button
            type="button"
            title={cat.isActive === false ? 'Activer catégorie' : 'Masquer catégorie'}
            onClick={onToggleCategory}
            className="rounded-lg p-2 hover:bg-white/5"
          >
            {cat.isActive !== false ? (
              <ToggleRight className="h-5 w-5 text-emerald-400" />
            ) : (
              <ToggleLeft className="h-5 w-5 text-cream/30" />
            )}
          </button>
          <button type="button" onClick={onEditCategory} className="rounded-lg p-2 hover:bg-white/5">
            <Edit2 className="h-4 w-4 text-cream/60" />
          </button>
          <button type="button" onClick={onDeleteCategory} className="rounded-lg p-2 hover:bg-red-500/10">
            <Trash2 className="h-4 w-4 text-red-400" />
          </button>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onBulk({ isActive: true, isAvailable: true })}
          className="rounded-lg border border-white/10 px-2 py-1 text-xs text-cream/60 hover:bg-white/5"
        >
          Tout activer
        </button>
        <button
          type="button"
          onClick={() => onBulk({ isActive: false })}
          className="rounded-lg border border-white/10 px-2 py-1 text-xs text-cream/60 hover:bg-white/5"
        >
          Tout masquer
        </button>
        <button
          type="button"
          onClick={() => onBulk({ isAvailable: false })}
          className="rounded-lg border border-white/10 px-2 py-1 text-xs text-cream/60 hover:bg-white/5"
        >
          Tout en rupture
        </button>
      </div>

      <div className="max-h-[calc(100dvh-18rem)] space-y-2 overflow-y-auto pr-1">
        {cat.items.map((item) => {
          const img = resolveMenuItemImageUrl(item.image)
          return (
            <div
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white/[0.03] p-3"
            >
              <div className="flex min-w-0 items-center gap-3">
                {img ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={img} alt="" className="h-12 w-12 rounded-xl object-cover" />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/5 text-cream/30">
                    <Image className="h-5 w-5" />
                  </div>
                )}
                <div>
                  <p className="font-medium text-cream">
                    {item.name}
                    {item.isActive === false && (
                      <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-xs text-cream/50">
                        Masqué
                      </span>
                    )}
                    {!item.isAvailable && (
                      <span className="ml-2 rounded-full bg-red-500/15 px-2 py-0.5 text-xs text-red-300">
                        Indisponible
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-cream/50">
                    {formatEUR(item.price)}
                    {item.discountPrice ? ` → promo ${formatEUR(item.discountPrice)}` : ''}
                    {' · '}
                    {item.prepTime} min
                    {' · TVA '}
                    {vatRateLabel(item.vatRateBps)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  title={item.isActive !== false ? 'Masquer du site' : 'Afficher sur le site'}
                  onClick={() => onToggleItemVisibility(item.id)}
                  className="rounded-lg p-2 hover:bg-white/5"
                >
                  {item.isActive !== false ? (
                    <ToggleRight className="h-5 w-5 text-blue-400" />
                  ) : (
                    <ToggleLeft className="h-5 w-5 text-cream/30" />
                  )}
                </button>
                <button
                  type="button"
                  title={item.isAvailable ? 'Rupture' : 'Disponible'}
                  onClick={() => onToggleItem(item.id)}
                  className="rounded-lg p-2 hover:bg-white/5"
                >
                  {item.isAvailable ? (
                    <ToggleRight className="h-5 w-5 text-emerald-400" />
                  ) : (
                    <ToggleLeft className="h-5 w-5 text-cream/30" />
                  )}
                </button>
                <button type="button" onClick={() => onEditItem(item)} className="rounded-lg p-2 hover:bg-white/5">
                  <Edit2 className="h-4 w-4 text-cream/60" />
                </button>
                <button type="button" onClick={() => onDeleteItem(item.id)} className="rounded-lg p-2 hover:bg-red-500/10">
                  <Trash2 className="h-4 w-4 text-red-400" />
                </button>
              </div>
            </div>
          )
        })}
        {cat.items.length === 0 && (
          <p className="py-8 text-center text-sm text-cream/35">Aucun produit — ajoutez-en un dans cette catégorie.</p>
        )}
      </div>
    </section>
  )
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-[#1A1412] p-6">
        <button type="button" onClick={onClose} className="absolute right-4 top-4 rounded-lg p-1 hover:bg-white/5">
          <X className="h-5 w-5 text-cream/50" />
        </button>
        {children}
      </div>
    </div>
  )
}
