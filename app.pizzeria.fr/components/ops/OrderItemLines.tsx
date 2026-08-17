'use client'

import { itemExtras, itemLabel, type OpsOrderItem } from '@/lib/ops-orders'
import { formatEUR } from '@/lib/money'

export function OrderItemLines({
  item,
  showUnitPrice = false,
}: {
  item: OpsOrderItem
  showUnitPrice?: boolean
}) {
  const extras = itemExtras(item)

  return (
    <div className="min-w-0 flex-1">
      <p className="font-medium text-cream">
        {item.quantity}× {itemLabel(item)}
        {showUnitPrice && item.quantity > 1 && (
          <span className="ml-1 font-normal text-cream/45">({formatEUR(item.price)} / u.)</span>
        )}
      </p>
      {extras.map((line) => (
        <p key={line} className="text-xs text-cream/50">
          {line}
        </p>
      ))}
    </div>
  )
}

export function OrderItemLineTotal({ item }: { item: OpsOrderItem }) {
  return (
    <span className="shrink-0 font-medium text-cream/70">{formatEUR(item.price * item.quantity)}</span>
  )
}

