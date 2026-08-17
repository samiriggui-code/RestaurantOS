'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { getKitchenSocket, joinBusinessRoom, releaseKitchenSocket, retainKitchenSocket } from '@/lib/socket'
import { ensureFreshAccessToken, getCrmSession, refreshCrmAccessToken } from '@/lib/staff-auth'
import {
  notifyCrmBrowser,
  playCrmAlertSound,
  requestCrmNotificationPermission,
} from '@/lib/crm-alert'
import {
  ORDER_STATUS_LABEL,
  PAYMENT_STATUS_LABEL,
  type OpsOrder,
} from '@/lib/ops-orders'

export type AdminLiveDomain = 'orders' | 'dashboard' | 'stock' | 'expenses' | 'reports' | 'all'

export type AdminLiveActivity = {
  id: string
  at: string
  domain: AdminLiveDomain
  title: string
  detail?: string
}

export type AdminLiveToast = {
  id: string
  title: string
  detail?: string
}

type LivePayload = {
  domain: AdminLiveDomain
  action?: string
  label?: string
  detail?: string
  at?: string
}

type AdminLiveContextValue = {
  connected: boolean
  refreshing: boolean
  lastSyncAt: Date | null
  unreadCount: number
  activities: AdminLiveActivity[]
  toasts: AdminLiveToast[]
  version: Record<AdminLiveDomain, number>
  refreshAll: () => Promise<void>
  markActivitiesRead: () => void
  dismissToast: (id: string) => void
  registerRefresh: (fn: () => void | Promise<void>) => () => void
}

const DOMAINS: AdminLiveDomain[] = ['orders', 'dashboard', 'stock', 'expenses', 'reports', 'all']

const initialVersion = (): Record<AdminLiveDomain, number> => ({
  orders: 0,
  dashboard: 0,
  stock: 0,
  expenses: 0,
  reports: 0,
  all: 0,
})

const AdminLiveContext = createContext<AdminLiveContextValue | null>(null)

function bumpDomain(
  prev: Record<AdminLiveDomain, number>,
  domain: AdminLiveDomain
): Record<AdminLiveDomain, number> {
  const next = { ...prev, [domain]: prev[domain] + 1, all: prev.all + 1 }
  if (domain !== 'dashboard' && domain !== 'reports') {
    next.dashboard = prev.dashboard + 1
    next.reports = prev.reports + 1
  }
  if (domain === 'orders') {
    next.dashboard = prev.dashboard + 1
    next.reports = prev.reports + 1
  }
  return next
}

function orderActivity(order: OpsOrder, kind: string): AdminLiveActivity {
  const origin = order.isOnlineOrder ? 'En ligne' : 'Comptoir'
  return {
    id: `${order.id}-${kind}-${Date.now()}`,
    at: new Date().toISOString(),
    domain: 'orders',
    title: `#${order.orderNumber} · ${ORDER_STATUS_LABEL[order.status] ?? order.status}`,
    detail: `${origin} · ${PAYMENT_STATUS_LABEL[order.paymentStatus] ?? order.paymentStatus}`,
  }
}

function payloadActivity(payload: LivePayload): AdminLiveActivity {
  return {
    id: `${payload.domain}-${payload.action}-${Date.now()}`,
    at: payload.at ?? new Date().toISOString(),
    domain: payload.domain,
    title: payload.label ?? 'Mise à jour',
    detail: payload.detail,
  }
}

