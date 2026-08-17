'use client'

import { cn } from '@/lib/cn'
import {
  isMarketplaceChannel,
  orderChannelBadgeClass,
  orderChannelLabel,
  orderChannelShortLabel,
  type OpsOrder,
} from '@/lib/ops-orders'

type Props = {
  order: OpsOrder
  compact?: boolean
  className?: string
}

/** Badge canal — accent marketplace Deliveroo / Uber Eats en cuisine et POS. */
export function OrderChannelBadge({ order, compact, className }: Props) {
  const marketplace = isMarketplaceChannel(order)
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold',
        orderChannelBadgeClass(order),
        marketplace && 'ring-1 ring-white/10',
        className,
      )}
    >
      {marketplace && !compact ? (
        <>
          <span aria-hidden className="font-black tracking-tight">
            {orderChannelShortLabel(order)}
          </span>
          <span className="opacity-80">·</span>
        </>
      ) : null}
      {compact && marketplace ? orderChannelShortLabel(order) : orderChannelLabel(order)}
    </span>
  )
}
