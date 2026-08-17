'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Home, Lock, Phone, ShoppingBag, Store, Truck, X } from 'lucide-react'
import { useCart } from '@/components/cart/CartProvider'
import { PanierLineCard } from '@/components/cart/PanierLineCard'
import { CartSheetSuggestions } from '@/components/cart/CartSheetSuggestions'
import { CheckoutSheetStepper } from '@/components/cart/CheckoutSheetStepper'
import { SuiviConfirmation } from '@/components/cart/SuiviConfirmation'
import { CheckoutStepPanels } from '@/components/checkout/CheckoutStepPanels'
import { formatPriceEUR } from '@/lib/menu-types'
import { PIZZERIA } from '@/lib/pizzeria-content'
import type { OrderType } from '@/lib/cart-types'
import { getDeliveryQuote } from '@/lib/delivery'
import { pizzaSubtotalFromLines } from '@/lib/pizza-subtotal'
import { loadCheckoutSession } from '@/lib/checkout-session'
import type { CheckoutStepId } from '@/lib/checkout-flow'
import { useCheckoutFlow } from '@/hooks/useCheckoutFlow'
import { cn } from '@/lib/cn'

type SheetOrderMode = 'delivery' | 'pickup' | 'dinein'

const MODE_OPTIONS: {
  id: SheetOrderMode
  label: string
  icon: typeof Truck
  orderType: OrderType
}[] = [
  { id: 'delivery', label: 'Livraison', icon: Truck, orderType: 'delivery' },
  { id: 'pickup', label: 'Emporter', icon: Home, orderType: 'pickup' },
  { id: 'dinein', label: 'Sur place', icon: Store, orderType: 'pickup' },
]

const STEP_LABELS: Record<CheckoutStepId, string> = {
  recap: 'Panier',
  mode: 'Mode',
  address: 'Adresse',
  details: 'Coordonnées',
  confirm: 'Paiement',
  track: 'Suivi',
}

function modeFromOrderType(orderType: OrderType | null, instructions?: string): SheetOrderMode {
  if (orderType === 'delivery') return 'delivery'
  if (instructions?.includes('Sur place')) return 'dinein'
  return 'pickup'
}

function indicativeDeliveryFee(pizzaSubtotal: number): number {
  const quote = getDeliveryQuote('33370', pizzaSubtotal, 'Fargues-Saint-Hilaire')
  return quote.ok ? quote.fee : 4.5
}

