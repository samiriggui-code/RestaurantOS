'use client'



import { useEffect, useState } from 'react'

import Image from 'next/image'

import { AlertCircle, Check, CupSoda } from 'lucide-react'

import { useCart } from '@/components/cart/CartProvider'

import { getMenuCompletion } from '@/lib/cart-upsells'

import { fetchMenuFormules, type MenuFormulesConfig } from '@/lib/formules-api'

import { fetchPublicMenu } from '@/lib/menu-api'

import { formatPriceEUR } from '@/lib/menu-types'

import type { CatalogItem } from '@/lib/menu-types'

import { cn } from '@/lib/cn'



export function MenuFormulePanel() {

  const { lines, addItem } = useCart()

  const status = getMenuCompletion(lines)

  const [formules, setFormules] = useState<MenuFormulesConfig | null>(null)

  const [drinkOptions, setDrinkOptions] = useState<CatalogItem[]>([])

  const [selectedSlug, setSelectedSlug] = useState('')

  const [added, setAdded] = useState(false)



  useEffect(() => {

    let cancelled = false

    void Promise.all([fetchMenuFormules(), fetchPublicMenu()])

      .then(([config, categories]) => {

        if (cancelled) return

        setFormules(config)

        const drinks =

          categories.find((c) => c.id === 'boissons')?.items.filter((i) =>

            config.duo.eligibleSlugs.includes(i.slug),

          ) ?? []

        setDrinkOptions(drinks)

        setSelectedSlug((current) => current || drinks[0]?.slug || '')

      })

      .catch(() => {

        if (!cancelled) {

          setFormules(null)

          setDrinkOptions([])

        }

      })

    return () => {

      cancelled = true

    }

  }, [])



  if (!formules || drinkOptions.length === 0) return null



  if (!status.drinkMissing) {

    if (status.hasPizza && status.hasDrink) {

      return (

        <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-950/30 px-4 py-3">

          <Check className="h-5 w-5 shrink-0 text-emerald-400" />

          <p className="text-sm text-emerald-100">Menu pizza + boisson complet</p>

        </div>

      )

    }

    return null

  }



  const selected = drinkOptions.find((d) => d.slug === selectedSlug) ?? drinkOptions[0]

  if (!selected) return null



  const formulePrice = formules.duo.priceEuros



  function handleAddDrink() {

    if (!formules) return

    addItem({

      slug: selected.slug,

      name: selected.name,

      categoryId: 'boissons',

      basePrice: selected.price,

      unitPrice: formulePrice,

      catalogPrice: selected.price,

      image: selected.image || '/images/categories/boissons.jpg',

      offerTag: formules.duo.offerTag,

    })

    setAdded(true)

    window.setTimeout(() => setAdded(false), 2000)

  }



  return (

    <section className="overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-950/40 via-charcoal to-charcoal">

      <div className="flex items-start gap-3 border-b border-amber-500/20 px-4 py-3 sm:px-5">

        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />

        <div>

          <p className="text-xs font-bold uppercase tracking-widest text-amber-300/90">Menu incomplet</p>

          <h2 className="mt-0.5 font-display text-lg font-bold text-cream">{formules.duo.name}</h2>

          <p className="mt-1 text-sm text-cream/55">

            Choix de boisson <strong className="text-cream/80">obligatoire</strong> pour compléter votre

            menu à {formatPriceEUR(formulePrice)} au lieu de {formatPriceEUR(selected.price)}.

          </p>

        </div>

      </div>



      <div className="p-4 sm:p-5">

        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-cream/40">

          Choisissez votre boisson

        </p>

        <div className="grid gap-2 sm:grid-cols-3">

          {drinkOptions.map((drink) => {

            const active = drink.slug === selectedSlug

            return (

              <button

                key={drink.slug}

                type="button"

                onClick={() => setSelectedSlug(drink.slug)}

                className={cn(

                  'flex items-center gap-3 rounded-xl border p-3 text-left transition',

                  active

                    ? 'border-tomato bg-tomato/15 ring-1 ring-tomato/40'

                    : 'border-white/10 bg-charcoal/60 hover:border-white/20'

                )}

              >

                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg">

                  <Image

                    src={drink.image || '/images/categories/boissons.jpg'}

                    alt={drink.name}

                    fill

                    className="object-cover"

                    sizes="48px"

                  />

                </div>

                <div className="min-w-0">

                  <p className="text-xs font-semibold text-cream">{drink.name}</p>

                  <p className="text-[10px] text-cream/40 line-through">{formatPriceEUR(drink.price)}</p>

                  <p className="text-xs font-bold text-tomato-light">{formatPriceEUR(formulePrice)}</p>

                </div>

              </button>

            )

          })}

        </div>



        <button

          type="button"

          onClick={handleAddDrink}

          className={cn(

            'mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition',

            added ? 'bg-emerald-600 text-white' : 'bg-tomato text-white hover:bg-tomato-light'

          )}

        >

          {added ? (

            <>

              <Check className="h-4 w-4" />

              Boisson ajoutée au menu

            </>

          ) : (

            <>

              <CupSoda className="h-4 w-4" />

              Ajouter la boisson au menu — {formatPriceEUR(formulePrice)}

            </>

          )}

        </button>

      </div>

    </section>

  )

}

