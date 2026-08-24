'use client'

import { useMemo, useState, useEffect, useCallback, useRef } from 'react'
import { useFeedbackState } from '@/lib/use-feedback-state'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  ArrowRight,
  MapPin,
  Store,
  Truck,
} from 'lucide-react'
import { useCart } from '@/components/cart/CartProvider'
import { PanierLineCard } from '@/components/cart/PanierLineCard'
import { MenuFormulePanel } from '@/components/cart/MenuFormulePanel'
import { CartUpsellStrip } from '@/components/cart/CartUpsellStrip'
import { CheckoutStepBar } from '@/components/checkout/CheckoutStepBar'
import { CheckoutSummary, useCheckoutTotal } from '@/components/checkout/CheckoutSummary'
import { formatPriceEUR } from '@/lib/menu-types'
import { fetchDeliveryQuote } from '@/lib/delivery-api'
import { deliveryZoneHint, townsForPostalCode, normalizePostalCode } from '@/lib/delivery'
import type { DeliveryQuote } from '@/lib/delivery'
import { fetchAvailableTimeSlots } from '@/lib/time-slots-api'
import { PIZZERIA, DELIVERY_TOWNS } from '@/lib/pizzeria-content'
import { buildCheckoutSteps, type CheckoutStepId } from '@/lib/checkout-flow'
import {
  clearCheckoutSession,
  computeCartFingerprint,
  loadCheckoutSession,
  resolveSafeCheckoutStep,
  saveCheckoutSession,
} from '@/lib/checkout-session'
import type { CheckoutDraft, OrderType } from '@/lib/cart-types'
import { customerFullName } from '@/lib/cart-types'
import { cn } from '@/lib/cn'
import { CheckoutPayment } from '@/components/checkout/CheckoutPayment'
import { SITE_STICKY_BELOW_HEADER } from '@/lib/site-layout'
import { pizzaSubtotalFromLines } from '@/lib/pizza-subtotal'
import { isOrderTestSlotsEnabled } from '@/lib/order-test-mode'

