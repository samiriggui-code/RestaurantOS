import { staffFetch } from '@/lib/staff-api'
import {
  getOfflineOrders,
  getOfflineQueueSize,
  removeOfflineOrder,
  type OfflineCounterOrder,
} from '@/lib/offline-queue'

type SyncStatus = { pending: number; syncing: boolean; lastSync: Date | null }

let syncing = false
let lastSync: Date | null = null
const listeners = new Set<(s: SyncStatus) => void>()

function notify() {
  void getOfflineQueueSize().then((pending) => {
    const status = { pending, syncing, lastSync }
    listeners.forEach((cb) => cb(status))
  })
}

export function onOfflineSyncStatus(cb: (s: SyncStatus) => void) {
  listeners.add(cb)
  notify()
  return () => {
    listeners.delete(cb)
  }
}

export async function syncOfflineOrders(token: string): Promise<{ success: number; failed: number }> {
  if (syncing) return { success: 0, failed: 0 }
  syncing = true
  notify()

  let success = 0
  let failed = 0

  try {
    const queue = await getOfflineOrders()
    if (queue.length === 0) return { success: 0, failed: 0 }

    const res = await staffFetch<{
      synced: number
      results: Array<{ offlineRef: string; orderId: string; created: boolean }>
    }>('/pos/sync', {
      method: 'POST',
      token,
      body: JSON.stringify({
        orders: queue.map((q) => ({
          offlineRef: q.offlineRef,
          offlineSoldAt: q.offlineSoldAt,
          ...q.payload,
        })),
      }),
    })

    const syncedRefs = new Set(res.results.map((r) => r.offlineRef))
    for (const item of queue) {
      if (syncedRefs.has(item.offlineRef) && item.id != null) {
        await removeOfflineOrder(item.id)
        success++
      } else {
        failed++
      }
    }
    lastSync = new Date()
  } catch {
    failed = await getOfflineQueueSize()
  } finally {
    syncing = false
    notify()
  }

  return { success, failed }
}

export function queueOfflineCounterOrder(
  order: Omit<OfflineCounterOrder, 'id' | 'timestamp'>,
): Promise<void> {
  return import('@/lib/offline-queue').then(({ enqueueOfflineOrder }) => enqueueOfflineOrder(order))
}

function trySyncWithStoredToken() {
  const token = localStorage.getItem('token')
  if (token && typeof navigator !== 'undefined' && navigator.onLine) {
    void syncOfflineOrders(token)
  }
}

/** Sync au démarrage POS + écoute retour réseau. */
export function bootstrapOfflineSync(): () => void {
  if (typeof window === 'undefined') return () => {}

  trySyncWithStoredToken()

  const onOnline = () => trySyncWithStoredToken()
  window.addEventListener('online', onOnline)
  return () => window.removeEventListener('online', onOnline)
}
