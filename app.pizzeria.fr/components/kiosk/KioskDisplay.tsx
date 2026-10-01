'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Banknote,
  CheckCircle2,
  CreditCard,
  Loader2,
  Minus,
  Plus,
  ShoppingBag,
  Store,
  Trash2,
  X,
} from 'lucide-react'
import { fetchPublicMenu } from '@/lib/menu-api'
import { resolveMenuItemImageUrl } from '@/lib/menu-image-url'
import { type CatalogCategory, type CatalogItem, isPizzaCategoryId } from '@/lib/menu-types'
import { AppModuleBrand } from '@/components/brand/AppModuleBrand'
import { cn } from '@/lib/cn'
import { startAppHeartbeat } from '@/lib/device-fleet'
import { PosPizzaSizeSheet } from '@/components/pos/PosPizzaSizeSheet'
import { pizzaSizeLabel, type PizzaSizeId } from '@/lib/pizza-sizes'
import { eurosToCents, formatEUR } from '@/lib/money'
import { KioskScreensaver } from '@/components/kiosk/KioskScreensaver'

type CartLine = {
  key: string
  item: CatalogItem
  quantity: number
  sizeId?: PizzaSizeId
  unitPriceCents: number
}

type KioskMode = 'surplace' | 'emporter'
type PayMethod = 'CARD' | 'CASH' | 'COUNTER'

const IDLE_MS = 90_000

function lineKey(item: CatalogItem, sizeId?: PizzaSizeId) {
  return `${item.id ?? item.slug}:${sizeId ?? 'default'}`
}

async function placeKioskOrder(
  mode: KioskMode,
  lines: CartLine[],
  paymentMethod: PayMethod,
): Promise<{ orderNumber: number }> {
  const res = await fetch('/api/public/kiosk-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode,
      paymentMethod,
      items: lines.map((l) => ({
        menuItemId: l.item.id,
        slug: l.item.slug,
        quantity: l.quantity,
        priceCents: l.unitPriceCents,
        sizeId: l.sizeId,
        sizeLabel: l.sizeId ? pizzaSizeLabel(l.sizeId) : undefined,
      })),
    }),
  })
  const data = (await res.json()) as {
    success?: boolean
    error?: string
    orderNumber?: number
  }
  if (!res.ok || !data.success || data.orderNumber == null) {
    throw new Error(data.error ?? 'Commande impossible')
  }
  return { orderNumber: data.orderNumber }
}

async function runPublicSumupPayment(amountCents: number, reference: string): Promise<void> {
  const start = await fetch('/api/public/kiosk/sumup/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amountCents, reference }),
  })
  const started = (await start.json()) as { checkoutId?: string; error?: string }
  if (!start.ok || !started.checkoutId) {
    throw new Error(started.error ?? 'Lecteur SumUp indisponible')
  }

  const deadline = Date.now() + 120_000
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 1500))
    const st = await fetch(`/api/public/kiosk/sumup/checkout/${encodeURIComponent(started.checkoutId)}`)
    const body = (await st.json()) as { status?: string; error?: string }
    if (!st.ok) throw new Error(body.error ?? 'Statut SumUp impossible')
    if (body.status === 'successful') return
    if (body.status === 'failed' || body.status === 'cancelled') {
      throw new Error('Paiement carte refusé ou annulé')
    }
  }
  throw new Error('Délai de paiement dépassé')
}

