'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useFeedbackState } from '@/lib/use-feedback-state'
import Link from 'next/link'
import {
  AlertCircle,
  Bell,
  ChefHat,
  CreditCard,
  ExternalLink,
  Loader2,
  Lock,
  MapPin,
  Minus,
  Package,
  Plus,
  Search,
  Settings2,
  ShoppingCart,
  Truck,
  X,
} from 'lucide-react'
import { DevicePinGate, useDeviceLock } from '@/components/ops/DevicePinGate'
import { DeviceShopGate } from '@/components/ops/DeviceShopGate'
import { DeviceFullscreenButton } from '@/components/ops/DeviceFullscreenButton'
import { DeviceOrientationButton } from '@/components/ops/DeviceOrientationButton'
import { OrderItemLines } from '@/components/ops/OrderItemLines'
import { getStaffSession, getStaffUser, type AuthScope } from '@/lib/staff-auth'
import { authScopeForOpsMode, type OpsViewMode } from '@/lib/ops-view-mode'
import { canAccessAdmin, canAccessKitchen } from '@/lib/roles'
import { staffFetch } from '@/lib/staff-api'
import { getKitchenSocket, joinBusinessRoom, releaseKitchenSocket, retainKitchenSocket } from '@/lib/socket'
import { resolveMenuItemImageUrl } from '@/lib/menu-image-url'
import {
  CANCEL_REASON_LABEL,
  createCounterOrder,
  encashOnlineOrder,
  fetchOnlineOrdersForPos,
  fetchPosDeliveryQueue,
  fetchPosHandoverQueue,
  isPosDeliveryOrder,
  isPosEncashmentOrder,
  isPosHandoverOrder,
  orderAddressLine,
  orderCustomerLine,
  orderChannelLabel,
  orderChannelBadgeClass,
  ORDER_STATUS_LABEL,
  ORDER_TYPE_LABEL,
  PAYMENT_STATUS_LABEL,
  settlePosOrder,
  type OpsOrder,
} from '@/lib/ops-orders'
import { playSunmiNewOrderSound, isSunmiPrinterAvailable, printOnSunmi } from '@/lib/print/sunmi-printer'
import { usePosPrintListener } from '@/lib/print/use-pos-print-listener'
import { useDeviceDiagnosticListener } from '@/lib/print/use-device-diagnostic-listener'
import { generateLocalKitchenTicket } from '@/lib/print/local-kitchen-ticket'
import { generateProvisionalReceipt, newOfflineRef } from '@/lib/print/provisional-receipt'
import { printKitchenWithCascade } from '@/lib/print/print-job-handler'
import { bootstrapOfflineSync, queueOfflineCounterOrder } from '@/lib/offline-sync'
import type { PaymentMeta } from '@/lib/payment/payment-meta'
import { PosOfflineBanner } from '@/components/pos/PosOfflineBanner'
import { PosWebViewGate } from '@/components/pos/PosWebViewGate'
import { PosPaymentSheet } from '@/components/pos/PosPaymentSheet'
import { getPaymentTerminalMode } from '@/lib/payment/payment-terminal'
import { formatEUR } from '@/lib/money'
import { cn } from '@/lib/cn'
import { detectPosDeviceProfile, setPosDeviceProfile, type PosDeviceProfile } from '@/lib/pos-device-profile'
import { isLandscapeDeviceApk } from '@/lib/device-orientation'
import { PosSunmiShell, type PosSunmiTab } from '@/components/pos/PosSunmiShell'
import { PosPizzaSizeSheet } from '@/components/pos/PosPizzaSizeSheet'
import { PosPeripheralsPanel } from '@/components/pos/PosPeripheralsPanel'
import { loadPosPeripherals, DEFAULT_POS_PERIPHERALS, type PosPeripheralSettings, peripheralsAllowPrint, shouldAutoPrintKitchenOnPay } from '@/lib/pos-peripherals'
import { PIZZA_CATEGORY_IDS } from '@/lib/menu-types'
import { pizzaSizeLabel, type PizzaSizeId } from '@/lib/pizza-sizes'
import { publicSitePath } from '@/lib/public-site-url'

type MenuItem = {
  id: string
  name: string
  price: number
  discountPrice?: number | null
  isAvailable: boolean
  image?: string | null
  vatRateBps?: number
}

type MenuCategory = {
  id: string
  name: string
  slug?: string | null
  items: MenuItem[]
}

type CartLine = {
  menuItem: MenuItem
  quantity: number
  sizeId?: PizzaSizeId
  unitPriceCents: number
}

type PaymentSheetTarget =
  | { kind: 'cart'; reference: string }
  | { kind: 'online'; order: OpsOrder }
  | null

function MenuThumb({
  src,
  alt,
  className,
  iconClass = 'h-8 w-8',
}: {
  src: string | null
  alt: string
  className?: string
  iconClass?: string
}) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) {
    return (
      <div className={cn('flex items-center justify-center bg-white/5 text-cream/20', className)}>
        <ChefHat className={iconClass} />
      </div>
    )
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      className={cn('object-cover', className)}
      onError={() => setFailed(true)}
    />
  )
}

