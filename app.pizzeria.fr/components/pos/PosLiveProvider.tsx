'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { getKitchenSocket, joinBusinessRoom, releaseKitchenSocket, retainKitchenSocket } from '@/lib/socket'
import {
  ensureFreshAccessToken,
  getDeviceSession,
  refreshAccessToken,
} from '@/lib/staff-auth'
import { playAlertSound } from '@/lib/ui-sounds'
import { playSunmiNewOrderSound } from '@/lib/print/sunmi-printer'
import {
  adminLiveToPosActivity,
  fetchPosLiveSnapshot,
  orderToPosActivity,
  tableServiceToPosActivity,
  type PosLiveActivity,
} from '@/lib/pos-live-feed'
import type { OpsOrder } from '@/lib/ops-orders'

type PosLiveContextValue = {
  connected: boolean
  refreshing: boolean
  lastSyncAt: Date | null
  unreadCount: number
  activities: PosLiveActivity[]
  refresh: () => Promise<void>
  markRead: () => void
}

const PosLiveContext = createContext<PosLiveContextValue | null>(null)

function pushUnique(prev: PosLiveActivity[], item: PosLiveActivity): PosLiveActivity[] {
  return [item, ...prev.filter((a) => a.id !== item.id)].slice(0, 40)
}

export function PosLiveProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const [activities, setActivities] = useState<PosLiveActivity[]>([])
  const [sessionKey, setSessionKey] = useState(0)

  const pushActivity = useCallback((activity: PosLiveActivity, opts?: { sound?: boolean }) => {
    setActivities((prev) => pushUnique(prev, activity))
    setUnreadCount((n) => n + 1)
    setLastSyncAt(new Date())
    if (opts?.sound) {
      if (!playSunmiNewOrderSound()) playAlertSound()
    }
  }, [])

  const markRead = useCallback(() => setUnreadCount(0), [])

  const refresh = useCallback(async () => {
    const session = getDeviceSession()
    if (!session) return
    setRefreshing(true)
    try {
      const token = (await ensureFreshAccessToken('device')) ?? session.token
      const snapshot = await fetchPosLiveSnapshot(token)
      setActivities(snapshot)
      setLastSyncAt(new Date())
    } catch {
      /* garde la liste courante */
    } finally {
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    const onAuth = () => setSessionKey((k) => k + 1)
    window.addEventListener('staff-auth-changed', onAuth)
    return () => window.removeEventListener('staff-auth-changed', onAuth)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh, sessionKey])

  useEffect(() => {
    const timer = window.setInterval(() => {
      void ensureFreshAccessToken('device')
    }, 10 * 60 * 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    let cancelled = false
    let socket: ReturnType<typeof getKitchenSocket> | null = null

    async function setup() {
      const token = await ensureFreshAccessToken('device')
      const session = getDeviceSession()
      if (!session || !token || cancelled) return

      retainKitchenSocket()
      socket = getKitchenSocket(token)

      const onConnect = () => {
        setConnected(true)
        const current = getDeviceSession()
        if (current) joinBusinessRoom(socket!, current.businessId)
      }
      const onDisconnect = () => setConnected(false)
      const onConnectError = () => {
        setConnected(false)
        void (async () => {
          const refreshed = await refreshAccessToken('device')
          if (!refreshed || cancelled || !socket) return
          socket.auth = { token: refreshed }
          socket.connect()
        })()
      }

      const touchOrder = (order: OpsOrder, kind: string, sound = false) => {
        pushActivity(orderToPosActivity(order, kind), { sound })
      }

      const onAdminLive = (payload: Parameters<typeof adminLiveToPosActivity>[0]) => {
        const activity = adminLiveToPosActivity(payload)
        pushActivity(activity, { sound: activity.urgent })
      }

      socket.on('connect', onConnect)
      socket.on('disconnect', onDisconnect)
      socket.on('connect_error', onConnectError)
      socket.on('order:new', (o: OpsOrder) => touchOrder(o, 'new', true))
      socket.on('order:onlinePending', (o: OpsOrder) => touchOrder(o, 'pending', true))
      socket.on('order:statusUpdate', (o: OpsOrder) => touchOrder(o, 'status'))
      socket.on('order:paymentUpdate', (o: OpsOrder) => touchOrder(o, 'payment'))
      socket.on('order:cancelled', (o: OpsOrder) => touchOrder(o, 'cancel'))
      socket.on('admin:live', onAdminLive)
      socket.on('table:serviceCalled', (data: { tableId?: string; message?: string }) => {
        if (!data?.tableId) return
        pushActivity(tableServiceToPosActivity(data.tableId, data.message ?? 'Service demandé'), {
          sound: true,
        })
      })
      socket.on('waiter:called', (data: { tableId?: string; message?: string }) => {
        if (!data?.tableId) return
        pushActivity(tableServiceToPosActivity(data.tableId, data.message ?? 'Serveur appelé'), {
          sound: true,
        })
      })

      if (socket.connected) onConnect()
      else socket.connect()

      return () => {
        socket?.off('connect', onConnect)
        socket?.off('disconnect', onDisconnect)
        socket?.off('connect_error', onConnectError)
        socket?.off('order:new')
        socket?.off('order:onlinePending')
        socket?.off('order:statusUpdate')
        socket?.off('order:paymentUpdate')
        socket?.off('order:cancelled')
        socket?.off('admin:live')
        socket?.off('table:serviceCalled')
        socket?.off('waiter:called')
        releaseKitchenSocket()
      }
    }

    let cleanup: (() => void) | void
    void setup().then((fn) => {
      cleanup = fn
    })

    return () => {
      cancelled = true
      cleanup?.()
    }
  }, [pushActivity, sessionKey])

  useEffect(() => {
    const session = getDeviceSession()
    if (!session || connected) return
    const timer = window.setInterval(() => {
      void refresh()
    }, 25_000)
    return () => window.clearInterval(timer)
  }, [connected, refresh, sessionKey])

  const value = useMemo(
    () => ({
      connected,
      refreshing,
      lastSyncAt,
      unreadCount,
      activities,
      refresh,
      markRead,
    }),
    [connected, refreshing, lastSyncAt, unreadCount, activities, refresh, markRead],
  )

  return <PosLiveContext.Provider value={value}>{children}</PosLiveContext.Provider>
}

export function usePosLive(): PosLiveContextValue {
  const ctx = useContext(PosLiveContext)
  if (!ctx) throw new Error('usePosLive must be used within PosLiveProvider')
  return ctx
}