export function AdminLiveProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const [activities, setActivities] = useState<AdminLiveActivity[]>([])
  const [toasts, setToasts] = useState<AdminLiveToast[]>([])
  const [version, setVersion] = useState(initialVersion)
  const [sessionKey, setSessionKey] = useState(0)
  const refreshHandlers = useRef(new Set<() => void | Promise<void>>())

  const pushActivity = useCallback((activity: AdminLiveActivity) => {
    setActivities((prev) => [activity, ...prev].slice(0, 40))
    setUnreadCount((n) => n + 1)
    setLastSyncAt(new Date())
  }, [])

  const pushOrderAlert = useCallback((order: OpsOrder, kind: 'new' | 'pending') => {
    const origin = order.isOnlineOrder ? 'En ligne' : 'Comptoir / tablette'
    const title =
      kind === 'pending'
        ? `Commande #${order.orderNumber} — attente paiement`
        : `Nouvelle commande #${order.orderNumber}`
    const detail = `${origin} · ${PAYMENT_STATUS_LABEL[order.paymentStatus] ?? order.paymentStatus}`
    const toastId = `${order.id}-${kind}-${Date.now()}`

    setToasts((prev) => [{ id: toastId, title, detail }, ...prev].slice(0, 4))
    playCrmAlertSound()
    notifyCrmBrowser(title, detail)

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== toastId))
    }, 8000)
  }, [])

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const registerRefresh = useCallback((fn: () => void | Promise<void>) => {
    refreshHandlers.current.add(fn)
    return () => refreshHandlers.current.delete(fn)
  }, [])

  const refreshAll = useCallback(async () => {
    setRefreshing(true)
    try {
      await Promise.all(Array.from(refreshHandlers.current).map((fn) => Promise.resolve(fn())))
      setLastSyncAt(new Date())
      setVersion((v) => bumpDomain(v, 'all'))
    } finally {
      setRefreshing(false)
    }
  }, [])

  const markActivitiesRead = useCallback(() => setUnreadCount(0), [])

  useEffect(() => {
    const onAuthChange = () => setSessionKey((k) => k + 1)
    window.addEventListener('staff-auth-changed', onAuthChange)
    return () => window.removeEventListener('staff-auth-changed', onAuthChange)
  }, [])

  /** Renouvelle le JWT avant expiration pour garder le socket actif. */
  useEffect(() => {
    const timer = window.setInterval(() => {
      void ensureFreshAccessToken('crm')
    }, 10 * 60 * 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    let cancelled = false
    let socket: ReturnType<typeof getKitchenSocket> | null = null

    async function setup() {
      const token = await ensureFreshAccessToken('crm')
      const session = getCrmSession()
      if (!session || !token || cancelled) return

      requestCrmNotificationPermission()
      retainKitchenSocket()
      socket = getKitchenSocket(token)

      const onConnect = () => {
        setConnected(true)
        const current = getCrmSession()
        if (current) joinBusinessRoom(socket!, current.businessId)
      }
      const onDisconnect = () => setConnected(false)
      const onConnectError = () => {
        setConnected(false)
        void (async () => {
          const refreshed = await refreshCrmAccessToken()
          if (!refreshed || cancelled || !socket) return
          socket.auth = { token: refreshed }
          socket.connect()
        })()
      }

      const touchOrders = (order: OpsOrder, kind: string) => {
        pushActivity(orderActivity(order, kind))
        setVersion((v) => bumpDomain(v, 'orders'))
        if (kind === 'new' || kind === 'pending') {
          pushOrderAlert(order, kind)
        }
      }

      const onAdminLive = (payload: LivePayload) => {
        pushActivity(payloadActivity(payload))
        setVersion((v) => bumpDomain(v, payload.domain))
      }

      const onOrderNew = (o: OpsOrder) => touchOrders(o, 'new')
      const onOrderStatus = (o: OpsOrder) => touchOrders(o, 'status')
      const onOrderPayment = (o: OpsOrder) => touchOrders(o, 'payment')
      const onOrderPending = (o: OpsOrder) => touchOrders(o, 'pending')
      const onOrderCancel = (o: OpsOrder) => touchOrders(o, 'cancel')

      socket.on('connect', onConnect)
      socket.on('disconnect', onDisconnect)
      socket.on('connect_error', onConnectError)
      socket.on('order:new', onOrderNew)
      socket.on('order:statusUpdate', onOrderStatus)
      socket.on('order:paymentUpdate', onOrderPayment)
      socket.on('order:onlinePending', onOrderPending)
      socket.on('order:cancelled', onOrderCancel)
      socket.on('admin:live', onAdminLive)
      if (socket.connected) onConnect()
      else socket.connect()

      return () => {
        socket?.off('connect', onConnect)
        socket?.off('disconnect', onDisconnect)
        socket?.off('connect_error', onConnectError)
        socket?.off('order:new', onOrderNew)
        socket?.off('order:statusUpdate', onOrderStatus)
        socket?.off('order:paymentUpdate', onOrderPayment)
        socket?.off('order:onlinePending', onOrderPending)
        socket?.off('order:cancelled', onOrderCancel)
        socket?.off('admin:live', onAdminLive)
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
  }, [pushActivity, pushOrderAlert, sessionKey])

  /** Filet de sécurité si le socket est hors ligne (CORS, token expiré, redémarrage API). */
  useEffect(() => {
    const session = getCrmSession()
    if (!session || connected) return
    const timer = window.setInterval(() => {
      void refreshAll()
    }, 20_000)
    return () => window.clearInterval(timer)
  }, [connected, refreshAll, sessionKey])

  const value = useMemo(
    () => ({
      connected,
      refreshing,
      lastSyncAt,
      unreadCount,
      activities,
      toasts,
      version,
      refreshAll,
      markActivitiesRead,
      dismissToast,
      registerRefresh,
    }),
    [
      connected,
      refreshing,
      lastSyncAt,
      unreadCount,
      activities,
      toasts,
      version,
      refreshAll,
      markActivitiesRead,
      dismissToast,
      registerRefresh,
    ]
  )

  return <AdminLiveContext.Provider value={value}>{children}</AdminLiveContext.Provider>
}

export function useAdminLive() {
  const ctx = useContext(AdminLiveContext)
  if (!ctx) throw new Error('useAdminLive must be used within AdminLiveProvider')
  return ctx
}

/** Recharge quand le domaine change (socket) ou sur clic Actualiser global. */
export function useAdminRefresh(
  domains: AdminLiveDomain | AdminLiveDomain[],
  refreshFn: () => void | Promise<void>
) {
  const { version, registerRefresh } = useAdminLive()
  const fnRef = useRef(refreshFn)
  fnRef.current = refreshFn

  const domainList = Array.isArray(domains) ? domains : [domains]
  const tick = domainList.reduce((n, d) => n + version[d], 0)

  useEffect(() => registerRefresh(() => fnRef.current()), [registerRefresh])

  useEffect(() => {
    if (tick === 0) return
    void fnRef.current()
  }, [tick])
}

export { DOMAINS as ADMIN_LIVE_DOMAINS }