function PosMenuTile({
  item,
  compact,
  isPizza,
  onPick,
}: {
  item: MenuItem
  compact: boolean
  isPizza?: boolean
  onPick: () => void
}) {
  const src = resolveMenuItemImageUrl(item.image)
  const thumbClass = compact ? 'h-8 w-8' : 'h-14 w-14'

  if (compact) {
    return (
      <button
        type="button"
        onClick={onPick}
        className="flex w-full items-center gap-2 rounded-lg border border-white/10 bg-[#1A1412] p-1.5 text-left hover:border-tomato/40 active:bg-white/5"
      >
        <div className={cn('shrink-0 overflow-hidden rounded-md', thumbClass)}>
          <MenuThumb
            src={src}
            alt={item.name}
            className={cn('h-full w-full', thumbClass)}
            iconClass="h-3.5 w-3.5"
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-[11px] font-semibold leading-tight text-cream">{item.name}</p>
          <p className="text-[10px] font-bold text-tomato-light">
            {isPizza ? `dès ${formatEUR(itemPrice(item))}` : formatEUR(itemPrice(item))}
          </p>
        </div>
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={onPick}
      className="flex w-full min-w-[9.5rem] flex-col rounded-xl border border-white/10 bg-[#1A1412] p-2.5 text-left hover:border-tomato/40 active:bg-white/5"
    >
      <div className={cn('mb-2 shrink-0 overflow-hidden rounded-lg', thumbClass)}>
        <MenuThumb
          src={src}
          alt={item.name}
          className={cn('h-full w-full', thumbClass)}
          iconClass="h-5 w-5"
        />
      </div>
      <p className="line-clamp-2 min-h-[2.25rem] text-sm font-semibold leading-snug text-cream">
        {item.name}
      </p>
      <p className="mt-1 whitespace-nowrap text-sm font-bold text-tomato-light">
        {isPizza ? `dès ${formatEUR(itemPrice(item))}` : formatEUR(itemPrice(item))}
      </p>
      {isPizza ? <p className="mt-0.5 text-[10px] text-cream/40">31 · 40 · 50 · 60×40</p> : null}
    </button>
  )
}

function itemPrice(item: MenuItem) {
  return item.discountPrice ?? item.price
}

function isPizzaCategory(slug?: string | null) {
  return Boolean(slug && PIZZA_CATEGORY_IDS.has(slug))
}

function cartLineKey(line: CartLine) {
  return `${line.menuItem.id}:${line.sizeId ?? 'default'}`
}

function lineUnitPriceCents(line: CartLine) {
  return line.unitPriceCents
}

export function PosDisplay({
  mode = 'device',
  monitor = false,
  superApp = false,
}: {
  mode?: OpsViewMode
  monitor?: boolean
  /** Intégré dans PosSuperApp — sans gates ni header dupliqué */
  superApp?: boolean
}) {
  if (superApp) {
    return <PosScreenSuper />
  }
  if (mode === 'admin') {
    return <PosScreen mode="admin" monitor={monitor} lock={() => {}} operatorName={null} />
  }
  return (
    <DeviceShopGate deviceLabel="caisse POS">
      <DevicePinGate device="pos">
        <PosWebViewGate>
          <PosScreenDevice />
        </PosWebViewGate>
      </DevicePinGate>
    </DeviceShopGate>
  )
}

function PosScreenSuper() {
  const { lock, operatorName } = useDeviceLock()
  return <PosScreen mode="device" lock={lock} operatorName={operatorName} superApp />
}

function PosScreenDevice() {
  const { lock, operatorName } = useDeviceLock()
  return <PosScreen mode="device" lock={lock} operatorName={operatorName} />
}

function PosScreen({
  mode,
  monitor = false,
  lock,
  operatorName,
  superApp = false,
}: {
  mode: OpsViewMode
  monitor?: boolean
  lock: () => void
  operatorName: string | null
  superApp?: boolean
}) {
  const isAdminPreview = mode === 'admin'
  const authScope: AuthScope = authScopeForOpsMode(mode)
  const isAdmin = canAccessAdmin(getStaffUser(authScope)?.role ?? '')
  const [categories, setCategories] = useState<MenuCategory[]>([])
  const [categoryId, setCategoryId] = useState('')
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState<CartLine[]>([])
  const [orderType, setOrderType] = useState<'DINE_IN' | 'TAKEAWAY'>('TAKEAWAY')
  const [loading, setLoading] = useState(true)
  const [menuError, setMenuError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const { error, setError, setMessage } = useFeedbackState()
  const [pendingOnline, setPendingOnline] = useState<OpsOrder[]>([])
  const [handoverQueue, setHandoverQueue] = useState<OpsOrder[]>([])
  const [deliveryQueue, setDeliveryQueue] = useState<OpsOrder[]>([])
  const [connected, setConnected] = useState(false)
  const [paymentSheet, setPaymentSheet] = useState<PaymentSheetTarget>(null)
  const [handoverOrder, setHandoverOrder] = useState<OpsOrder | null>(null)
  const [cancelAlert, setCancelAlert] = useState<{ orderNumber: number; reason?: string } | null>(
    null
  )
  const [deliveryAlert, setDeliveryAlert] = useState<{
    orderNumber: number
    type: 'delivered' | 'issue' | 'en_route'
    detail?: string
  } | null>(null)
  const [deviceProfile, setDeviceProfile] = useState<PosDeviceProfile>('tablet')
  const [sunmiTab, setSunmiTab] = useState<PosSunmiTab>('catalog')
  const [sizePicker, setSizePicker] = useState<{
    item: MenuItem
    categorySlug: string
  } | null>(null)
  const [peripheralsOpen, setPeripheralsOpen] = useState(false)
  const [peripherals, setPeripherals] = useState<PosPeripheralSettings>(DEFAULT_POS_PERIPHERALS)

  useEffect(() => {
    setPeripherals(loadPosPeripherals())
  }, [])

  usePosPrintListener(!superApp)
  useDeviceDiagnosticListener(true)

  useEffect(() => {
    setDeviceProfile(detectPosDeviceProfile())
    return bootstrapOfflineSync()
  }, [])

  const loadMenu = useCallback(async () => {
    const session = getStaffSession(authScope)
    if (!session) {
      setLoading(false)
      return
    }
    setLoading(true)
    setMenuError(null)
    try {
      const data = await staffFetch<MenuCategory[]>(
        `/menu/categories?businessId=${session.businessId}`,
        { token: session.token },
      )
      if (!data.length) {
        setCategories([])
        setMenuError('Catalogue vide — synchronisez le menu depuis l’administration')
        return
      }
      setCategories(data)
      if (data[0]) setCategoryId(data[0].id)
    } catch (e) {
      setCategories([])
      setMenuError(e instanceof Error ? e.message : 'Menu indisponible')
    } finally {
      setLoading(false)
    }
  }, [authScope])

  const loadPendingOnline = useCallback(async () => {
    const session = getStaffSession(authScope)
    if (!session) return
    try {
      const data = await fetchOnlineOrdersForPos(session.token)
      setPendingOnline(data)
    } catch {
      /* ignore */
    }
  }, [])

  const loadHandoverQueue = useCallback(async () => {
    const session = getStaffSession(authScope)
    if (!session) return
    try {
      const data = await fetchPosHandoverQueue(session.token)
      setHandoverQueue(data)
    } catch {
      /* ignore */
    }
  }, [])

  const loadDeliveryQueue = useCallback(async () => {
    const session = getStaffSession(authScope)
    if (!session) return
    try {
      const data = await fetchPosDeliveryQueue(session.token)
      setDeliveryQueue(data)
    } catch {
      /* ignore */
    }
  }, [])

  const refreshQueues = useCallback(async () => {
    await Promise.all([loadPendingOnline(), loadHandoverQueue(), loadDeliveryQueue()])
  }, [loadPendingOnline, loadHandoverQueue, loadDeliveryQueue])

  useEffect(() => {
    const session = getStaffSession(authScope)
    if (!session) return
    void loadMenu()
    void refreshQueues()

    retainKitchenSocket()
    const socket = getKitchenSocket(session.token)

    function upsertOrder(list: OpsOrder[], order: OpsOrder): OpsOrder[] {
      if (list.some((o) => o.id === order.id)) {
        return list.map((o) => (o.id === order.id ? order : o))
      }
      return [order, ...list]
    }

    function removeOrder(list: OpsOrder[], orderId: string) {
      return list.filter((o) => o.id !== orderId)
    }

    function routeOrderToQueues(order: OpsOrder) {
      setPendingOnline((prev) =>
        isPosEncashmentOrder(order) ? upsertOrder(prev, order) : removeOrder(prev, order.id)
      )
      setHandoverQueue((prev) =>
        isPosHandoverOrder(order) ? upsertOrder(prev, order) : removeOrder(prev, order.id)
      )
      setDeliveryQueue((prev) =>
        isPosDeliveryOrder(order) ? upsertOrder(prev, order) : removeOrder(prev, order.id)
      )
    }

    const onConnect = () => {
      setConnected(true)
      joinBusinessRoom(socket, session.businessId)
      void refreshQueues()
    }
    const onDisconnect = () => setConnected(false)

    const onOnlinePending = (order: OpsOrder) => {
      if (!isPosEncashmentOrder(order)) return
      setPendingOnline((prev) => upsertOrder(prev, order))
      playSunmiNewOrderSound()
    }

    const onTerminalOrder = (order: OpsOrder) => {
      setPendingOnline((prev) => removeOrder(prev, order.id))
      setHandoverQueue((prev) => removeOrder(prev, order.id))
      setDeliveryQueue((prev) => removeOrder(prev, order.id))
    }

    const onOrderEvent = (order: OpsOrder) => {
      if (order.type === 'DELIVERY') {
        if (order.status === 'DELIVERED') {
          setDeliveryAlert({ orderNumber: order.orderNumber, type: 'delivered' })
        } else if (order.status === 'DELIVERY_ISSUE') {
          setDeliveryAlert({
            orderNumber: order.orderNumber,
            type: 'issue',
            detail: order.deliveryIssueReason ?? undefined,
          })
        } else if (order.status === 'OUT_FOR_DELIVERY') {
          setDeliveryAlert({ orderNumber: order.orderNumber, type: 'en_route' })
        }
      }
      if (['COMPLETED', 'DELIVERED', 'CANCELLED'].includes(order.status)) {
        onTerminalOrder(order)
        return
      }
      routeOrderToQueues(order)
    }

    const onCancelled = (order: OpsOrder) => {
      onTerminalOrder(order)
      if (order.paymentStatus === 'REFUNDED') {
        playSunmiNewOrderSound()
        const reason =
          order.cancelReason && order.cancelReason in CANCEL_REASON_LABEL
            ? CANCEL_REASON_LABEL[order.cancelReason as keyof typeof CANCEL_REASON_LABEL]
            : undefined
        setCancelAlert({ orderNumber: order.orderNumber, reason })
      }
    }

    const onOrderNew = (order: OpsOrder) => {
      if (isPosEncashmentOrder(order)) onOnlinePending(order)
      else if (isPosHandoverOrder(order) || isPosDeliveryOrder(order)) {
        routeOrderToQueues(order)
        playSunmiNewOrderSound()
      }
    }
    const onOrderPayment = (order: OpsOrder) => {
      if (isPosEncashmentOrder(order)) onOnlinePending(order)
      else onOrderEvent(order)
    }
    const onOrderStatus = (order: OpsOrder) => {
      if (isPosHandoverOrder(order) || isPosDeliveryOrder(order)) playSunmiNewOrderSound()
      onOrderEvent(order)
    }

    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    socket.on('order:onlinePending', onOnlinePending)
    socket.on('order:new', onOrderNew)
    socket.on('order:paymentUpdate', onOrderPayment)
    socket.on('order:statusUpdate', onOrderStatus)
    socket.on('order:cancelled', onCancelled)
    if (socket.connected) onConnect()

    return () => {
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      socket.off('order:onlinePending', onOnlinePending)
      socket.off('order:new', onOrderNew)
      socket.off('order:paymentUpdate', onOrderPayment)
      socket.off('order:statusUpdate', onOrderStatus)
      socket.off('order:cancelled', onCancelled)
      releaseKitchenSocket()
    }
  }, [loadMenu, refreshQueues])

  const handoverCount = handoverQueue.length
  const deliveryCount = deliveryQueue.length

  const allItems = categories.flatMap((c) => c.items).filter((i) => i.isAvailable)
  const filtered = search.trim()
    ? allItems.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()))
    : categories.find((c) => c.id === categoryId)?.items.filter((i) => i.isAvailable) ?? allItems

  const activeCategory = categories.find((c) => c.id === categoryId)
  const activeCategorySlug = activeCategory?.slug ?? null

  function categorySlugForItem(item: MenuItem) {
    if (search.trim()) {
      const cat = categories.find((c) => c.items.some((i) => i.id === item.id))
      return cat?.slug ?? null
    }
    return activeCategorySlug
  }

  function addToCart(item: MenuItem, sizeId?: PizzaSizeId, unitPriceCents?: number) {
    const priceCents = unitPriceCents ?? itemPrice(item)
    setCart((prev) => {
      const key = `${item.id}:${sizeId ?? 'default'}`
      const existing = prev.find((l) => cartLineKey(l) === key)
      if (existing) {
        return prev.map((l) =>
          cartLineKey(l) === key ? { ...l, quantity: l.quantity + 1 } : l
        )
      }
      return [
        ...prev,
        {
          menuItem: item,
          quantity: 1,
          sizeId,
          unitPriceCents: priceCents,
        },
      ]
    })
  }

  function pickMenuItem(item: MenuItem) {
    const slug = categorySlugForItem(item)
    if (isPizzaCategory(slug)) {
      setSizePicker({ item, categorySlug: slug! })
      return
    }
    addToCart(item)
    if (deviceProfile === 'sunmi') setSunmiTab('cart')
  }

  function changeQty(lineKey: string, delta: number) {
    setCart((prev) =>
      prev
        .map((l) => (cartLineKey(l) === lineKey ? { ...l, quantity: l.quantity + delta } : l))
        .filter((l) => l.quantity > 0)
    )
  }

  const subtotal = cart.reduce((s, l) => s + lineUnitPriceCents(l) * l.quantity, 0)

  async function placeCounterOrder(
    paymentMethod: 'CASH' | 'CARD' | 'CASH_SUMUP',
    paymentMeta?: PaymentMeta,
  ) {
    const session = getStaffSession(authScope)
    if (!session || !cart.length) return
    setSubmitting(true)
    setError(null)

    const payload = {
      items: cart.map((l) => ({
        menuItemId: l.menuItem.id,
        quantity: l.quantity,
        price: lineUnitPriceCents(l),
        selectedModifiers: l.sizeId
          ? { sizeId: l.sizeId, sizeLabel: pizzaSizeLabel(l.sizeId) }
          : undefined,
      })),
      type: orderType,
      paymentMethod,
    }

    const cartLines = cart.map((l) => ({
      name: l.menuItem.name,
      quantity: l.quantity,
      unitCents: lineUnitPriceCents(l),
      vatRateBps: l.menuItem.vatRateBps,
      sizeLabel: l.sizeId ? pizzaSizeLabel(l.sizeId) : undefined,
    }))

    try {
      const order = await createCounterOrder(session.token, { ...payload, paymentMeta })
      if (deviceProfile === 'sunmi') {
        const soldAt = new Date()
        const ticket = generateLocalKitchenTicket(cartLines, {
          orderType,
          paymentMethod,
          tempRef: String(order.orderNumber),
        })
        if (shouldAutoPrintKitchenOnPay(peripherals)) {
          void printKitchenWithCascade(ticket, 'KITCHEN', {
            allowSunmi: true,
            allowBrowser: false,
            peripherals,
          })
        }
        if (isSunmiPrinterAvailable() && peripheralsAllowPrint('RECEIPT', peripherals)) {
          const receipt = generateProvisionalReceipt(cartLines, {
            offlineRef: String(order.orderNumber),
            orderType,
            paymentMethod,
            soldAt,
          })
          printOnSunmi(receipt, 'RECEIPT')
        }
        playSunmiNewOrderSound()
      }
      setCart([])
      setPaymentSheet(null)
      if (deviceProfile === 'sunmi') setSunmiTab('catalog')
    } catch (e) {
      const offline = typeof navigator !== 'undefined' && !navigator.onLine
      if (offline) {
        try {
          const offlineRef = newOfflineRef()
          const soldAt = new Date()
          const cartLines = cart.map((l) => ({
            name: l.menuItem.name,
            quantity: l.quantity,
            unitCents: lineUnitPriceCents(l),
            vatRateBps: l.menuItem.vatRateBps,
            sizeLabel: l.sizeId ? pizzaSizeLabel(l.sizeId) : undefined,
          }))
          const ticket = generateLocalKitchenTicket(cartLines, {
            orderType,
            paymentMethod,
            tempRef: offlineRef,
          })
          const provisionalReceipt = generateProvisionalReceipt(cartLines, {
            offlineRef,
            orderType,
            paymentMethod,
            soldAt,
          })
          void printKitchenWithCascade(ticket, 'KITCHEN', {
            allowSunmi: true,
            allowBrowser: false,
            peripherals,
          })
          if (isSunmiPrinterAvailable() && peripheralsAllowPrint('RECEIPT', peripherals)) {
            printOnSunmi(provisionalReceipt, 'RECEIPT')
          }
          await queueOfflineCounterOrder({
            offlineRef,
            offlineSoldAt: soldAt.toISOString(),
            payload,
            localKitchenTicket: ticket,
            localProvisionalReceipt: provisionalReceipt,
            printedLocally: true,
          })
          setCart([])
          setPaymentSheet(null)
          if (deviceProfile === 'sunmi') setSunmiTab('catalog')
          setMessage('Commande enregistrée hors-ligne — sync automatique au retour réseau')
          return
        } catch (offlineErr) {
          setError(
            offlineErr instanceof Error ? offlineErr.message : 'Enregistrement hors-ligne impossible',
          )
          throw offlineErr
        }
      }
      const msg = e instanceof Error ? e.message : 'Commande impossible'
      setError(msg)
      throw e
    } finally {
      setSubmitting(false)
    }
  }

  function startCartPayment() {
    if (!cart.length) return
    setPaymentSheet({ kind: 'cart', reference: `POS-${Date.now()}` })
  }

  function startOnlinePayment(order: OpsOrder) {
    setPaymentSheet({ kind: 'online', order })
  }

  async function payOnlineOrder(
    orderId: string,
    method: 'CASH' | 'CARD' | 'CASH_SUMUP',
    paymentMeta?: PaymentMeta,
  ) {
    if (method === 'CASH_SUMUP') return // pas de bouton dédié ici — commande internet, pas comptoir SumUp
    const session = getStaffSession(authScope)
    if (!session) return
    setSubmitting(true)
    setError(null)
    try {
      await encashOnlineOrder(orderId, method, session.token, paymentMeta)
      setPaymentSheet(null)
      await loadPendingOnline()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Encaissement impossible')
      throw e
    } finally {
      setSubmitting(false)
    }
  }

  async function confirmHandover() {
    if (!handoverOrder) return
    const session = getStaffSession(authScope)
    if (!session) return
    setSubmitting(true)
    setError(null)
    try {
      await settlePosOrder(handoverOrder.id, session.token, { action: 'handover' })
      setHandoverOrder(null)
      await loadHandoverQueue()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Finalisation impossible')
    } finally {
      setSubmitting(false)
    }
  }

  const cartCount = cart.reduce((n, l) => n + l.quantity, 0)
  const isSunmi = deviceProfile === 'sunmi'

  function switchProfile(next: PosDeviceProfile) {
    setPosDeviceProfile(next)
    setDeviceProfile(next)
  }

  const catalogPanel = (
    <div className="flex h-full min-h-0 flex-col p-3">
      <div className="mb-2 flex flex-wrap gap-2">
        {(['TAKEAWAY', 'DINE_IN'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setOrderType(t)}
            className={cn(
              'rounded-xl px-4 py-2 text-sm font-medium',
              orderType === t ? 'bg-tomato text-white' : 'border border-white/15'
            )}
          >
            {ORDER_TYPE_LABEL[t]}
          </button>
        ))}
      </div>
      <div className="relative mb-2">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cream/30" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher…"
          className="w-full rounded-xl border border-white/10 bg-[#1A1412] py-2.5 pl-10 pr-4 text-sm"
        />
      </div>
      {!search && (
        <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1">
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategoryId(c.id)}
              className={cn(
                'shrink-0 rounded-lg px-2.5 py-1.5 font-medium',
                isSunmi ? 'text-[11px]' : 'text-xs',
                categoryId === c.id
                  ? 'bg-tomato/20 text-tomato-light'
                  : 'border border-white/10 text-cream/60'
              )}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}
      <div
        className={cn(
          'grid min-h-0 flex-1 content-start overflow-y-auto',
          isSunmi
            ? 'grid-cols-2 gap-1.5 sm:grid-cols-3'
            : 'grid-cols-2 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3'
        )}
      >
        {filtered.map((item) => {
          const slug = categorySlugForItem(item)
          return (
            <PosMenuTile
              key={item.id}
              item={item}
              compact={isSunmi}
              isPizza={isPizzaCategory(slug)}
              onPick={() => pickMenuItem(item)}
            />
          )
        })}
      </div>
    </div>
  )

  const cartPanel = (
    <div className="flex h-full min-h-0 flex-col rounded-2xl border border-white/10 bg-[#1A1412] m-3">
      <div className="border-b border-white/10 p-3">
        <h2 className="flex items-center gap-2 font-semibold">
          <ShoppingCart className="h-5 w-5" />
          Panier ({cartCount})
        </h2>
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {cart.map((line) => {
          const key = cartLineKey(line)
          return (
          <div
            key={key}
            className="flex items-center gap-2 rounded-xl bg-white/[0.03] p-2"
          >
                <div className="h-8 w-8 shrink-0 overflow-hidden rounded-md">
                  <MenuThumb
                    src={resolveMenuItemImageUrl(line.menuItem.image)}
                    alt={line.menuItem.name}
                    className="h-8 w-8"
                    iconClass="h-3.5 w-3.5"
                  />
                </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{line.menuItem.name}</p>
              <p className="text-xs text-cream/45">
                {line.sizeId ? `${pizzaSizeLabel(line.sizeId)} · ` : ''}
                {formatEUR(lineUnitPriceCents(line))}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => changeQty(key, -1)}
                className="flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-white/10 active:bg-white/20"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-6 text-center text-sm">{line.quantity}</span>
              <button
                type="button"
                onClick={() => changeQty(key, 1)}
                className="flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-white/10 active:bg-white/20"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>
        )})}
        {!cart.length && <p className="py-6 text-center text-sm text-cream/35">Panier vide</p>}
      </div>
      <div className="space-y-2 border-t border-white/10 p-3">
        <div className="flex justify-between text-sm">
          <span className="text-cream/50">Total</span>
          <span className="font-bold">{formatEUR(subtotal)}</span>
        </div>
        <button
          type="button"
          disabled={!cart.length || submitting}
          onClick={startCartPayment}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-tomato py-3 font-semibold text-white disabled:opacity-40"
        >
          <CreditCard className="h-4 w-4" />
          Encaisser
        </button>
        <p className="text-center text-[10px] text-cream/35">
          Paiement puis envoi cuisine automatique
        </p>
      </div>
    </div>
  )

  const onlinePanel = (
    <div className="h-full overflow-y-auto p-3">
      <QueuePanel
        title="À encaisser — paiement au comptoir"
        count={pendingOnline.length}
        accent="amber"
        empty="Aucune commande à encaisser"
        icon={<Bell className="h-4 w-4" />}
      >
        {pendingOnline.map((order) => (
          <div
            key={order.id}
            className="rounded-xl border border-amber-500/20 bg-charcoal/80 p-3 text-sm"
          >
            <p className="font-bold text-tomato-light">#{order.orderNumber}</p>
            <p className="text-cream/70">{orderCustomerLine(order)}</p>
            <p className="text-xs text-cream/50">
              {ORDER_TYPE_LABEL[order.type]} · {formatEUR(order.total)} · non payé
            </p>
            <button
              type="button"
              disabled={submitting}
              onClick={() => startOnlinePayment(order)}
              className="mt-2 w-full rounded-lg bg-tomato py-2 text-xs font-bold text-white"
            >
              Encaisser puis envoyer cuisine
            </button>
          </div>
        ))}
      </QueuePanel>
    </div>
  )

  const readyPanel = (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-3">
      <QueuePanel
        title="À remettre — déjà payé"
        count={handoverCount}
        accent="blue"
        empty="Rien à remettre au client"
      >
        {handoverQueue.map((order) => (
          <ReadyOrderCard
            key={order.id}
            order={order}
            actionLabel="Remise client"
            onAction={() => setHandoverOrder(order)}
          />
        ))}
      </QueuePanel>
      <QueuePanel
        title="Livraisons — suivi"
        count={deliveryCount}
        accent="emerald"
        empty="Aucune livraison en cours"
        icon={<Truck className="h-4 w-4" />}
      >
        {deliveryQueue.map((order) => (
          <DeliveryOrderCard key={order.id} order={order} />
        ))}
      </QueuePanel>
    </div>
  )

  if (loading) {
    return (
      <div className="flex h-full flex-1 items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-tomato-light" />
      </div>
    )
  }

  if (menuError) {
    return (
      <div className="flex h-full flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <AlertCircle className="h-12 w-12 text-tomato-light" />
        <p className="max-w-md text-cream/70">{menuError}</p>
        <button
          type="button"
          onClick={() => void loadMenu()}
          className="rounded-xl bg-tomato px-6 py-2.5 text-sm font-bold text-white hover:bg-tomato-light"
        >
          Réessayer
        </button>
      </div>
    )
  }

  return (
    <div className="pos-touch flex h-full min-h-0 flex-col overflow-hidden bg-charcoal text-cream">
      {!superApp && (
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div>
          <h1 className="font-display text-lg font-bold text-cream">
            {monitor
              ? 'Moniteur caisse'
              : isAdminPreview
                ? 'Suivi caisse / accueil (CRM)'
                : isSunmi
                  ? 'Caisse SUNMI'
                  : 'Caisse tablette'}
          </h1>
          <p className="text-xs text-cream/45">
            {connected ? '● En ligne' : '○ Hors ligne'}
            {(operatorName ?? (isAdminPreview ? getStaffUser(authScope)?.name : null))
              ? ` — ${operatorName ?? getStaffUser(authScope)?.name}`
              : ''}
            {!isAdminPreview && (
              <>
                {' · '}
                <button
                  type="button"
                  className="underline decoration-dotted"
                  onClick={() => switchProfile(isSunmi ? 'tablet' : 'sunmi')}
                >
                  {isSunmi ? 'Mode tablette' : 'Mode SUNMI'}
                </button>
              </>
            )}
          </p>
          {isAdminPreview && !monitor && (
            <p className="text-[11px] text-blue-300/80">
              Ouvrez le moniteur en fenêtre dédiée depuis le hub CRM.
            </p>
          )}
          {monitor && (
            <p className="text-[11px] text-emerald-300/80">
              Même flux que le terminal boutique /pos — files d&apos;attente et encaissements en direct.
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!isAdminPreview && (
            <>
              {!isSunmi && !isLandscapeDeviceApk() && <DeviceOrientationButton forceShow />}
              <DeviceFullscreenButton />
              <button
                type="button"
                onClick={() => setPeripheralsOpen(true)}
                className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-cream/60 hover:bg-white/5"
                title="Périphériques POS"
              >
                <Settings2 className="mr-1 inline h-3.5 w-3.5" />
                Périph.
              </button>
            </>
          )}
          {isAdmin && !isAdminPreview && (
            <Link
              href="/admin/pos"
              className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-cream/60 hover:bg-white/5"
            >
              Paramètres
            </Link>
          )}
          {!isAdminPreview && canAccessKitchen(getStaffUser(authScope)?.role ?? '') && (
            <Link
              href="/kitchen"
              target="_blank"
              className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-cream/60 hover:bg-white/5"
            >
              Cuisine
            </Link>
          )}
          {!isAdminPreview && (
            <button
              type="button"
              onClick={lock}
              className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-100"
            >
              <Lock className="mr-1 inline h-3.5 w-3.5" />
              Verrouiller
            </button>
          )}
        </div>
      </header>
      )}

      {!superApp && (
      <div className="px-4 pt-2">
        <PosOfflineBanner />
      </div>
      )}

      {superApp && (
        <div className="shrink-0 border-b border-white/10 px-3 py-1.5">
          <PosOfflineBanner />
        </div>
      )}

      {error && (
        <p className="border-b border-red-500/30 bg-red-950/40 px-4 py-2 text-center text-sm text-red-200">
          {error}
        </p>
      )}

      {cancelAlert && (
        <div className="flex items-center justify-between gap-3 border-b border-amber-500/40 bg-amber-950/50 px-4 py-3">
          <p className="text-sm text-amber-100">
            <strong>Commande #{cancelAlert.orderNumber} annulée en cuisine</strong>
            {cancelAlert.reason ? ` — ${cancelAlert.reason}` : ''}. Rembourser le client si déjà
            encaissé.
          </p>
          <button
            type="button"
            onClick={() => setCancelAlert(null)}
            className="shrink-0 rounded-lg p-1 text-amber-200/70 hover:bg-white/10"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {deliveryAlert && (
        <div
          className={`flex items-center justify-between gap-3 border-b px-4 py-3 ${
            deliveryAlert.type === 'delivered'
              ? 'border-emerald-500/40 bg-emerald-950/50'
              : deliveryAlert.type === 'issue'
                ? 'border-amber-500/40 bg-amber-950/50'
                : 'border-violet-500/40 bg-violet-950/50'
          }`}
        >
          <p className="text-sm text-cream">
            <strong>Livraison #{deliveryAlert.orderNumber}</strong>
            {deliveryAlert.type === 'delivered' && ' — livrée (code client validé)'}
            {deliveryAlert.type === 'issue' && ' — retour livreur, reprise cuisine'}
            {deliveryAlert.type === 'en_route' && ' — en route'}
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/livreur"
              target="_blank"
              className="rounded-lg border border-white/15 px-2 py-1 text-[10px] text-cream/70"
            >
              Tournée
            </Link>
            <button
              type="button"
              onClick={() => setDeliveryAlert(null)}
              className="rounded-lg p-1 text-cream/50 hover:bg-white/10"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {isSunmi ? (
        <PosSunmiShell
          active={sunmiTab}
          onChange={setSunmiTab}
          cartCount={cartCount}
          onlineCount={pendingOnline.length}
          readyCount={handoverCount + deliveryCount}
          catalog={catalogPanel}
          cart={cartPanel}
          online={onlinePanel}
          ready={readyPanel}
        />
      ) : (
        <div className="flex flex-1 flex-col gap-3 overflow-hidden p-3 lg:flex-row lg:p-4">
          <div className="flex min-h-0 flex-1 flex-col lg:min-w-0">{catalogPanel}</div>
          <div className="flex w-full shrink-0 flex-col lg:w-72">{cartPanel}</div>
          <div className="flex w-full shrink-0 flex-col gap-3 lg:w-80">
            {readyPanel}
            {onlinePanel}
          </div>
        </div>
      )}

      {paymentSheet?.kind === 'cart' && (
        <PosPaymentSheet
          open
          title="Encaissement comptoir"
          subtitle={`${ORDER_TYPE_LABEL[orderType]} · TPE ${getPaymentTerminalMode() === 'native' ? 'connecté' : 'manuel'}`}
          amountCents={subtotal}
          reference={paymentSheet.reference}
          token={getStaffSession(authScope)?.token}
          lines={cart.map((line) => ({
            id: cartLineKey(line),
            label: `${line.quantity}× ${line.menuItem.name}${line.sizeId ? ` (${pizzaSizeLabel(line.sizeId)})` : ''}`,
            amountCents: lineUnitPriceCents(line) * line.quantity,
          }))}
          busy={submitting}
          onClose={() => setPaymentSheet(null)}
          onPaid={(method, meta) => placeCounterOrder(method, meta)}
          allowCashSumup
        />
      )}

      {paymentSheet?.kind === 'online' && (
        <PosPaymentSheet
          open
          title={`Commande internet #${paymentSheet.order.orderNumber}`}
          subtitle={orderCustomerLine(paymentSheet.order)}
          amountCents={paymentSheet.order.total}
          reference={paymentSheet.order.id}
          token={getStaffSession(authScope)?.token}
          lines={paymentSheet.order.items.map((item) => ({
            id: item.id,
            label: `${item.quantity}× ${item.menuItem.name ?? 'Article'}`,
            amountCents: item.price * item.quantity,
          }))}
          busy={submitting}
          onClose={() => setPaymentSheet(null)}
          onPaid={(method, meta) => payOnlineOrder(paymentSheet.order.id, method, meta)}
        />
      )}

      {sizePicker && (
        <PosPizzaSizeSheet
          itemName={sizePicker.item.name}
          basePriceCents={itemPrice(sizePicker.item)}
          onClose={() => setSizePicker(null)}
          onPick={(sizeId, unitPriceCents) => {
            addToCart(sizePicker.item, sizeId, unitPriceCents)
            setSizePicker(null)
            if (deviceProfile === 'sunmi') setSunmiTab('cart')
          }}
        />
      )}

      {handoverOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#1A1412] p-6 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-2">
              <div>
                <p className="text-xs uppercase tracking-wide text-cream/40">Remise au client</p>
                <h3 className="font-display text-2xl font-bold text-tomato-light">
                  #{handoverOrder.orderNumber}
                </h3>
                <p className="text-sm text-cream/60">
                  {orderCustomerLine(handoverOrder)}{' '}
                  <span
                    className={cn(
                      'ml-1 rounded-full px-2 py-0.5 text-[10px] font-semibold',
                      orderChannelBadgeClass(handoverOrder),
                    )}
                  >
                    {orderChannelLabel(handoverOrder)}
                  </span>
                </p>
              </div>
              <button type="button" onClick={() => setHandoverOrder(null)} disabled={submitting}>
                <X className="h-5 w-5 text-cream/50" />
              </button>
            </div>

            <ul className="mb-4 max-h-32 space-y-1 overflow-y-auto rounded-xl bg-white/[0.03] p-3 text-sm">
              {handoverOrder.items.map((item) => (
                <li key={item.id}>
                  <OrderItemLines item={item} />
                </li>
              ))}
            </ul>

            <p className="mb-4 text-center text-2xl font-bold text-cream">
              {formatEUR(handoverOrder.total)} · déjà payé — pas de ré-encaissement
            </p>

            <button
              type="button"
              disabled={submitting}
              onClick={() => void confirmHandover()}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 font-semibold text-white"
            >
              <Package className="h-5 w-5" />
              Commande remise — archiver
            </button>
          </div>
        </div>
      )}

      <PosPeripheralsPanel
        open={peripheralsOpen}
        onClose={() => setPeripheralsOpen(false)}
        settings={peripherals}
        onChange={setPeripherals}
      />
    </div>
  )
}

function DeliveryOrderCard({ order }: { order: OpsOrder }) {
  const address = orderAddressLine(order)
  const token = order.trackingToken

  return (
    <div className="rounded-xl border border-violet-500/25 bg-charcoal/90 p-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-bold text-tomato-light">#{order.orderNumber}</p>
          <p className="text-cream/75">{orderCustomerLine(order)}</p>
          <p className="text-[11px] text-cream/50">
            {ORDER_STATUS_LABEL[order.status] ?? order.status} · {formatEUR(order.total)} · payé
          </p>
        </div>
        <Truck className="h-4 w-4 shrink-0 text-violet-300" />
      </div>
      {address ? (
        <p className="mt-2 flex items-start gap-1 text-xs text-cream/60">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {address}
        </p>
      ) : null}
      {token ? (
        <div className="mt-2 flex flex-wrap gap-2">
          <a
            href={publicSitePath(`/suivi/${token}`)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-lg border border-white/15 px-2 py-1 text-[10px] text-cream/70 hover:bg-white/5"
          >
            <ExternalLink className="h-3 w-3" />
            Suivi client
          </a>
          <a
            href={publicSitePath(`/livreur/${token}?hub=1`)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-lg border border-violet-500/30 bg-violet-500/10 px-2 py-1 text-[10px] text-violet-200 hover:bg-violet-500/20"
          >
            <MapPin className="h-3 w-3" />
            Fiche livreur
          </a>
          <a
            href={publicSitePath('/livreur')}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-lg border border-violet-500/20 px-2 py-1 text-[10px] text-violet-200/80"
          >
            Tournée
          </a>
        </div>
      ) : null}
      {order.status === 'READY' ? (
        <p className="mt-2 text-[10px] text-cream/45">Prête en cuisine — départ depuis le KDS</p>
      ) : (
        <p className="mt-2 text-[10px] text-emerald-300/80">En route — clôture depuis le KDS</p>
      )}
    </div>
  )
}

function QueuePanel({
  title,
  count,
  accent,
  empty,
  icon,
  children,
}: {
  title: string
  count: number
  accent: 'emerald' | 'blue' | 'amber'
  empty: string
  icon?: React.ReactNode
  children: React.ReactNode
}) {
  const border =
    accent === 'emerald'
      ? 'border-emerald-500/25'
      : accent === 'blue'
        ? 'border-blue-500/25'
        : 'border-amber-500/20'
  const bg =
    accent === 'emerald'
      ? 'bg-emerald-500/5'
      : accent === 'blue'
        ? 'bg-blue-500/5'
        : 'bg-amber-500/5'

  return (
    <div className={cn('flex max-h-56 flex-col rounded-2xl border lg:max-h-none lg:flex-1', border, bg)}>
      <div className={cn('border-b px-3 py-2', border)}>
        <h2 className="flex items-center gap-2 text-xs font-semibold">
          {icon}
          {title} ({count})
        </h2>
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
        {count === 0 ? (
          <p className="py-4 text-center text-[11px] text-cream/35">{empty}</p>
        ) : (
          children
        )}
      </div>
    </div>
  )
}

function ReadyOrderCard({
  order,
  actionLabel,
  onAction,
}: {
  order: OpsOrder
  actionLabel: string
  onAction: () => void
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-charcoal/90 p-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-bold text-tomato-light">#{order.orderNumber}</p>
          <p className="text-cream/70">{orderCustomerLine(order)}</p>
          <p className="text-[11px] text-cream/50">
            {ORDER_TYPE_LABEL[order.type]} ·{' '}
            <span
              className={cn(
                'rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                orderChannelBadgeClass(order),
              )}
            >
              {orderChannelLabel(order)}
            </span>{' '}
            · {PAYMENT_STATUS_LABEL[order.paymentStatus] ?? order.paymentStatus}
          </p>
        </div>
        <p className="font-bold text-cream">{formatEUR(order.total)}</p>
      </div>
      <p className="mt-1 text-[10px] text-emerald-300/70">Déjà payé — remise au client uniquement</p>
      <button
        type="button"
        onClick={onAction}
        className="mt-2 w-full rounded-lg bg-tomato py-2 text-xs font-bold text-white"
      >
        {actionLabel}
      </button>
    </div>
  )
}
