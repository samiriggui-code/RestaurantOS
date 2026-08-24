import {
  getQueuedRequests,
  removeQueuedRequest,
  getQueueSize,
  QueuedRequest,
} from './offlineQueue';
import { axiosInstance } from './api';
import type { Method } from 'axios';

type SyncCallback = (status: { pending: number; syncing: boolean; lastSync: Date | null }) => void;

let syncCallbacks: SyncCallback[] = [];
let isSyncing = false;
let lastSync: Date | null = null;

export function onSyncStatusChange(cb: SyncCallback) {
  syncCallbacks.push(cb);
  return () => {
    syncCallbacks = syncCallbacks.filter(c => c !== cb);
  };
}

function notify() {
  const pending = 0; // will be estimated
  const status = { pending, syncing: isSyncing, lastSync };
  syncCallbacks.forEach(cb => cb(status));
  getQueueSize().then(size => {
    const s = { pending: size, syncing: isSyncing, lastSync };
    syncCallbacks.forEach(cb => cb(s));
  });
}

async function replayRequest(req: QueuedRequest): Promise<boolean> {
  try {
    await axiosInstance({
      method: req.method as Method,
      url: req.url,
      data: req.data,
      headers: { ...req.headers, 'X-Offline-Replay': 'true' },
      timeout: 15000,
    });
    if (req.id != null) await removeQueuedRequest(req.id);
    return true;
  } catch {
    return false;
  }
}

export async function processQueue(): Promise<{ success: number; failed: number }> {
  if (isSyncing) return { success: 0, failed: 0 };
  isSyncing = true;
  notify();

  let success = 0;
  let failed = 0;

  try {
    const queue = await getQueuedRequests();
    for (const req of queue) {
      const ok = await replayRequest(req);
      if (ok) success++;
      else failed++;
    }
    lastSync = new Date();
  } finally {
    isSyncing = false;
    notify();
  }

  return { success, failed };
}

export function getSyncStatus() {
  return { pending: 0, syncing: isSyncing, lastSync };
}

// Auto-sync when online
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    processQueue();
  });
}
