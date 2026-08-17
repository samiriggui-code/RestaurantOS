import type { StoreInventoryRow } from '@/lib/device-onboarding'

const STORAGE_KEY = 'crm_selected_business_id'

export function resolveSelectedBusinessId(stores: StoreInventoryRow[]): string | null {
  if (stores.length === 0) return null
  if (typeof window === 'undefined') return stores[0]!.businessId

  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved && stores.some((s) => s.businessId === saved)) return saved
  return stores[0]!.businessId
}

export function persistSelectedBusinessId(businessId: string) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, businessId)
}

export function selectedStoreRow(
  stores: StoreInventoryRow[],
  businessId: string | null,
): StoreInventoryRow | null {
  if (!businessId) return stores[0] ?? null
  return stores.find((s) => s.businessId === businessId) ?? stores[0] ?? null
}