export function CheckoutWizard() {
  const router = useRouter()
  const { lines, subtotal, itemCount, updateQuantity, removeLine, clearCart, hydrated: cartHydrated } =
    useCart()

  const [step, setStep] = useState<CheckoutStepId>('recap')
  const [orderType, setOrderType] = useState<OrderType | null>(null)
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

  useEffect(() => {
    let cancelled = false
    setSlotsLoading(true)
    void fetchAvailableTimeSlots().then((result) => {
      if (cancelled) return
      setSlots(result.slots)
      setSlotsClosedReason(result.isOpen ? null : (result.closedReason ?? result.openStatus?.sublabel ?? 'Fermé'))
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
    setOrderType(saved.orderType)
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
  }, [cartHydrated])

  const persistCheckout = useCallback(() => {
    saveCheckoutSession({
      step,
      orderType,
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
    orderType,
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
    if (!orderType) return null
    return {
      orderType,
      customerFirstName: customerFirstName.trim(),
      customerLastName: customerLastName.trim(),
      customerPhone: customerPhone.trim(),
      customerEmail: customerEmail.trim(),
      addressLine: orderType === 'delivery' ? addressLine.trim() : '',
      postalCode: orderType === 'delivery' ? postalCode.trim() : '',
      city: orderType === 'delivery' ? city.trim() : '',
      instructions: instructions.trim(),
      timeSlot,
      paymentMode,
    }
  }, [
    orderType,
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

  const handlePaymentSuccess = useCallback(
    (token: string, orderNumber: number) => {
      clearCheckoutSession()
      clearCart()
      router.push(`/suivi/${token}?n=${orderNumber}`)
    },
    [clearCart, router]
  )

  const goToMenu = useCallback(() => {
    persistCheckout()
    router.push('/menu')
  }, [persistCheckout, router])

  const handlePaymentError = useCallback((message: string) => {
    setError(message)
  }, [])

  const steps = buildCheckoutSteps(orderType)
  const stepIdx = steps.indexOf(step)

  const cityOptions = useMemo(
    () => (postalCode.length >= 5 ? townsForPostalCode(postalCode) : []),
    [postalCode]
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
    if (orderType !== 'delivery' || postalCode.length < 5) {
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
  }, [orderType, postalCode, city, pizzaSubtotal])

  useEffect(() => {
    if (step !== 'confirm' || orderType !== 'delivery' || !sessionHydrated) return
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
  }, [step, orderType, postalCode, city, pizzaSubtotal, sessionHydrated])

  const deliveryFee = orderType === 'delivery' && deliveryQuote?.ok ? deliveryQuote.fee : 0
  const total = useCheckoutTotal(orderType, deliveryFee)

  const deliveryPizzaBelowMinimum =
    orderType === 'delivery' &&
    deliveryQuote !== null &&
    !deliveryQuote.ok &&
    deliveryQuote.minOrder > 0 &&
    pizzaSubtotal < deliveryQuote.minOrder

  const pizzaMinimumGap =
    deliveryPizzaBelowMinimum && deliveryQuote ? deliveryQuote.minOrder - pizzaSubtotal : 0

  const belowDeliveryMinimum = step === 'address' && deliveryPizzaBelowMinimum

  const amountToMinimum = pizzaMinimumGap

  if (!cartHydrated || !sessionHydrated) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-cream/50">
        Chargement du panier…
      </div>
    )
  }

  if (itemCount === 0) {
    return (
      <div className="mx-auto max-w-md text-center">
        <h1 className="font-display text-2xl font-bold text-cream">Panier vide</h1>
        <p className="mt-3 text-cream/55">Ajoutez des articles depuis la carte avant de commander.</p>
        <Link href="/menu" className="mt-6 inline-block text-tomato-light hover:underline">
          Voir la carte →
        </Link>
      </div>
    )
  }

  async function goNext() {
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
    if (next === 'confirm' && orderType === 'delivery') {
      const quote = await fetchDeliveryQuote(postalCode, city, pizzaSubtotal)
      setDeliveryQuote(quote)
      if (!quote.ok) {
        if (quote.minOrder > 0 && pizzaSubtotal < quote.minOrder) {
          setError(
            `Il manque ${formatPriceEUR(quote.minOrder - pizzaSubtotal)} de pizzas pour livrer à ${quote.zoneLabel || city}. Ajoutez une pizza sur la carte.`
          )
        } else {
          setError(quote.error ?? 'Livraison impossible à cette adresse.')
        }
        return
      }
    }

    setStep(next)
  }

  function goBack() {
    setError(null)
    if (stepIdx > 0) setStep(steps[stepIdx - 1])
    else router.push('/panier')
  }
  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-tomato-light">Commande</p>
          <h1 className="font-display text-2xl font-bold text-cream sm:text-3xl">Finaliser votre commande</h1>
        </div>
        <button
          type="button"
          onClick={goToMenu}
          className="hidden text-sm text-cream/45 hover:text-cream sm:inline"
        >
          + Compléter à la carte
        </button>
      </div>

      <CheckoutStepBar steps={steps} current={step} />

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-8">
        <div className="min-w-0">
          {step === 'recap' && (
            <div className="space-y-6">
              <MenuFormulePanel />
              <ul className="space-y-3">
                {lines.map((line) => (
                  <PanierLineCard
                    key={line.lineId}
                    line={line}
                    onUpdateQty={(qty) => updateQuantity(line.lineId, qty)}
                    onRemove={() => removeLine(line.lineId)}
                  />
                ))}
              </ul>
              <CartUpsellStrip />
            </div>
          )}

          {step === 'mode' && (
            <div className="space-y-4">
              <p className="text-sm text-cream/55">Comment souhaitez-vous récupérer votre commande ?</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {(
                  [
                    { id: 'pickup' as const, label: 'À emporter', icon: Store, desc: PIZZERIA.fullAddress },
                    {
                      id: 'delivery' as const,
                      label: 'Livraison',
                      icon: Truck,
                      desc: `${deliveryZoneHint()} — frais selon adresse`,
                    },
                  ] as const
                ).map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => setOrderType(mode.id)}
                    className={cn(
                      'flex items-start gap-3 rounded-2xl border p-5 text-left transition',
                      orderType === mode.id
                        ? 'border-tomato bg-tomato/10 ring-1 ring-tomato/30'
                        : 'border-white/10 bg-charcoal/60 hover:border-white/20'
                    )}
                  >
                    <mode.icon className="mt-0.5 h-6 w-6 shrink-0 text-tomato-light" />
                    <div>
                      <p className="font-semibold text-cream">{mode.label}</p>
                      <p className="mt-1 text-xs leading-relaxed text-cream/50">{mode.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
              <CartUpsellStrip />
            </div>
          )}

          {step === 'address' && (
            <div className="space-y-4">
              <p className="flex items-center gap-2 text-sm text-cream/55">
                <MapPin className="h-4 w-4 text-tomato-light" />
                Adresse de livraison — minimum en pizzas uniquement (boissons / suppléments en plus)
              </p>
              <input
                placeholder="N° et nom de rue *"
                value={addressLine}
                onChange={(e) => setAddressLine(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-charcoal/80 px-4 py-3 text-cream placeholder:text-cream/35"
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  placeholder="Code postal *"
                  value={postalCode}
                  onChange={(e) => {
                    const next = e.target.value
                    if (normalizePostalCode(next) !== normalizePostalCode(postalCode)) {
                      setCity('')
                    }
                    setPostalCode(next)
                  }}
                  maxLength={5}
                  className="rounded-xl border border-white/10 bg-charcoal/80 px-4 py-3 text-cream placeholder:text-cream/35"
                />
                {cityOptions.length > 1 ? (
                  <select
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="rounded-xl border border-white/10 bg-charcoal/80 px-4 py-3 text-cream"
                  >
                    <option value="">Choisir la ville *</option>
                    {cityOptions.map((t) => (
                      <option key={t.name} value={t.name}>
                        {t.name} (min. {t.minOrder} €)
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    placeholder="Ville *"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    list={cityOptions.length === 1 ? 'delivery-city-single' : undefined}
                    className="rounded-xl border border-white/10 bg-charcoal/80 px-4 py-3 text-cream placeholder:text-cream/35"
                  />
                )}
              </div>
              {cityOptions.length === 1 && (
                <datalist id="delivery-city-single">
                  <option value={cityOptions[0].name} />
                </datalist>
              )}

              {postalCode.length >= 5 && city.trim() && deliveryQuote && (
                <div
                  className={cn(
                    'rounded-xl border px-4 py-3 text-sm',
                    deliveryQuote.ok
                      ? 'border-emerald-500/30 bg-emerald-950/30 text-emerald-100'
                      : 'border-red-500/30 bg-red-950/20 text-red-200'
                  )}
                >
                  {deliveryQuote.ok ? (
                    <>
                      <p className="font-semibold">Zone : {deliveryQuote.zoneLabel}</p>
                      <p className="mt-1">
                        Frais de livraison :{' '}
                        <strong>{formatPriceEUR(deliveryQuote.fee)}</strong>
                      </p>
                    </>
                  ) : (
                    <>
                      <p>{deliveryQuote.error}</p>
                      {belowDeliveryMinimum && (
                        <p className="mt-2 font-medium">
                          Il vous manque{' '}
                          <strong>{formatPriceEUR(amountToMinimum)}</strong> de pizzas pour la
                          livraison (boissons et suppléments ne comptent pas).
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}

              {belowDeliveryMinimum && (
                <button
                  type="button"
                  onClick={goToMenu}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-tomato/40 bg-tomato/10 px-4 py-3.5 text-sm font-bold text-tomato-light hover:bg-tomato/20"
                >
                  Parcourir la carte — ajouter des pizzas
                  <ArrowRight className="h-4 w-4" />
                </button>
              )}

              <p className="text-xs text-cream/35">
                Zones : {DELIVERY_TOWNS.join(', ')} et alentours.
              </p>
              <CartUpsellStrip />
            </div>
          )}

          {step === 'details' && (
            <div className="space-y-4">
              <p className="text-sm text-cream/55">Qui passe la commande ?</p>
              {deliveryPizzaBelowMinimum && deliveryQuote && (
                <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-50">
                  <p className="font-semibold">Minimum livraison non atteint (pizzas uniquement)</p>
                  <p className="mt-1 text-amber-100/90">
                    Vous avez <strong>{formatPriceEUR(pizzaSubtotal)}</strong> de pizzas — il en faut{' '}
                    <strong>{formatPriceEUR(deliveryQuote.minOrder)}</strong> pour{' '}
                    {deliveryQuote.zoneLabel}. Boissons et desserts ne comptent pas.
                  </p>
                  <button
                    type="button"
                    onClick={goToMenu}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-tomato px-4 py-3 text-sm font-bold text-white hover:bg-tomato-light"
                  >
                    Ajouter une pizza sur la carte
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  placeholder="Prénom *"
                  value={customerFirstName}
                  onChange={(e) => setCustomerFirstName(e.target.value)}
                  autoComplete="given-name"
                  className="w-full rounded-xl border border-white/10 bg-charcoal/80 px-4 py-3 text-cream"
                />
                <input
                  placeholder="Nom *"
                  value={customerLastName}
                  onChange={(e) => setCustomerLastName(e.target.value)}
                  autoComplete="family-name"
                  className="w-full rounded-xl border border-white/10 bg-charcoal/80 px-4 py-3 text-cream"
                />
              </div>
              <input
                type="tel"
                placeholder="Téléphone *"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-charcoal/80 px-4 py-3 text-cream"
              />
              <input
                type="email"
                placeholder="Email (optionnel)"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-charcoal/80 px-4 py-3 text-cream"
              />
              {slots.length > 0 ? (
                <>
                  {isOrderTestSlotsEnabled() && (
                    <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                      Mode test — créneaux ouverts jusqu&apos;à 23h45. En production : dernière commande à
                      21h45.
                    </p>
                  )}
                  <select
                    value={timeSlot}
                    onChange={(e) => setTimeSlot(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-charcoal/80 px-4 py-3 text-cream"
                  >
                    {slots.map((s) => (
                      <option key={s} value={s}>
                        Créneau {s}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-cream/45">
                    Commande possible avant ouverture — créneaux jusqu&apos;à 15 min avant{' '}
                    {PIZZERIA.hours.close}h00.
                  </p>
                </>
              ) : slotsLoading ? (
                <p className="text-sm text-cream/50">Chargement des créneaux…</p>
              ) : (
                <p className="text-sm text-amber-200/80">
                  {slotsClosedReason ??
                    (process.env.NODE_ENV === 'development'
                      ? `Commandes closes — mode test actif jusqu'à 23h45 (prod : 15 min avant ${PIZZERIA.hours.close}h00).`
                      : `Commandes closes — dernier créneau 15 min avant ${PIZZERIA.hours.close}h00.`)}
                </p>
              )}
              <textarea
                placeholder="Instructions (interphone, code porte…)"
                rows={2}
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-charcoal/80 px-4 py-3 text-cream"
              />
            </div>
          )}

          {step === 'confirm' && checkoutDraft && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-white/10 bg-charcoal/60 p-5">
                <h2 className="font-semibold text-cream">Récapitulatif</h2>
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-cream/45">Mode</dt>
                    <dd className="text-cream">{orderType === 'delivery' ? 'Livraison' : 'À emporter'}</dd>
                  </div>
                  {orderType === 'delivery' && (
                    <div className="flex justify-between gap-4">
                      <dt className="text-cream/45">Adresse</dt>
                      <dd className="text-right text-cream">
                        {addressLine}
                        <br />
                        {postalCode} {city}
                      </dd>
                    </div>
                  )}
                  <div className="flex justify-between gap-4">
                    <dt className="text-cream/45">Client</dt>
                    <dd className="text-right text-cream">
                      {customerFullName({ customerFirstName, customerLastName })}
                      <br />
                      {customerPhone}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-cream/45">Créneau</dt>
                    <dd className="text-cream">{timeSlot}</dd>
                  </div>
                  <div className="flex justify-between gap-4 border-t border-white/10 pt-2 font-semibold">
                    <dt className="text-cream">Total</dt>
                    <dd className="text-tomato-light">{formatPriceEUR(total)}</dd>
                  </div>
                </dl>
              </div>

              <div className="mb-6 rounded-2xl border border-white/10 bg-charcoal/60 p-4">
                <p className="mb-3 text-sm font-semibold text-cream">Mode de paiement</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMode('online')}
                    className={cn(
                      'rounded-xl border px-4 py-3 text-left text-sm',
                      paymentMode === 'online'
                        ? 'border-tomato bg-tomato/15 text-cream'
                        : 'border-white/15 text-cream/60'
                    )}
                  >
                    <strong className="block">Payer en ligne</strong>
                    <span className="text-xs opacity-80">Carte bancaire</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMode('counter')}
                    className={cn(
                      'rounded-xl border px-4 py-3 text-left text-sm',
                      paymentMode === 'counter'
                        ? 'border-tomato bg-tomato/15 text-cream'
                        : 'border-white/15 text-cream/60'
                    )}
                  >
                    <strong className="block">Payer au comptoir</strong>
                    <span className="text-xs opacity-80">Encaissement à la pizzeria (SUNMI)</span>
                  </button>
                </div>
              </div>

              <CheckoutPayment
                lines={lines}
                checkout={checkoutDraft}
                subtotal={subtotal}
                deliveryFee={deliveryFee}
                total={total}
                paymentMode={paymentMode}
                onSuccess={handlePaymentSuccess}
                onError={handlePaymentError}
              />
            </div>
          )}

          {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

          <div className="mt-8 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={goBack}
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-5 py-3 text-sm font-semibold text-cream/80 hover:bg-white/5"
            >
              <ArrowLeft className="h-4 w-4" />
              Retour
            </button>
            {step !== 'confirm' ? (
              <button
                type="button"
                onClick={goNext}
                disabled={deliveryPizzaBelowMinimum}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-tomato px-5 py-3 text-sm font-bold text-white hover:bg-tomato-light disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none"
              >
                Continuer
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </div>

        <aside className={`mt-8 lg:sticky ${SITE_STICKY_BELOW_HEADER} lg:mt-0`}>
          <CheckoutSummary
            orderType={orderType}
            deliveryFee={deliveryFee}
            zoneLabel={deliveryQuote?.zoneLabel}
            deliveryMinPizzas={
              orderType === 'delivery' && deliveryQuote ? deliveryQuote.minOrder : undefined
            }
          />
        </aside>
      </div>
    </div>
  )
}
