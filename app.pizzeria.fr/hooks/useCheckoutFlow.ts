'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useFeedbackState } from '@/lib/use-feedback-state'
import { useCheckoutTotal } from '@/components/checkout/CheckoutSummary'
import type { CheckoutDraft, OrderType } from '@/lib/cart-types'
import type { DeliveryQuote } from '@/lib/delivery'
import { fetchDeliveryQuote } from '@/lib/delivery-api'
import { townsForPostalCode, normalizePostalCode } from '@/lib/delivery'
import { fetchAvailableTimeSlots } from '@/lib/time-slots-api'
import {
  buildCheckoutSteps,
  buildSheetCheckoutSteps,
  type CheckoutStepId,
} from '@/lib/checkout-flow'
import {
  clearCheckoutSession,
  computeCartFingerprint,
  loadCheckoutSession,
  resolveSafeCheckoutStep,
  saveCheckoutSession,
} from '@/lib/checkout-session'
import { clearPendingPayment } from '@/lib/pending-payment-session'
import { formatPriceEUR } from '@/lib/menu-types'
import { pizzaSubtotalFromLines } from '@/lib/pizza-subtotal'
import type { CartLine } from '@/lib/cart-types'

export type CheckoutFlowVariant = 'page' | 'sheet'

type UseCheckoutFlowOptions = {
  variant: CheckoutFlowVariant
  lines: CartLine[]
  subtotal: number
  itemCount: number
  cartHydrated: boolean
  clearCart: () => void
  /** Mode choisi dans le toggle du sheet (variant sheet uniquement) */
  sheetOrderType?: OrderType
  onBrowseMenu?: () => void
  /** Appelé après paiement réussi — remplace la redirection /suivi si fourni */
  onPaymentSuccess?: (token: string, orderNumber: number) => void
}

const SHEET_STEP_TITLES: Partial<Record<CheckoutStepId, string>> = {
  recap: 'Panier',
  address: 'Livraison',
  details: 'Coordonnées',
  confirm: 'Paiement',
}

