import type { CatalogCategory, CatalogItem } from '@/lib/menu-types'

type PublicMenuResponse = {
  success?: boolean
  categories?: CatalogCategory[]
  error?: string
}

let cachedCategories: CatalogCategory[] | null = null

export async function fetchPublicMenu(force = false): Promise<CatalogCategory[]> {
  if (cachedCategories && !force) return cachedCategories

  const res = await fetch('/api/public/menu', { cache: 'no-store' })
  const data = (await res.json()) as PublicMenuResponse

  if (!res.ok || !data.success || !data.categories?.length) {
    throw new Error(data.error ?? 'Menu indisponible')
  }

  cachedCategories = data.categories
  return cachedCategories
}

export function getCachedPublicMenu(): CatalogCategory[] | null {
  return cachedCategories
}

export function clearPublicMenuCache(): void {
  cachedCategories = null
}

export function findCatalogItemBySlug(
  slug: string,
  categories: CatalogCategory[] = cachedCategories ?? [],
): { item: CatalogItem; categoryId: string } | null {
  for (const cat of categories) {
    const item = cat.items.find((i) => i.slug === slug)
    if (item) return { item, categoryId: cat.id }
  }
  return null
}

export function listCatalogItemsBySlugs(
  slugs: readonly string[],
  categories: CatalogCategory[] = cachedCategories ?? [],
): Array<{ item: CatalogItem; categoryId: string }> {
  const wanted = new Set(slugs)
  const out: Array<{ item: CatalogItem; categoryId: string }> = []
  for (const cat of categories) {
    for (const item of cat.items) {
      if (wanted.has(item.slug)) out.push({ item, categoryId: cat.id })
    }
  }
  return out
}
