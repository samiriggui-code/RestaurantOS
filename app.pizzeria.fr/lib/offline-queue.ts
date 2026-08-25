const DB_NAME = 'pizzeria-pos-offline'
const DB_VERSION = 1
const STORE_NAME = 'counter-orders'

export type OfflineCounterOrder = {
  id?: number
  offlineRef: string
  offlineSoldAt?: string
  payload: {
    items: {
      menuItemId: string
      quantity: number
      price?: number
      notes?: string | null
      selectedModifiers?: Record<string, unknown>
    }[]
    type: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY'
    paymentMethod: 'CASH' | 'CARD' | 'CASH_SUMUP'
    customerName?: string
    customerPhone?: string
    notes?: string
  }
  localKitchenTicket: string
  localProvisionalReceipt?: string
  printedLocally: boolean
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

export async function enqueueOfflineOrder(order: Omit<OfflineCounterOrder, 'id' | 'timestamp'>) {
  const db = await openDB()
  const tx = db.transaction(STORE_NAME, 'readwrite')
  const store = tx.objectStore(STORE_NAME)
  await new Promise<void>((resolve, reject) => {
    const r = store.add({ ...order, timestamp: Date.now() })
    r.onsuccess = () => resolve()
    r.onerror = () => reject(r.error)
  })
}

export async function getOfflineOrders(): Promise<OfflineCounterOrder[]> {
  const db = await openDB()
  const tx = db.transaction(STORE_NAME, 'readonly')
  const store = tx.objectStore(STORE_NAME)
  return new Promise((resolve, reject) => {
    const r = store.getAll()
    r.onsuccess = () => resolve(r.result as OfflineCounterOrder[])
    r.onerror = () => reject(r.error)
  })
}

export async function removeOfflineOrder(id: number) {
  const db = await openDB()
  const tx = db.transaction(STORE_NAME, 'readwrite')
  const store = tx.objectStore(STORE_NAME)
  await new Promise<void>((resolve, reject) => {
    const r = store.delete(id)
    r.onsuccess = () => resolve()
    r.onerror = () => reject(r.error)
  })
}

export async function getOfflineQueueSize(): Promise<number> {
  const db = await openDB()
  const tx = db.transaction(STORE_NAME, 'readonly')
  const store = tx.objectStore(STORE_NAME)
  return new Promise((resolve, reject) => {
    const r = store.count()
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })
}
