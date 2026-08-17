/** Canal de vente — extensible marketplaces. */
export const ORDER_CHANNELS = ['POS', 'WEB', 'DELIVEROO', 'UBER_EATS', 'KIOSK'] as const
export type OrderChannel = (typeof ORDER_CHANNELS)[number]

export function isOrderChannel(value: unknown): value is OrderChannel {
  return typeof value === 'string' && (ORDER_CHANNELS as readonly string[]).includes(value)
}

export function resolveOrderChannel(input: {
  channel?: unknown
  isOnlineOrder?: boolean
  source?: unknown
}): OrderChannel {
  if (isOrderChannel(input.channel)) return input.channel
  if (input.source === 'kiosk') return 'KIOSK'
  if (input.isOnlineOrder) return 'WEB'
  return 'POS'
}

/** Canal effectif pour stats (commandes legacy sans channel). */
export function effectiveOrderChannel(order: {
  channel?: string | null
  isOnlineOrder?: boolean
}): OrderChannel {
  if (isOrderChannel(order.channel)) return order.channel
  return order.isOnlineOrder ? 'WEB' : 'POS'
}
