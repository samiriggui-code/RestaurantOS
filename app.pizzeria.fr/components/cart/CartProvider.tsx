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
import type { CartLine, OrderType } from '@/lib/cart-types'
import type { PizzaSizeId } from '@/lib/pizza-sizes'
import { pizzaSizeLabel, priceForPizzaSize, weeklyPromoPrice } from '@/lib/pizza-sizes'
import { PIZZA_CATEGORY_IDS } from '@/lib/menu-types'

import type { CheckoutStepId } from '@/lib/checkout-flow'

const STORAGE_KEY = 'laz-pizza-cart-v2'
const TRACKING_KEY = 'laz-pizza-active-tracking'

export type ActiveTracking = {
  token: string
  orderNumber: number
}

type AddItemInput = {
  slug: string
  name: string
  categoryId: string
  basePrice: number
  quantity?: number
  sizeId?: PizzaSizeId
  unitPrice?: number
  image?: string
  catalogPrice?: number
  offerTag?: string
}

type CartContextValue = {
  hydrated: boolean
  lines: CartLine[]
  itemCount: number
  subtotal: number
  sheetOpen: boolean
  sheetInitialStep: CheckoutStepId | null
  activeTracking: ActiveTracking | null
  openCartSheet: (step?: CheckoutStepId) => void
  closeCartSheet: () => void
  setActiveTracking: (tracking: ActiveTracking | null) => void
  clearActiveTracking: () => void
  addItem: (input: AddItemInput) => void
  updateQuantity: (lineId: string, quantity: number) => void
  removeLine: (lineId: string) => void
  clearCart: () => void
  /** Recalcule le prix des pizzas éligibles à la promo hebdo selon le mode choisi (à emporter/livraison). */
  applyOrderTypePricing: (orderType: OrderType) => void
}

const CartContext = createContext<CartContextValue | null>(null)

function newLineId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function loadStored(): CartLine[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as CartLine[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function loadStoredTracking(): ActiveTracking | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(TRACKING_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as ActiveTracking
    if (parsed?.token && typeof parsed.orderNumber === 'number') return parsed
    return null
  } catch {
    return null
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([])
  const [hydrated, setHydrated] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetInitialStep, setSheetInitialStep] = useState<CheckoutStepId | null>(null)
  const [activeTracking, setActiveTrackingState] = useState<ActiveTracking | null>(null)

  const setActiveTracking = useCallback((tracking: ActiveTracking | null) => {
    setActiveTrackingState(tracking)
    if (typeof window === 'undefined') return
    if (tracking) {
      localStorage.setItem(TRACKING_KEY, JSON.stringify(tracking))
    } else {
      localStorage.removeItem(TRACKING_KEY)
    }
  }, [])

  const clearActiveTracking = useCallback(() => {
    setActiveTracking(null)
  }, [setActiveTracking])

  const openCartSheet = useCallback((step?: CheckoutStepId) => {
    setSheetInitialStep(step ?? null)
    setSheetOpen(true)
  }, [])
  const closeCartSheet = useCallback(() => {
    setSheetOpen(false)
    setSheetInitialStep(null)
  }, [])

  useEffect(() => {
    setLines(loadStored())
    setActiveTrackingState(loadStoredTracking())
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lines))
  }, [lines, hydrated])

  const addItem = useCallback((input: AddItemInput) => {
    setActiveTracking(null)
    const qty = input.quantity ?? 1
    const sizeId = PIZZA_CATEGORY_IDS.has(input.categoryId) ? (input.sizeId ?? '31') : undefined
    const unitPrice = input.unitPrice ?? input.basePrice

    setLines((prev) => {
      const existing = prev.find(
        (l) =>
          l.slug === input.slug &&
          l.sizeId === sizeId &&
          l.unitPrice === unitPrice &&
          l.offerTag === input.offerTag
      )
      if (existing) {
        return prev.map((l) =>
          l.lineId === existing.lineId ? { ...l, quantity: l.quantity + qty } : l
        )
      }
      return [
        ...prev,
        {
          lineId: newLineId(),
          slug: input.slug,
          name: input.name,
          categoryId: input.categoryId,
          unitPrice,
          quantity: qty,
          sizeId,
          sizeLabel: sizeId ? pizzaSizeLabel(sizeId) : undefined,
          image: input.image,
          catalogPrice: input.catalogPrice,
          offerTag: input.offerTag,
        },
      ]
    })
  }, [setActiveTracking])

  const updateQuantity = useCallback((lineId: string, quantity: number) => {
    if (quantity < 1) {
      setLines((prev) => prev.filter((l) => l.lineId !== lineId))
      return
    }
    setLines((prev) => prev.map((l) => (l.lineId === lineId ? { ...l, quantity } : l)))
  }, [])

  const removeLine = useCallback((lineId: string) => {
    setLines((prev) => prev.filter((l) => l.lineId !== lineId))
  }, [])

  const clearCart = useCallback(() => setLines([]), [])

  const applyOrderTypePricing = useCallback((orderType: OrderType) => {
    setLines((prev) =>
      prev.map((l) => {
        if (!l.sizeId || l.catalogPrice == null) return l
        const normal = priceForPizzaSize(l.catalogPrice, l.sizeId)
        const promo = weeklyPromoPrice(l.categoryId, l.sizeId, orderType)
        const unitPrice = promo ?? normal
        return unitPrice === l.unitPrice ? l : { ...l, unitPrice }
      }),
    )
  }, [])

  const itemCount = useMemo(() => lines.reduce((s, l) => s + l.quantity, 0), [lines])
  const subtotal = useMemo(
    () => lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0),
    [lines]
  )

  const value = useMemo(
    () => ({
      lines,
      itemCount,
      subtotal,
      hydrated,
      sheetOpen,
      sheetInitialStep,
      activeTracking,
      openCartSheet,
      closeCartSheet,
      setActiveTracking,
      clearActiveTracking,
      addItem,
      updateQuantity,
      removeLine,
      clearCart,
      applyOrderTypePricing,
    }),
    [
      lines,
      itemCount,
      subtotal,
      hydrated,
      sheetOpen,
      sheetInitialStep,
      activeTracking,
      openCartSheet,
      closeCartSheet,
      setActiveTracking,
      clearActiveTracking,
      addItem,
      updateQuantity,
      removeLine,
      clearCart,
      applyOrderTypePricing,
    ],
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}