export function useCheckoutFlow({
  variant,
  lines,
  subtotal,
  itemCount,
  cartHydrated,
  clearCart,
  sheetOrderType,
  onBrowseMenu,
  onPaymentSuccess,
}: UseCheckoutFlowOptions) {
  const router = useRouter()
  const [step, setStep] = useState<CheckoutStepId>('recap')
  const [orderType, setOrderType] = useState<OrderType | null>(variant === 'sheet' ? (sheetOrderType ?? 'delivery') : null)
  const [customerFirstName, setCustomerFirstName] = useState('')
  const [customerLastName, setCustomerLastName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [addressLine, setAddressLine] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [city, setCity] = useState('')
  const [instructions, setInstructions] = useState('')
  const [timeSlot, setTimeSlot] = useState('')
  const [slots, setSlots] = useState<string[]>([])
  const [slotsClosedReason, setSlotsClosedReason] = useState<string | null>(null)
  const [slotsLoading, setSlotsLoading] = useState(true)
  const [paymentMode, setPaymentMode] = useState<'online' | 'counter'>('online')
  const { error, setError } = useFeedbackState()
  const [sessionHydrated, setSessionHydrated] = useState(false)
  const [deliveryQuote, setDeliveryQuote] = useState<DeliveryQuote | null>(null)
  const skipPersist = useRef(true)
  const sessionRestored = useRef(false)

  const effectiveOrderType = variant === 'sheet' ? (sheetOrderType ?? orderType ?? 'delivery') : orderType

  useEffect(() => {
    if (variant !== 'sheet' || !sheetOrderType) return
    setOrderType(sheetOrderType)
    if (step === 'address' && sheetOrderType !== 'delivery') {
      setStep('recap')
    }
  }, [variant, sheetOrderType, step])

  useEffect(() => {
    let cancelled = false
    setSlotsLoading(true)
    void fetchAvailableTimeSlots().then((result) => {
      if (cancelled) return
      setSlots(result.slots)
      setSlotsClosedReason(
        result.isOpen ? null : (result.closedReason ?? result.openStatus?.sublabel ?? 'Fermé'),
      )
      setSlotsLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [step])

  const pizzaSubtotal = useMemo(() => pizzaSubtotalFromLines(lines), [lines])
  const cartFingerprint = useMemo(() => computeCartFingerprint(lines), [lines])

  useEffect(() => {
    if (!cartHydrated || sessionRestored.current) return
    sessionRestored.current = true

    const saved = loadCheckoutSession()
    if (!saved) {
      setSessionHydrated(true)
      return
    }

    const safeStep = resolveSafeCheckoutStep(saved.step, saved.orderType, saved)
    setStep(safeStep)
    if (variant === 'page') {
      setOrderType(saved.orderType)
    }
    setCustomerFirstName(saved.customerFirstName)
    setCustomerLastName(saved.customerLastName)
    setCustomerPhone(saved.customerPhone)
    setCustomerEmail(saved.customerEmail)
    setAddressLine(saved.addressLine)
    setPostalCode(saved.postalCode)
    setCity(saved.city)
    setInstructions(saved.instructions)
    if (saved.timeSlot) setTimeSlot(saved.timeSlot)
    setSessionHydrated(true)
  }, [cartHydrated, variant])

  const persistCheckout = useCallback(() => {
    saveCheckoutSession({
      step,
      orderType: effectiveOrderType,
      customerFirstName,
      customerLastName,
      customerPhone,
      customerEmail,
      addressLine,
      postalCode,
      city,
      instructions,
      timeSlot,
      cartFingerprint,
      subtotal,
    })
  }, [
    step,
    effectiveOrderType,
    customerFirstName,
    customerLastName,
    customerPhone,
    customerEmail,
    addressLine,
    postalCode,
    city,
    instructions,
    timeSlot,
    cartFingerprint,
    subtotal,
  ])

  useEffect(() => {
    if (!sessionHydrated || itemCount === 0) return
    if (skipPersist.current) {
      skipPersist.current = false
      return
    }
    persistCheckout()
  }, [sessionHydrated, itemCount, persistCheckout])

  const checkoutDraft = useMemo((): CheckoutDraft | null => {
    if (!effectiveOrderType) return null
    return {
      orderType: effectiveOrderType,
      customerFirstName: customerFirstName.trim(),
      customerLastName: customerLastName.trim(),
      customerPhone: customerPhone.trim(),
      customerEmail: customerEmail.trim(),
      addressLine: effectiveOrderType === 'delivery' ? addressLine.trim() : '',
      postalCode: effectiveOrderType === 'delivery' ? postalCode.trim() : '',
      city: effectiveOrderType === 'delivery' ? city.trim() : '',
      instructions: instructions.trim(),
      timeSlot,
      paymentMode,
    }
  }, [
    effectiveOrderType,
    customerFirstName,
    customerLastName,
    customerPhone,
    customerEmail,
    addressLine,
    postalCode,
    city,
    instructions,
    timeSlot,
    paymentMode,
  ])

  const steps = useMemo(() => {
    if (variant === 'sheet' && effectiveOrderType) {
      return buildSheetCheckoutSteps(effectiveOrderType)
    }
    return buildCheckoutSteps(orderType)
  }, [variant, effectiveOrderType, orderType])

  const stepIdx = steps.indexOf(step)

  const cityOptions = useMemo(
    () => (postalCode.length >= 5 ? townsForPostalCode(postalCode) : []),
    [postalCode],
  )

  useEffect(() => {
    if (!sessionHydrated || cityOptions.length !== 1) return
    if (!city.trim()) setCity(cityOptions[0].name)
  }, [cityOptions, city, sessionHydrated])

  useEffect(() => {
    if (step !== 'details' || slots.length === 0) return
    setTimeSlot((current) => (current && slots.includes(current) ? current : slots[0]))
  }, [step, slots])

  useEffect(() => {
    if (effectiveOrderType !== 'delivery' || postalCode.length < 5) {
      setDeliveryQuote(null)
      return
    }
    let cancelled = false
    void fetchDeliveryQuote(postalCode, city, pizzaSubtotal).then((quote) => {
      if (!cancelled) setDeliveryQuote(quote)
    })
    return () => {
      cancelled = true
    }
  }, [effectiveOrderType, postalCode, city, pizzaSubtotal])

  useEffect(() => {
    if (step !== 'confirm' || effectiveOrderType !== 'delivery' || !sessionHydrated) return
    if (!postalCode.trim() || !city.trim()) {
      setStep('address')
      setError('Vérifiez votre adresse de livraison.')
      return
    }
    let cancelled = false
    void fetchDeliveryQuote(postalCode, city, pizzaSubtotal).then((quote) => {
      if (cancelled) return
      setDeliveryQuote(quote)
      if (!quote.ok) {
        setError(quote.error ?? 'Complétez en pizzas pour atteindre le minimum livraison.')
        setStep('address')
      }
    })
    return () => {
      cancelled = true
    }
  }, [step, effectiveOrderType, postalCode, city, pizzaSubtotal, sessionHydrated, setError])

  const deliveryFee = effectiveOrderType === 'delivery' && deliveryQuote?.ok ? deliveryQuote.fee : 0
  const total = useCheckoutTotal(effectiveOrderType, deliveryFee)

  const deliveryPizzaBelowMinimum =
    effectiveOrderType === 'delivery' &&
    deliveryQuote !== null &&
    !deliveryQuote.ok &&
    deliveryQuote.minOrder > 0 &&
    pizzaSubtotal < deliveryQuote.minOrder

  const pizzaMinimumGap =
    deliveryPizzaBelowMinimum && deliveryQuote ? deliveryQuote.minOrder - pizzaSubtotal : 0

  const belowDeliveryMinimum = step === 'address' && deliveryPizzaBelowMinimum

  const handlePaymentSuccess = useCallback(
    (token: string, orderNumber: number) => {
      clearCheckoutSession()
      clearPendingPayment()
      clearCart()
      if (variant === 'sheet') {
        setStep('track')
      }
      if (onPaymentSuccess) {
        onPaymentSuccess(token, orderNumber)
        return
      }
      router.push(`/suivi/${token}?n=${orderNumber}`)
    },
    [clearCart, router, onPaymentSuccess, variant],
  )

  const browseMenu = useCallback(() => {
    persistCheckout()
    if (onBrowseMenu) {
      onBrowseMenu()
      return
    }
    router.push('/#carte')
  }, [persistCheckout, onBrowseMenu, router])

  const goNext = useCallback(async () => {
    setError(null)
    const next = steps[stepIdx + 1]
    if (!next) return

    if (step === 'mode' && !orderType) {
      setError('Choisissez à emporter ou en livraison.')
      return
    }
    if (step === 'address') {
      if (!addressLine.trim() || !postalCode.trim() || !city.trim()) {
        setError('Adresse complète requise.')
        return
      }
      const quote = await fetchDeliveryQuote(postalCode, city, pizzaSubtotal)
      setDeliveryQuote(quote)
      if (!quote.ok) {
        setError(quote.error ?? 'Livraison impossible à cette adresse.')
        return
      }
    }
    if (step === 'details') {
      if (!customerFirstName.trim() || !customerLastName.trim() || !customerPhone.trim()) {
        setError('Prénom, nom et téléphone obligatoires.')
        return
      }
      if (!timeSlot) {
        setError('Choisissez un créneau horaire.')
        return
      }
    }
    if (next === 'confirm' && effectiveOrderType === 'delivery') {
      const quote = await fetchDeliveryQuote(postalCode, city, pizzaSubtotal)
      setDeliveryQuote(quote)
      if (!quote.ok) {
        if (quote.minOrder > 0 && pizzaSubtotal < quote.minOrder) {
          setError(
            `Il manque ${formatPriceEUR(quote.minOrder - pizzaSubtotal)} de pizzas pour livrer. Complétez la carte.`,
          )
        } else {
          setError(quote.error ?? 'Livraison impossible à cette adresse.')
        }
        return
      }
    }

    setStep(next)
  }, [
    steps,
    stepIdx,
    step,
    orderType,
    addressLine,
    postalCode,
    city,
    pizzaSubtotal,
    customerFirstName,
    customerLastName,
    customerPhone,
    timeSlot,
    effectiveOrderType,
    setError,
  ])

  const goBack = useCallback(() => {
    setError(null)
    if (stepIdx > 0) setStep(steps[stepIdx - 1])
  }, [stepIdx, steps, setError])

  const handlePostalCodeChange = useCallback(
    (next: string) => {
      if (normalizePostalCode(next) !== normalizePostalCode(postalCode)) {
        setCity('')
      }
      setPostalCode(next)
    },
    [postalCode],
  )

  const sheetTitle = variant === 'sheet' ? (SHEET_STEP_TITLES[step] ?? 'Panier') : undefined

  const ready = cartHydrated && sessionHydrated

  return {
    step,
    setStep,
    steps,
    stepIdx,
    orderType: effectiveOrderType,
    setOrderType,
    customerFirstName,
    setCustomerFirstName,
    customerLastName,
    setCustomerLastName,
    customerPhone,
    setCustomerPhone,
    customerEmail,
    setCustomerEmail,
    addressLine,
    setAddressLine,
    postalCode,
    setPostalCode: handlePostalCodeChange,
    city,
    setCity,
    instructions,
    setInstructions,
    timeSlot,
    setTimeSlot,
    slots,
    slotsLoading,
    slotsClosedReason,
    paymentMode,
    setPaymentMode,
    error,
    deliveryQuote,
    deliveryFee,
    total,
    checkoutDraft,
    pizzaSubtotal,
    deliveryPizzaBelowMinimum,
    belowDeliveryMinimum,
    amountToMinimum: pizzaMinimumGap,
    cityOptions,
    sheetTitle,
    ready,
    goNext,
    goBack,
    browseMenu,
    handlePaymentSuccess,
    setError,
    persistCheckout,
  }
}
