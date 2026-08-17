'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Loader2, Minus, Plus, ShoppingBag, Sparkles, Trash2 } from 'lucide-react'
import { fetchPublicMenu } from '@/lib/menu-api'
import { resolveMenuItemImageUrl } from '@/lib/menu-image-url'
import type { CatalogCategory, CatalogItem } from '@/lib/menu-types'
import { formatEUR } from '@/lib/money'
import { AppModuleBrand } from '@/components/brand/AppModuleBrand'
import { cn } from '@/lib/cn'

type CartLine = { item: CatalogItem; quantity: number }
type KioskMode = 'surplace' | 'emporter'

export function KioskDisplay() {
  const [categories, setCategories] = useState<CatalogCategory[] | null>(null)
  const [activeCat, setActiveCat] = useState<string | null>(null)
  const [lines, setLines] = useState<CartLine[]>([])
  const [mode, setMode] = useState<KioskMode>('surplace')
  const [step, setStep] = useState<'menu' | 'done'>('menu')
  const [orderNumber, setOrderNumber] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void fetchPublicMenu()
      .then((cats) => {
        setCategories(cats)
        setActiveCat(cats[0]?.id ?? null)
      })
      .catch(() => setError('Menu indisponible'))
  }, [])

  const items = useMemo(() => {
    if (!categories || !activeCat) return []
    return categories.find((c) => c.id === activeCat)?.items ?? []
  }, [categories, activeCat])

  const total = lines.reduce((a, l) => a + l.item.price * l.quantity, 0)
  const itemCount = lines.reduce((a, l) => a + l.quantity, 0)

  const add = (item: CatalogItem) => {
    setLines((prev) => {
      const found = prev.find((l) => l.item.slug === item.slug)
      if (found) {
        return prev.map((l) => (l.item.slug === item.slug ? { ...l, quantity: l.quantity + 1 } : l))
      }
      return [...prev, { item, quantity: 1 }]
    })
  }

  const submit = useCallback(async () => {
    if (!lines.length || busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/public/kiosk-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          items: lines.map((l) => ({ slug: l.item.slug, quantity: l.quantity })),
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error ?? 'Erreur commande')
      setOrderNumber(data.orderNumber)
      setStep('done')
      setLines([])
      setTimeout(() => {
        setStep('menu')
        setOrderNumber(null)
      }, 12_000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setBusy(false)
    }
  }, [lines, mode, busy])

  if (step === 'done' && orderNumber != null) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-charcoal to-[#1a0e08] p-8 text-center text-cream">
        <div className="relative">
          <Sparkles className="absolute -left-8 -top-6 h-8 w-8 text-tomato/40" />
          <CheckCircle2 className="mb-6 h-24 w-24 text-emerald-400" />
        </div>
        <p className="text-sm uppercase tracking-[0.35em] text-cream/50">Commande enregistrée</p>
        <p className="mt-4 font-display text-8xl font-bold text-tomato-light">#{orderNumber}</p>
        <p className="mt-6 max-w-lg text-lg text-cream/70">
          {mode === 'surplace'
            ? 'Prenez place — nous appellerons votre numéro quand la commande sera prête.'
            : 'Réglez au comptoir — votre numéro s\'affichera en cuisine.'}
        </p>
        <p className="mt-8 text-xs text-cream/35">Retour au menu dans quelques secondes…</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-charcoal text-cream">
      <header className="border-b border-white/10 bg-[#0d0a09] px-6 py-5">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
          <div>
            <AppModuleBrand variant="kiosk" />
            <h1 className="mt-3 font-display text-3xl font-bold md:text-4xl">Commandez ici</h1>
            <p className="mt-1 text-sm text-cream/45">Touchez un produit · réglez au comptoir ou borne paiement</p>
          </div>
          <div className="flex gap-2">
            {(['surplace', 'emporter'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={cn(
                  'min-h-[48px] rounded-2xl border-2 px-6 py-3 text-sm font-bold transition active:scale-95',
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

      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 p-4 lg:flex-row lg:p-6">
        <section className="min-h-0 min-w-0 flex-1">
          {!categories ? (
            <div className="flex justify-center py-24">
              <Loader2 className="h-10 w-10 animate-spin text-tomato-light" />
            </div>
          ) : (
            <>
              <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
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
                    {c.name}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
                {items.map((item) => {
                  const img = resolveMenuItemImageUrl(item.image)
                  return (
                    <button
                      key={item.slug}
                      type="button"
                      onClick={() => add(item)}
                      className="group overflow-hidden rounded-2xl border border-white/10 bg-[#141010] text-left transition active:scale-[0.98] hover:border-tomato/40"
                    >
                      {img ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={img} alt="" className="aspect-[4/3] w-full object-cover opacity-90 group-hover:opacity-100" />
                      ) : (
                        <div className="aspect-[4/3] w-full bg-gradient-to-br from-tomato/20 to-transparent" />
                      )}
                      <div className="p-3">
                        <p className="font-semibold leading-tight">{item.name}</p>
                        <p className="mt-2 font-mono text-lg font-bold text-tomato-light">{formatEUR(item.price)}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </section>

        <aside className="flex w-full shrink-0 flex-col rounded-2xl border border-white/10 bg-[#141010] p-5 lg:w-[380px]">
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
          <div className="min-h-[180px] flex-1 space-y-2 overflow-auto">
            {lines.length === 0 && (
              <p className="py-16 text-center text-sm text-cream/35">Ajoutez des produits depuis le menu</p>
            )}
            {lines.map((l) => (
              <div key={l.item.slug} className="rounded-xl border border-white/5 bg-black/25 p-3">
                <p className="text-sm font-medium">{l.item.name}</p>
                <div className="mt-2 flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        setLines((p) =>
                          p
                            .map((x) =>
                              x.item.slug === l.item.slug ? { ...x, quantity: x.quantity - 1 } : x,
                            )
                            .filter((x) => x.quantity > 0),
                        )
                      }
                      className="rounded-lg bg-white/10 p-2"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="w-8 text-center text-lg font-bold">{l.quantity}</span>
                    <button type="button" onClick={() => add(l.item)} className="rounded-lg bg-white/10 p-2">
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                  <span className="font-mono text-sm text-tomato-light">{formatEUR(l.item.price * l.quantity)}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-baseline justify-between border-t border-white/10 pt-4">
            <span className="text-xs uppercase tracking-widest text-cream/40">Total TTC</span>
            <span className="font-display text-4xl text-tomato-light">{formatEUR(total)}</span>
          </div>
          {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
          <button
            type="button"
            disabled={busy || lines.length === 0}
            onClick={() => void submit()}
            className="mt-4 flex h-16 w-full items-center justify-center rounded-2xl bg-tomato text-xl font-bold text-white shadow-lg shadow-tomato/20 disabled:opacity-40"
          >
            {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : 'Valider ma commande'}
          </button>
          {lines.length > 0 && (
            <button
              type="button"
              onClick={() => setLines([])}
              className="mt-2 flex w-full items-center justify-center gap-1 py-2 text-xs text-cream/40 hover:text-red-400"
            >
              <Trash2 className="h-3 w-3" /> Vider le panier
            </button>
          )}
        </aside>
      </div>
    </div>
  )
}