export function KioskDisplay() {
  const [awake, setAwake] = useState(false)
  const [categories, setCategories] = useState<CatalogCategory[] | null>(null)
  const [activeCat, setActiveCat] = useState<string | null>(null)
  const [lines, setLines] = useState<CartLine[]>([])
  const [mode, setMode] = useState<KioskMode>('surplace')
  const [step, setStep] = useState<'menu' | 'pay' | 'done'>('menu')
  const [orderNumber, setOrderNumber] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [payHint, setPayHint] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [menuError, setMenuError] = useState<string | null>(null)
  const [sizePicker, setSizePicker] = useState<{ item: CatalogItem; categoryId: string } | null>(
    null,
  )
  const [cartOpen, setCartOpen] = useState(false)
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const goIdle = useCallback(() => {
    setAwake(false)
    setLines([])
    setStep('menu')
    setCartOpen(false)
    setSizePicker(null)
    setError(null)
    setPayHint(null)
    setOrderNumber(null)
  }, [])

  const bumpIdle = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current)
    if (!awake || step === 'done' || step === 'pay') return
    idleTimer.current = setTimeout(goIdle, IDLE_MS)
  }, [awake, goIdle, step])

  useEffect(() => {
    bumpIdle()
    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current)
    }
  }, [bumpIdle, lines, mode, activeCat])

  const loadMenu = useCallback(() => {
    setMenuError(null)
    void fetchPublicMenu(true)
      .then((cats) => {
        setCategories(cats)
        setActiveCat((prev) => prev ?? cats[0]?.id ?? null)
      })
      .catch((e) => {
        setCategories([])
        setMenuError(e instanceof Error ? e.message : 'Menu indisponible')
      })
  }, [])

  useEffect(() => {
    loadMenu()
  }, [loadMenu])

  useEffect(() => startAppHeartbeat('kiosk'), [])

  const items = useMemo(() => {
    if (!categories || !activeCat) return []
    return categories.find((c) => c.id === activeCat)?.items ?? []
  }, [categories, activeCat])

  const totalCents = lines.reduce((a, l) => a + l.unitPriceCents * l.quantity, 0)
  const itemCount = lines.reduce((a, l) => a + l.quantity, 0)

  const addLine = (item: CatalogItem, sizeId?: PizzaSizeId, unitPriceCents?: number) => {
    if (!item.id) {
      setError('Article indisponible — réessayez')
      return
    }
    const priceCents = unitPriceCents ?? eurosToCents(item.price)
    const key = lineKey(item, sizeId)
    setLines((prev) => {
      const found = prev.find((l) => l.key === key)
      if (found) {
        return prev.map((l) => (l.key === key ? { ...l, quantity: l.quantity + 1 } : l))
      }
      return [...prev, { key, item, quantity: 1, sizeId, unitPriceCents: priceCents }]
    })
    setCartOpen(true)
    setError(null)
    bumpIdle()
  }

  const pickItem = (item: CatalogItem, categoryId: string) => {
    if (isPizzaCategoryId(categoryId)) {
      setSizePicker({ item, categoryId })
      return
    }
    addLine(item)
  }

  const changeQty = (key: string, delta: number) => {
    setLines((prev) =>
      prev
        .map((l) => (l.key === key ? { ...l, quantity: l.quantity + delta } : l))
        .filter((l) => l.quantity > 0),
    )
    bumpIdle()
  }

  const finishOrder = async (paymentMethod: PayMethod) => {
    if (!lines.length || busy) return
    setBusy(true)
    setError(null)
    setPayHint(null)
    try {
      if (paymentMethod === 'CARD') {
        setPayHint('Présentez la carte sur le lecteur SumUp…')
        await runPublicSumupPayment(totalCents, `kiosk-${Date.now()}`)
        setPayHint('Paiement OK — envoi en cuisine…')
      }
      const { orderNumber: num } = await placeKioskOrder(mode, lines, paymentMethod)
      setOrderNumber(num)
      setLines([])
      setStep('done')
      setCartOpen(false)
      window.setTimeout(goIdle, 14_000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Paiement / commande impossible')
      setStep('menu')
    } finally {
      setBusy(false)
      setPayHint(null)
    }
  }

  if (!awake) {
    return (
      <KioskScreensaver
        onWake={() => {
          setAwake(true)
          bumpIdle()
        }}
      />
    )
  }

  if (step === 'done' && orderNumber != null) {
    return (
      <div className="flex h-full min-h-0 flex-1 flex-col items-center justify-center bg-gradient-to-b from-charcoal to-[#1a0e08] p-8 text-center">
        <CheckCircle2 className="mb-6 h-24 w-24 text-emerald-400" />
        <p className="text-sm uppercase tracking-[0.35em] text-cream/50">Commande envoyée en cuisine</p>
        <p className="mt-4 font-display text-8xl font-bold text-tomato-light">#{orderNumber}</p>
        <p className="mt-6 max-w-lg text-lg text-cream/70">
          {mode === 'surplace'
            ? 'Prenez place — nous appellerons votre numéro.'
            : 'Retirez au comptoir quand c’est prêt.'}
        </p>
      </div>
    )
  }

  return (
    <div
      className="flex h-full min-h-0 flex-1 flex-col overflow-hidden"
      onPointerDown={bumpIdle}
    >
      <header className="shrink-0 border-b border-white/10 bg-[#0d0a09] px-4 py-3 md:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <AppModuleBrand variant="kiosk" />
            <h1 className="mt-1 font-display text-2xl font-bold md:text-3xl">Commandez ici</h1>
            <p className="text-xs text-cream/45 md:text-sm">Paiement CB · espèces · ou au comptoir</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(['surplace', 'emporter'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={cn(
                  'min-h-[48px] rounded-2xl border-2 px-5 py-2.5 text-sm font-bold transition active:scale-95',
                  mode === m
                    ? 'border-tomato bg-tomato/15 text-tomato-light'
                    : 'border-white/10 text-cream/50',
                )}
              >
                {m === 'surplace' ? 'Sur place' : 'À emporter'}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <section className="flex min-h-0 min-w-0 flex-1 flex-col">
          {categories === null ? (
            <div className="flex flex-1 items-center justify-center">
              <Loader2 className="h-10 w-10 animate-spin text-tomato-light" />
            </div>
          ) : menuError ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
              <p className="text-red-300">{menuError}</p>
              <button
                type="button"
                onClick={loadMenu}
                className="rounded-xl bg-tomato px-5 py-3 text-sm font-bold text-white"
              >
                Réessayer
              </button>
            </div>
          ) : (
            <>
              <div className="shrink-0 overflow-x-auto border-b border-white/5 px-3 py-3 md:px-4">
                <div className="flex gap-2">
                  {categories.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setActiveCat(c.id)}
                      className={cn(
                        'shrink-0 rounded-full border-2 px-5 py-2.5 text-sm font-bold',
                        activeCat === c.id
                          ? 'border-tomato bg-tomato text-white'
                          : 'border-white/10 text-cream/60',
                      )}
                    >
                      {c.shortLabel || c.name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 pb-28 md:p-4 lg:pb-4">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                  {items.map((item) => {
                    const img = resolveMenuItemImageUrl(item.image)
                    return (
                      <button
                        key={item.slug}
                        type="button"
                        onClick={() => pickItem(item, activeCat!)}
                        className="group overflow-hidden rounded-2xl border border-white/10 bg-[#141010] text-left transition active:scale-[0.98] hover:border-tomato/40"
                      >
                        {img ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={img}
                            alt=""
                            className="aspect-[4/3] w-full object-cover opacity-90 group-hover:opacity-100"
                          />
                        ) : (
                          <div className="flex aspect-[4/3] w-full items-center justify-center bg-gradient-to-br from-tomato/25 to-transparent font-display text-3xl text-tomato-light/40">
                            {item.name.slice(0, 1)}
                          </div>
                        )}
                        <div className="p-3">
                          <p className="font-semibold leading-tight">{item.name}</p>
                          <p className="mt-2 font-mono text-lg font-bold text-tomato-light">
                            {formatEUR(eurosToCents(item.price))}
                          </p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            </>
          )}
        </section>

        <aside className="hidden w-[380px] shrink-0 flex-col border-l border-white/10 bg-[#141010] lg:flex">
          <CartPanel
            lines={lines}
            itemCount={itemCount}
            totalCents={totalCents}
            error={error}
            busy={busy}
            onChangeQty={changeQty}
            onClear={() => setLines([])}
            onAdd={(l) => addLine(l.item, l.sizeId, l.unitPriceCents)}
            onPay={() => {
              if (!lines.length) return
              setStep('pay')
            }}
          />
        </aside>
      </div>

      <div className="shrink-0 border-t border-white/10 bg-[#0d0a09] p-3 lg:hidden">
        <button
          type="button"
          onClick={() => setCartOpen(true)}
          className="flex h-14 w-full items-center justify-between rounded-2xl bg-tomato px-4 text-white"
        >
          <span className="flex items-center gap-2 font-bold">
            <ShoppingBag className="h-5 w-5" />
            Panier · {itemCount}
          </span>
          <span className="font-mono text-lg font-bold">{formatEUR(totalCents)}</span>
        </button>
      </div>

      {cartOpen && (
        <div className="fixed inset-0 z-40 flex flex-col justify-end bg-black/70 lg:hidden">
          <button type="button" className="flex-1" aria-label="Fermer" onClick={() => setCartOpen(false)} />
          <div className="flex max-h-[75vh] flex-col rounded-t-3xl border border-white/10 bg-[#141010]">
            <CartPanel
              lines={lines}
              itemCount={itemCount}
              totalCents={totalCents}
              error={error}
              busy={busy}
              onChangeQty={changeQty}
              onClear={() => setLines([])}
              onAdd={(l) => addLine(l.item, l.sizeId, l.unitPriceCents)}
              onPay={() => {
                if (!lines.length) return
                setCartOpen(false)
                setStep('pay')
              }}
            />
          </div>
        </div>
      )}

      {sizePicker && (
        <PosPizzaSizeSheet
          itemName={sizePicker.item.name}
          basePriceCents={eurosToCents(sizePicker.item.price)}
          onClose={() => setSizePicker(null)}
          onPick={(sizeId, unitPriceCents) => {
            addLine(sizePicker.item, sizeId, unitPriceCents)
            setSizePicker(null)
          }}
        />
      )}

      {step === 'pay' && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#1A1412] p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-widest text-cream/40">Paiement</p>
                <p className="font-display text-2xl text-cream">{formatEUR(totalCents)}</p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => setStep('menu')}
                className="rounded-lg p-2 text-cream/50 hover:bg-white/10"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {payHint && <p className="mb-3 text-sm text-amber-200">{payHint}</p>}
            {error && <p className="mb-3 text-sm text-red-400">{error}</p>}
            <div className="grid gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void finishOrder('CARD')}
                className="flex h-14 items-center justify-center gap-2 rounded-xl bg-tomato text-base font-bold text-white disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <CreditCard className="h-5 w-5" />}
                Carte bancaire
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void finishOrder('CASH')}
                className="flex h-14 items-center justify-center gap-2 rounded-xl border border-white/15 text-base font-semibold text-cream hover:bg-white/5 disabled:opacity-50"
              >
                <Banknote className="h-5 w-5" /> Espèces (au totem)
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void finishOrder('COUNTER')}
                className="flex h-14 items-center justify-center gap-2 rounded-xl border border-white/10 text-sm font-medium text-cream/70 hover:bg-white/5 disabled:opacity-50"
              >
                <Store className="h-4 w-4" /> Régler au comptoir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function CartPanel({
  lines,
  itemCount,
  totalCents,
  error,
  busy,
  onChangeQty,
  onClear,
  onAdd,
  onPay,
}: {
  lines: CartLine[]
  itemCount: number
  totalCents: number
  error: string | null
  busy: boolean
  onChangeQty: (key: string, delta: number) => void
  onClear: () => void
  onAdd: (line: CartLine) => void
  onPay: () => void
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-cream/45">
          <ShoppingBag className="h-4 w-4" /> Panier
        </div>
        {itemCount > 0 && (
          <span className="rounded-full bg-tomato/20 px-2 py-0.5 text-xs font-bold text-tomato-light">
            {itemCount} article{itemCount > 1 ? 's' : ''}
          </span>
        )}
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
        {lines.length === 0 && (
          <p className="py-12 text-center text-sm text-cream/35">Touchez un produit pour commencer</p>
        )}
        {lines.map((l) => (
          <div key={l.key} className="rounded-xl border border-white/5 bg-black/25 p-3">
            <p className="text-sm font-medium">{l.item.name}</p>
            {l.sizeId && <p className="text-[11px] text-cream/40">{pizzaSizeLabel(l.sizeId)}</p>}
            <div className="mt-2 flex items-center justify-between">
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => onChangeQty(l.key, -1)} className="rounded-lg bg-white/10 p-2">
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-8 text-center text-lg font-bold">{l.quantity}</span>
                <button type="button" onClick={() => onAdd(l)} className="rounded-lg bg-white/10 p-2">
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <span className="font-mono text-sm text-tomato-light">
                {formatEUR(l.unitPriceCents * l.quantity)}
              </span>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-baseline justify-between border-t border-white/10 pt-4">
        <span className="text-xs uppercase tracking-widest text-cream/40">Total TTC</span>
        <span className="font-display text-4xl text-tomato-light">{formatEUR(totalCents)}</span>
      </div>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
      <button
        type="button"
        disabled={busy || lines.length === 0}
        onClick={onPay}
        className="mt-4 flex h-16 w-full items-center justify-center rounded-2xl bg-tomato text-xl font-bold text-white disabled:opacity-40"
      >
        Payer
      </button>
      {lines.length > 0 && (
        <button
          type="button"
          onClick={onClear}
          className="mt-2 flex w-full items-center justify-center gap-1 py-2 text-xs text-cream/40 hover:text-red-400"
        >
          <Trash2 className="h-3 w-3" /> Vider
        </button>
      )}
    </div>
  )
}
