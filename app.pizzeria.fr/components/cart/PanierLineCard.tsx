'use client'

import Image from 'next/image'
import { Minus, Plus, Tag, Trash2 } from 'lucide-react'
import { formatPriceEUR } from '@/lib/menu-types'
import { resolveCartLineImage } from '@/lib/cart-helpers'
import type { CartLine } from '@/lib/cart-types'

type PanierLineCardProps = {
  line: CartLine
  onUpdateQty: (qty: number) => void
  onRemove: () => void
  /** Variante compacte pour le panier latéral */
  compact?: boolean
}

export function PanierLineCard({ line, onUpdateQty, onRemove, compact = false }: PanierLineCardProps) {
  const imageSrc = resolveCartLineImage(line)
  const lineTotal = line.unitPrice * line.quantity

  if (compact) {
    return (
      <li className="flex gap-2.5 rounded-xl border border-white/10 bg-charcoal-soft/80 p-2">
        <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-white/10">
          <Image src={imageSrc} alt="" fill className="object-cover" sizes="44px" />
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-cream">{line.name}</p>
            <p className="text-[10px] text-cream/40">
              {line.sizeLabel ? `${line.sizeLabel} · ` : ''}
              {formatPriceEUR(line.unitPrice)}
            </p>
          </div>
          <div className="inline-flex shrink-0 items-center gap-0.5 rounded-full border border-white/10 bg-charcoal p-0.5">
            <button
              type="button"
              onClick={() => onUpdateQty(line.quantity - 1)}
              className="grid h-6 w-6 place-items-center rounded-full text-cream/50 hover:text-cream"
              aria-label="Moins"
            >
              <Minus className="h-2.5 w-2.5" />
            </button>
            <span className="w-4 text-center text-[11px] font-medium text-cream">{line.quantity}</span>
            <button
              type="button"
              onClick={() => onUpdateQty(line.quantity + 1)}
              className="grid h-6 w-6 place-items-center rounded-full text-cream/50 hover:text-cream"
              aria-label="Plus"
            >
              <Plus className="h-2.5 w-2.5" />
            </button>
          </div>
          <p className="w-12 shrink-0 text-right text-xs font-semibold text-tomato-light">
            {formatPriceEUR(lineTotal)}
          </p>
          <button
            type="button"
            onClick={onRemove}
            className="shrink-0 p-1 text-cream/25 hover:text-red-400"
            aria-label={`Retirer ${line.name}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </li>
    )
  }

  return (
    <li className="flex gap-3 rounded-2xl border border-white/10 bg-charcoal/90 p-3 shadow-sm shadow-black/20 sm:gap-4 sm:p-4">
      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-white/10 sm:h-24 sm:w-24">
        <Image
          src={imageSrc}
          alt={line.name}
          fill
          className="object-cover"
          sizes="96px"
        />
        {line.offerTag && (
          <span className="absolute left-1 top-1 flex items-center gap-0.5 rounded-md bg-tomato px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">
            <Tag className="h-2.5 w-2.5" />
            Menu
          </span>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-semibold leading-snug text-cream">{line.name}</h3>
            {line.sizeLabel && (
              <p className="mt-0.5 text-xs text-cream/45">Taille {line.sizeLabel}</p>
            )}
            {line.offerTag && line.catalogPrice && line.catalogPrice > line.unitPrice && (
              <p className="mt-1 text-[10px] text-emerald-400/90">
                Prix menu ·{' '}
                <span className="text-cream/35 line-through">
                  {formatPriceEUR(line.catalogPrice)}
                </span>
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onRemove}
            className="shrink-0 rounded-lg p-1.5 text-cream/30 transition hover:bg-red-500/10 hover:text-red-400"
            aria-label={`Retirer ${line.name}`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-auto flex items-end justify-between gap-3 pt-3">
          <div className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-charcoal p-0.5">
            <button
              type="button"
              onClick={() => onUpdateQty(line.quantity - 1)}
              className="grid h-7 w-7 place-items-center rounded-full text-cream/60 hover:text-cream"
              aria-label="Moins"
            >
              <Minus className="h-3 w-3" />
            </button>
            <span className="w-6 text-center text-sm font-medium text-cream">{line.quantity}</span>
            <button
              type="button"
              onClick={() => onUpdateQty(line.quantity + 1)}
              className="grid h-7 w-7 place-items-center rounded-full text-cream/60 hover:text-cream"
              aria-label="Plus"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>
          <p className="text-right">
            <span className="block text-xs text-cream/40">{formatPriceEUR(line.unitPrice)} / u.</span>
            <span className="font-semibold text-tomato-light">{formatPriceEUR(lineTotal)}</span>
          </p>
        </div>
      </div>
    </li>
  )
}
