'use client'

import Link from 'next/link'
import { ArrowRight, MapPin, Store, Truck } from 'lucide-react'
import { CartUpsellStrip } from '@/components/cart/CartUpsellStrip'
import { MenuFormulePanel } from '@/components/cart/MenuFormulePanel'
import { PanierLineCard } from '@/components/cart/PanierLineCard'
import { CheckoutPayment } from '@/components/checkout/CheckoutPayment'
import { formatPriceEUR } from '@/lib/menu-types'
import type { DeliveryQuote } from '@/lib/delivery'
import { deliveryZoneHint } from '@/lib/delivery'
import { DELIVERY_TOWNS, PIZZERIA } from '@/lib/pizzeria-content'
import type { CartLine, CheckoutDraft, OrderType } from '@/lib/cart-types'
import { customerFullName } from '@/lib/cart-types'
import type { CheckoutStepId } from '@/lib/checkout-flow'
import { cn } from '@/lib/cn'
import { isOrderTestSlotsEnabled } from '@/lib/order-test-mode'

export type CheckoutStepPanelsProps = {
  step: CheckoutStepId
  variant: 'page' | 'sheet'
  lines: CartLine[]
  orderType: OrderType | null
  customerFirstName: string
  customerLastName: string
  customerPhone: string
  customerEmail: string
  addressLine: string
  postalCode: string
  city: string
  instructions: string
  timeSlot: string
  slots: string[]
  slotsLoading: boolean
  slotsClosedReason: string | null
  paymentMode: 'online' | 'counter'
  deliveryQuote: DeliveryQuote | null
  deliveryFee: number
  subtotal: number
  total: number
  checkoutDraft: CheckoutDraft | null
  error: string | null
  cityOptions: { name: string; minOrder: number }[]
  belowDeliveryMinimum: boolean
  amountToMinimum: number
  deliveryPizzaBelowMinimum: boolean
  pizzaSubtotal: number
  onSetOrderType: (type: OrderType) => void
  onSetCustomerFirstName: (v: string) => void
  onSetCustomerLastName: (v: string) => void
  onSetCustomerPhone: (v: string) => void
  onSetCustomerEmail: (v: string) => void
  onSetAddressLine: (v: string) => void
  onSetPostalCode: (v: string) => void
  onSetCity: (v: string) => void
  onSetInstructions: (v: string) => void
  onSetTimeSlot: (v: string) => void
  onSetPaymentMode: (mode: 'online' | 'counter') => void
  onUpdateQty: (lineId: string, qty: number) => void
  onRemoveLine: (lineId: string) => void
  onBrowseMenu: () => void
  onPaymentSuccess: (token: string, orderNumber: number) => void
  onPaymentError: (message: string) => void
}

const inputClass =
  'w-full rounded-lg border border-white/10 bg-charcoal/80 px-3 py-2 text-sm text-cream placeholder:text-cream/35'

const inputClassSheet =
  'w-full rounded-lg border border-white/10 bg-charcoal/80 px-3 py-2 text-xs text-cream placeholder:text-cream/35'

