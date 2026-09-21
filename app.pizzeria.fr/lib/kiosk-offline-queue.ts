const DB_NAME = 'pizzeria-kiosk-offline'
const DB_VERSION = 1
const STORE_NAME = 'kiosk-orders'

export type OfflineKioskOrder = {
  id?: number
  offlineRef: string
  mode: 'surplace' | 'emporter'
  items: { slug: string; quantity: number }[]
  timestamp: number
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export function newKioskOfflineRef(): string {
  return `KIOSK-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
}

export async function enqueueKioskOrder(
  order: Omit<OfflineKioskOrder, 'id' | 'timestamp'>,
): Promise<void> {
  const db = await openDB()
  const tx = db.transaction(STORE_NAME, 'readwrite')
  const store = tx.objectStore(STORE_NAME)
  await new Promise<void>((resolve, reject) => {
    const r = store.add({ ...order, timestamp: Date.now() })
    r.onsuccess = () => resolve()
    r.onerror = () => reject(r.error)
  })
}

export async function getKioskOfflineOrders(): Promise<OfflineKioskOrder[]> {
  const db = await openDB()
  const tx = db.transaction(STORE_NAME, 'readonly')
  const store = tx.objectStore(STORE_NAME)
  return new Promise((resolve, reject) => {
    const r = store.getAll()
    r.onsuccess = () => resolve(r.result as OfflineKioskOrder[])
    r.onerror = () => reject(r.error)
  })
}

export async function removeKioskOfflineOrder(id: number): Promise<void> {
  const db = await openDB()
  const tx = db.transaction(STORE_NAME, 'readwrite')
  const store = tx.objectStore(STORE_NAME)
  await new Promise<void>((resolve, reject) => {
    const r = store.delete(id)
    r.onsuccess = () => resolve()
    r.onerror = () => reject(r.error)
  })
}

/** Flush IndexedDB → API publique quand le réseau revient. */
export async function syncKioskOfflineOrders(): Promise<{ success: number; failed: number }> {
  const queue = await getKioskOfflineOrders()
  let success = 0
  let failed = 0
  for (const item of queue) {
    try {
      const res = await fetch('/api/public/kiosk-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: item.mode,
          items: item.items,
          offlineRef: item.offlineRef,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { success?: boolean }
      if (!res.ok || !data.success) throw new Error('sync failed')
      if (item.id != null) await removeKioskOfflineOrder(item.id)
      success++
    } catch {
      failed++
    }
  }
  return { success, failed }
}

export function bootstrapKioskOfflineSync(): () => void {
  if (typeof window === 'undefined') return () => {}
  const flush = () => {
    if (navigator.onLine) void syncKioskOfflineOrders()
  }
  flush()
  window.addEventListener('online', flush)
  return () => window.removeEventListener('online', flush)
}

export function isNetworkFailure(err: unknown): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true
  const msg = err instanceof Error ? err.message : String(err)
  return /failed to fetch|network|timeout|load failed|ECONNREFUSED|503|502|504|NetworkError/i.test(
    msg,
  )
}
