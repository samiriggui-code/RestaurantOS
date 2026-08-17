'use client'

import { useEffect, useState } from 'react'
import { CloudOff, RefreshCw } from 'lucide-react'
import { getStaffSession } from '@/lib/staff-auth'
import { onOfflineSyncStatus, syncOfflineOrders } from '@/lib/offline-sync'

export function PosOfflineBanner() {
  const [pending, setPending] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [online, setOnline] = useState(true)

  useEffect(() => {
    setOnline(typeof navigator !== 'undefined' ? navigator.onLine : true)
    const onStatus = () => setOnline(navigator.onLine)
    window.addEventListener('online', onStatus)
    window.addEventListener('offline', onStatus)
    return () => {
      window.removeEventListener('online', onStatus)
      window.removeEventListener('offline', onStatus)
    }
  }, [])

  useEffect(() => {
    return onOfflineSyncStatus(({ pending: p, syncing: s }) => {
      setPending(p)
      setSyncing(s)
    })
  }, [])

  if (online && pending === 0) return null

  async function syncNow() {
    const session = getStaffSession()
    if (!session) return
    await syncOfflineOrders(session.token)
  }

  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border border-amber-500/40 bg-amber-950/30 px-3 py-2 text-xs text-amber-100">
      <div className="flex items-center gap-2">
        <CloudOff className="h-4 w-4 shrink-0" />
        <span>
          {!online
            ? 'Hors-ligne — commandes locales + impression SUNMI'
            : `${pending} commande(s) en attente de sync`}
        </span>
      </div>
      {online && pending > 0 && (
        <button
          type="button"
          disabled={syncing}
          onClick={() => void syncNow()}
          className="flex items-center gap-1 font-semibold text-amber-200 underline disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
          Sync
        </button>
      )}
    </div>
  )
}