export function CheckoutStepPanels(props: CheckoutStepPanelsProps) {
  const {
    step,
    variant,
    lines,
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
    slots,
    slotsLoading,
    slotsClosedReason,
    paymentMode,
    deliveryQuote,
    deliveryFee,
    subtotal,
    total,
    checkoutDraft,
    error,
    cityOptions,
    belowDeliveryMinimum,
    amountToMinimum,
    deliveryPizzaBelowMinimum,
    pizzaSubtotal,
    onSetOrderType,
    onSetCustomerFirstName,
    onSetCustomerLastName,
    onSetCustomerPhone,
    onSetCustomerEmail,
    onSetAddressLine,
    onSetPostalCode,
    onSetCity,
    onSetInstructions,
    onSetTimeSlot,
    onSetPaymentMode,
    onUpdateQty,
    onRemoveLine,
    onBrowseMenu,
    onPaymentSuccess,
    onPaymentError,
  } = props

  const compact = variant === 'sheet'

  if (step === 'recap') {
    if (compact) return null
    return (
      <div className="space-y-4">
        {!compact && <MenuFormulePanel />}
        <ul className="space-y-3">
          {lines.map((line) => (
            <PanierLineCard
              key={line.lineId}
              line={line}
              onUpdateQty={(qty) => onUpdateQty(line.lineId, qty)}
              onRemove={() => onRemoveLine(line.lineId)}
            />
          ))}
        </ul>
        {!compact && <CartUpsellStrip />}
        {compact && (
          <button
            type="button"
            onClick={onBrowseMenu}
            className="w-full rounded-xl border border-dashed border-white/15 py-2.5 text-xs font-semibold text-cream/55 transition hover:border-tomato/40 hover:text-tomato-light"
          >
            + Ajouter depuis la carte
          </button>
        )}
      </div>
    )
  }

  if (step === 'mode') {
    return (
      <div className="space-y-4">
        <p className="text-sm text-cream/55">Comment souhaitez-vous récupérer votre commande ?</p>
        <div className={cn('grid gap-3', compact ? 'grid-cols-1' : 'sm:grid-cols-2')}>
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
              onClick={() => onSetOrderType(mode.id)}
              className={cn(
                'flex items-start gap-3 rounded-2xl border p-4 text-left transition',
                orderType === mode.id
                  ? 'border-tomato bg-tomato/10 ring-1 ring-tomato/30'
                  : 'border-white/10 bg-charcoal/60 hover:border-white/20',
              )}
            >
              <mode.icon className="mt-0.5 h-5 w-5 shrink-0 text-tomato-light" />
              <div>
                <p className="font-semibold text-cream">{mode.label}</p>
                <p className="mt-1 text-xs leading-relaxed text-cream/50">{mode.desc}</p>
              </div>
            </button>
          ))}
        </div>
        {!compact && <CartUpsellStrip />}
      </div>
    )
  }

  if (step === 'address') {
    const ic = compact ? inputClassSheet : inputClass
    return (
      <div className="space-y-2">
        {!compact && (
          <p className="flex items-center gap-2 text-xs text-cream/55">
            <MapPin className="h-4 w-4 shrink-0 text-tomato-light" />
            Minimum calculé sur les pizzas uniquement
          </p>
        )}
        <input
          placeholder="N° et rue *"
          value={addressLine}
          onChange={(e) => onSetAddressLine(e.target.value)}
          className={ic}
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            placeholder="CP *"
            value={postalCode}
            onChange={(e) => onSetPostalCode(e.target.value)}
            maxLength={5}
            className={ic}
          />
          {cityOptions.length > 1 ? (
            <select value={city} onChange={(e) => onSetCity(e.target.value)} className={ic}>
              <option value="">Ville *</option>
              {cityOptions.map((t) => (
                <option key={t.name} value={t.name}>
                  {t.name}
                </option>
              ))}
            </select>
          ) : (
            <input
              placeholder="Ville *"
              value={city}
              onChange={(e) => onSetCity(e.target.value)}
              className={ic}
            />
          )}
        </div>

        {postalCode.length >= 5 && city.trim() && deliveryQuote && (
          <div
            className={cn(
              'rounded-lg border px-2.5 py-2 text-[11px] leading-snug',
              deliveryQuote.ok
                ? 'border-emerald-500/30 bg-emerald-950/30 text-emerald-100'
                : 'border-amber-500/30 bg-amber-950/20 text-amber-100',
            )}
          >
            {deliveryQuote.ok ? (
              <>
                {deliveryQuote.zoneLabel} · {formatPriceEUR(deliveryQuote.fee)}
              </>
            ) : (
              belowDeliveryMinimum && (
                <span>
                  Min. {formatPriceEUR(deliveryQuote.minOrder)} pizzas — il manque{' '}
                  <strong>{formatPriceEUR(amountToMinimum)}</strong>
                </span>
              )
            )}
          </div>
        )}

        {!compact && belowDeliveryMinimum && (
          <button
            type="button"
            onClick={onBrowseMenu}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-tomato/40 bg-tomato/10 px-4 py-3 text-sm font-bold text-tomato-light hover:bg-tomato/20"
          >
            Compléter la carte
            <ArrowRight className="h-4 w-4" />
          </button>
        )}

        {!compact && (
          <p className="text-xs text-cream/35">Zones : {DELIVERY_TOWNS.join(', ')} et alentours.</p>
        )}
      </div>
    )
  }

  if (step === 'details') {
    const ic = compact ? inputClassSheet : inputClass
    return (
      <div className="space-y-2">
        {!compact && deliveryPizzaBelowMinimum && deliveryQuote && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-50">
            <p className="font-semibold">Minimum livraison non atteint</p>
            <p className="mt-1">
              {formatPriceEUR(pizzaSubtotal)} de pizzas — minimum{' '}
              {formatPriceEUR(deliveryQuote.minOrder)} pour {deliveryQuote.zoneLabel}.
            </p>
            <button
              type="button"
              onClick={onBrowseMenu}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-tomato px-3 py-2 text-xs font-bold text-white"
            >
              Ajouter des pizzas
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <input
            placeholder="Prénom *"
            value={customerFirstName}
            onChange={(e) => onSetCustomerFirstName(e.target.value)}
            autoComplete="given-name"
            className={ic}
          />
          <input
            placeholder="Nom *"
            value={customerLastName}
            onChange={(e) => onSetCustomerLastName(e.target.value)}
            autoComplete="family-name"
            className={ic}
          />
        </div>
        <input
          type="tel"
          placeholder="Téléphone *"
          value={customerPhone}
          onChange={(e) => onSetCustomerPhone(e.target.value)}
          className={ic}
        />
        <input
          type="email"
          placeholder="Email (optionnel)"
          value={customerEmail}
          onChange={(e) => onSetCustomerEmail(e.target.value)}
          className={ic}
        />
        {slots.length > 0 ? (
          <>
            {isOrderTestSlotsEnabled() && (
              <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-100">
                Mode test — créneaux ouverts jusqu&apos;à 23h45.
              </p>
            )}
            <select
              value={timeSlot}
              onChange={(e) => onSetTimeSlot(e.target.value)}
              className={ic}
            >
              {slots.map((s) => (
                <option key={s} value={s}>
                  Créneau {s}
                </option>
              ))}
            </select>
          </>
        ) : slotsLoading ? (
          <p className="text-sm text-cream/50">Créneaux…</p>
        ) : (
          <p className="text-xs text-amber-200/80">{slotsClosedReason ?? 'Commandes closes.'}</p>
        )}
        <textarea
          placeholder="Instructions (interphone, code…)"
          rows={compact ? 2 : 2}
          value={instructions}
          onChange={(e) => onSetInstructions(e.target.value)}
          className={ic}
        />
      </div>
    )
  }

  if (step === 'confirm' && checkoutDraft) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-white/10 bg-charcoal/60 p-4 text-sm">
          <dl className="space-y-2">
            <div className="flex justify-between gap-3">
              <dt className="text-cream/45">Mode</dt>
              <dd className="text-cream">{orderType === 'delivery' ? 'Livraison' : 'À emporter'}</dd>
            </div>
            {orderType === 'delivery' && (
              <div className="flex justify-between gap-3">
                <dt className="text-cream/45">Adresse</dt>
                <dd className="text-right text-cream">
                  {addressLine}, {postalCode} {city}
                </dd>
              </div>
            )}
            <div className="flex justify-between gap-3">
              <dt className="text-cream/45">Client</dt>
              <dd className="text-right text-cream">
                {customerFullName({ customerFirstName, customerLastName })}
              </dd>
            </div>
            <div className="flex justify-between gap-3 border-t border-white/10 pt-2 font-semibold">
              <dt className="text-cream">Total</dt>
              <dd className="text-tomato-light">{formatPriceEUR(total)}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-xl border border-white/10 bg-charcoal/60 p-3">
          <p className="mb-2 text-xs font-semibold text-cream">Paiement</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onSetPaymentMode('online')}
              className={cn(
                'rounded-lg border px-3 py-2 text-left text-xs',
                paymentMode === 'online'
                  ? 'border-tomato bg-tomato/15 text-cream'
                  : 'border-white/15 text-cream/60',
              )}
            >
              <strong className="block">En ligne</strong>
              CB · Apple Pay
            </button>
            <button
              type="button"
              onClick={() => onSetPaymentMode('counter')}
              className={cn(
                'rounded-lg border px-3 py-2 text-left text-xs',
                paymentMode === 'counter'
                  ? 'border-tomato bg-tomato/15 text-cream'
                  : 'border-white/15 text-cream/60',
              )}
            >
              <strong className="block">Comptoir</strong>
              À la caisse
            </button>
          </div>
        </div>

        {/* Erreurs paiement = CheckoutPayment uniquement (pas de doublon avec `error` parent). */}
        <CheckoutPayment
          lines={lines}
          checkout={checkoutDraft}
          subtotal={subtotal}
          deliveryFee={deliveryFee}
          total={total}
          paymentMode={paymentMode}
          onSuccess={onPaymentSuccess}
          onError={onPaymentError}
        />
      </div>
    )
  }

  if (error) {
    return <p className="text-sm text-red-400">{error}</p>
  }

  return null
}

export function CheckoutEmptyCart({ variant }: { variant: 'page' | 'sheet' }) {
  if (variant === 'sheet') return null
  return (
    <div className="mx-auto max-w-md text-center">
      <h1 className="font-display text-2xl font-bold text-cream">Panier vide</h1>
      <p className="mt-3 text-cream/55">Ajoutez des articles depuis la carte.</p>
      <Link href="/#carte" className="mt-6 inline-block text-tomato-light hover:underline">
        Voir la carte →
      </Link>
    </div>
  )
}