export function CartOrderSheet() {
  const router = useRouter()
  const {
    lines,
    subtotal,
    itemCount,
    updateQuantity,
    removeLine,
    sheetOpen,
    sheetInitialStep,
    closeCartSheet,
    clearCart,
    hydrated,
    activeTracking,
    setActiveTracking,
    clearActiveTracking,
  } = useCart()

  const [mode, setMode] = useState<SheetOrderMode>('delivery')
  const [visible, setVisible] = useState(false)
  const [dineInNote, setDineInNote] = useState(false)

  const orderType: OrderType = mode === 'delivery' ? 'delivery' : 'pickup'
  const pizzaSubtotal = useMemo(() => pizzaSubtotalFromLines(lines), [lines])

  const browseMenu = useCallback(() => {
    closeCartSheet()
    const path = window.location.pathname
    if (path === '/' || path === '/menu') {
      window.setTimeout(() => {
        document.getElementById('carte')?.scrollIntoView({ behavior: 'smooth' })
      }, 200)
    } else {
      router.push('/#carte')
    }
  }, [closeCartSheet, router])

  const flow = useCheckoutFlow({
    variant: 'sheet',
    lines,
    subtotal,
    itemCount,
    cartHydrated: hydrated,
    clearCart,
    sheetOrderType: orderType,
    onBrowseMenu: browseMenu,
    onPaymentSuccess: (token, orderNumber) => {
      setActiveTracking({ token, orderNumber })
    },
  })

  const {
    step,
    setStep,
    steps,
    stepIdx,
    deliveryFee,
    total,
    checkoutDraft,
    deliveryQuote,
    goNext,
    goBack,
    ready,
    setInstructions,
    instructions,
    handlePaymentSuccess,
    ...panelProps
  } = flow

  const isTrackingView = step === 'track' && Boolean(activeTracking)

  const stepperSteps = useMemo((): CheckoutStepId[] => {
    if (isTrackingView) return [...steps, 'track']
    return steps
  }, [steps, isTrackingView])

  const handleNewOrder = useCallback(() => {
    clearActiveTracking()
    setStep('recap')
    closeCartSheet()
    browseMenu()
  }, [clearActiveTracking, setStep, closeCartSheet, browseMenu])

  useEffect(() => {
    if (mode === 'dinein') {
      setInstructions('Sur place')
      setDineInNote(true)
    } else if (dineInNote) {
      setInstructions('')
      setDineInNote(false)
    }
  }, [mode, dineInNote, setInstructions])

  useEffect(() => {
    if (sheetOpen) {
      setVisible(true)
      document.body.style.overflow = 'hidden'

      const saved = loadCheckoutSession()
      if (saved?.orderType) {
        setMode(modeFromOrderType(saved.orderType, saved.instructions))
      }
      if (sheetInitialStep) {
        setStep(sheetInitialStep)
      } else if (activeTracking) {
        setStep('track')
      } else if (saved?.step && saved.step !== 'mode' && saved.step !== 'track') {
        setStep(saved.step)
      } else if (itemCount > 0) {
        setStep('recap')
      }

      return () => {
        document.body.style.overflow = ''
      }
    }
    const t = window.setTimeout(() => setVisible(false), 280)
    document.body.style.overflow = ''
    return () => window.clearTimeout(t)
  }, [sheetOpen, sheetInitialStep, itemCount, activeTracking, setStep])

  const headerTitle = isTrackingView
    ? `Suivi · N° ${activeTracking!.orderNumber}`
    : STEP_LABELS[step]

  const showModeToggle = !isTrackingView && step === 'recap'

  const showStepper = isTrackingView || itemCount > 0

  useEffect(() => {
    if (!sheetOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeCartSheet()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sheetOpen, closeCartSheet])

  const displayDeliveryFee =
    step === 'confirm' || step === 'details'
      ? deliveryFee
      : orderType === 'delivery'
        ? indicativeDeliveryFee(pizzaSubtotal)
        : 0

  const displayTotal =
    step === 'confirm' || step === 'details'
      ? total
      : subtotal + (orderType === 'delivery' && itemCount > 0 ? displayDeliveryFee : 0)

  const primaryLabel =
    step === 'recap'
      ? 'Continuer'
      : step === 'confirm'
        ? null
        : step === 'address'
          ? 'Coordonnées'
          : 'Paiement'

  const pizzaGap =
    panelProps.belowDeliveryMinimum || panelProps.deliveryPizzaBelowMinimum
      ? panelProps.amountToMinimum
      : 0

  const canContinue =
    step !== 'confirm' &&
    itemCount > 0 &&
    !(step === 'address' && panelProps.belowDeliveryMinimum) &&
    !panelProps.deliveryPizzaBelowMinimum

  if (!sheetOpen && !visible) return null

  return (
    <div
      className={cn(
        'fixed inset-0 z-[70]',
        sheetOpen ? 'pointer-events-auto' : 'pointer-events-none',
      )}
      aria-hidden={!sheetOpen}
    >
      <button
        type="button"
        aria-label="Fermer le panier"
        onClick={closeCartSheet}
        className={cn(
          'absolute inset-0 bg-charcoal/60 backdrop-blur-sm transition-opacity duration-300',
          sheetOpen ? 'opacity-100' : 'opacity-0',
        )}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-sheet-title"
        className={cn(
          'absolute right-0 top-0 flex h-[100dvh] w-full max-w-md flex-col border-l border-white/10 bg-charcoal shadow-card transition-transform duration-300 ease-out',
          sheetOpen ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        {/* Header compact */}
        <div className="flex shrink-0 items-center gap-2 border-b border-white/10 px-4 py-2.5">
          <div className="min-w-0 flex-1">
            <p id="cart-sheet-title" className="truncate text-sm font-semibold text-cream">
              {headerTitle}
              {!isTrackingView && itemCount > 0 && (
                <span className="ml-1.5 font-normal text-cream/45">({itemCount})</span>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={closeCartSheet}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-cream/45 hover:bg-white/5 hover:text-cream"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {showModeToggle && (
          <div className="shrink-0 border-b border-white/5 px-4 py-2">
            <div className="grid grid-cols-3 gap-1 rounded-full border border-white/10 bg-charcoal-soft p-0.5">
              {MODE_OPTIONS.map(({ id, label, icon: Icon }) => {
                const active = mode === id
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setMode(id)}
                    className={cn(
                      'inline-flex items-center justify-center gap-1 rounded-full px-1.5 py-1.5 text-[10px] font-medium transition',
                      active
                        ? 'bg-flame-gradient text-white'
                        : 'text-cream/45 hover:text-cream/70',
                    )}
                  >
                    <Icon className="h-3 w-3 shrink-0" />
                    <span className="truncate">{label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {showStepper && (
          <CheckoutSheetStepper
            steps={stepperSteps}
            current={isTrackingView ? 'track' : step}
          />
        )}

        {/* Corps scrollable */}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {isTrackingView ? (
            <SuiviConfirmation
              token={activeTracking!.token}
              orderNumber={activeTracking!.orderNumber}
              variant="sheet"
              onNewOrder={handleNewOrder}
            />
          ) : !ready ? (
            <p className="text-center text-xs text-cream/45">Chargement…</p>
          ) : itemCount === 0 && step === 'recap' ? (
            <div className="flex min-h-[160px] flex-col items-center justify-center gap-2 text-center text-cream/45">
              <ShoppingBag className="h-8 w-8 opacity-30" />
              <p className="text-xs">Panier vide</p>
              <button
                type="button"
                onClick={browseMenu}
                className="text-xs font-semibold text-tomato-light hover:underline"
              >
                Voir la carte
              </button>
            </div>
          ) : (
            <>
              {itemCount > 0 && step === 'recap' && (
                <ul className="space-y-1.5">
                  {lines.map((line) => (
                    <PanierLineCard
                      key={line.lineId}
                      line={line}
                      compact
                      onUpdateQty={(qty) => updateQuantity(line.lineId, qty)}
                      onRemove={() => removeLine(line.lineId)}
                    />
                  ))}
                </ul>
              )}

              {itemCount > 0 && step === 'recap' && (
                <CartSheetSuggestions pizzaGap={pizzaGap > 0 ? pizzaGap : 0} />
              )}

              {step !== 'recap' && !isTrackingView && (
                <CheckoutStepPanels
                  step={step}
                  variant="sheet"
                  lines={lines}
                  orderType={orderType}
                  customerFirstName={panelProps.customerFirstName}
                  customerLastName={panelProps.customerLastName}
                  customerPhone={panelProps.customerPhone}
                  customerEmail={panelProps.customerEmail}
                  addressLine={panelProps.addressLine}
                  postalCode={panelProps.postalCode}
                  city={panelProps.city}
                  instructions={instructions}
                  timeSlot={panelProps.timeSlot}
                  slots={panelProps.slots}
                  slotsLoading={panelProps.slotsLoading}
                  slotsClosedReason={panelProps.slotsClosedReason}
                  paymentMode={panelProps.paymentMode}
                  deliveryQuote={deliveryQuote}
                  deliveryFee={deliveryFee}
                  subtotal={subtotal}
                  total={displayTotal}
                  checkoutDraft={checkoutDraft}
                  error={panelProps.error}
                  cityOptions={panelProps.cityOptions}
                  belowDeliveryMinimum={panelProps.belowDeliveryMinimum}
                  amountToMinimum={panelProps.amountToMinimum}
                  deliveryPizzaBelowMinimum={panelProps.deliveryPizzaBelowMinimum}
                  pizzaSubtotal={panelProps.pizzaSubtotal}
                  onSetOrderType={panelProps.setOrderType}
                  onSetCustomerFirstName={panelProps.setCustomerFirstName}
                  onSetCustomerLastName={panelProps.setCustomerLastName}
                  onSetCustomerPhone={panelProps.setCustomerPhone}
                  onSetCustomerEmail={panelProps.setCustomerEmail}
                  onSetAddressLine={panelProps.setAddressLine}
                  onSetPostalCode={panelProps.setPostalCode}
                  onSetCity={panelProps.setCity}
                  onSetInstructions={setInstructions}
                  onSetTimeSlot={panelProps.setTimeSlot}
                  onSetPaymentMode={panelProps.setPaymentMode}
                  onUpdateQty={updateQuantity}
                  onRemoveLine={removeLine}
                  onBrowseMenu={browseMenu}
                  onPaymentSuccess={handlePaymentSuccess}
                  onPaymentError={flow.setError}
                />
              )}

              {step === 'recap' && itemCount > 0 && (
                <button
                  type="button"
                  onClick={browseMenu}
                  className="mt-3 w-full rounded-lg border border-dashed border-white/10 py-2 text-[11px] font-medium text-cream/45 hover:border-tomato/30 hover:text-tomato-light"
                >
                  + Parcourir la carte
                </button>
              )}

              {panelProps.error && (
                <p className="mt-2 text-xs text-red-400">{panelProps.error}</p>
              )}
            </>
          )}
        </div>

        {/* Footer compact */}
        <div className="shrink-0 border-t border-white/10 bg-charcoal-soft px-4 py-3">
          {isTrackingView ? (
            <div className="flex items-center gap-2">
              <a
                href={PIZZERIA.phoneHref}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border border-white/15 py-2 text-[11px] text-cream/70 hover:bg-white/5"
              >
                <Phone className="h-3.5 w-3.5" />
                Appeler
              </a>
              <button
                type="button"
                onClick={handleNewOrder}
                className="flex-1 rounded-full bg-tomato py-2 text-[11px] font-bold text-white"
              >
                Nouvelle commande
              </button>
            </div>
          ) : step !== 'confirm' && step !== 'track' && itemCount > 0 ? (
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] text-cream/40">
                  Sous-total {formatPriceEUR(subtotal)}
                  {orderType === 'delivery' && (
                    <> · Livraison {formatPriceEUR(displayDeliveryFee)}</>
                  )}
                </p>
                <p className="font-display text-lg leading-tight text-cream">
                  {formatPriceEUR(displayTotal)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {stepIdx > 0 && (
                  <button
                    type="button"
                    onClick={goBack}
                    className="grid h-9 w-9 place-items-center rounded-full border border-white/15 text-cream/60 hover:bg-white/5"
                    aria-label="Retour"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                )}
                {primaryLabel && (
                  <button
                    type="button"
                    disabled={!canContinue}
                    onClick={() => void goNext()}
                    className="rounded-full bg-flame-gradient px-5 py-2.5 text-xs font-semibold text-white shadow-glow transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {primaryLabel}
                  </button>
                )}
              </div>
            </div>
          ) : null}

          {!isTrackingView && step === 'confirm' && stepIdx > 0 && (
            <button
              type="button"
              onClick={goBack}
              className="mb-2 flex w-full items-center justify-center gap-1 rounded-full border border-white/15 py-2 text-xs text-cream/60 hover:bg-white/5"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Retour
            </button>
          )}

          {!isTrackingView && step === 'confirm' && (
            <p className="mt-1.5 text-center text-[9px] text-cream/30">
              <Lock className="mr-0.5 inline h-2.5 w-2.5" />
              CB · Apple Pay · Google Pay
            </p>
          )}
        </div>
      </aside>
    </div>
  )
}
