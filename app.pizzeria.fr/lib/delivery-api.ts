import { getDeliveryQuote, type DeliveryQuote } from '@/lib/delivery'

/** Devis livraison — API PostgreSQL avec repli sur config locale. */
export async function fetchDeliveryQuote(
  postalCode: string,
  city: string,
  pizzaSubtotal: number
): Promise<DeliveryQuote> {
  try {
    const params = new URLSearchParams({
      postalCode,
      city,
      pizzaSubtotal: String(pizzaSubtotal),
    })
    const res = await fetch(`/api/public/delivery/quote?${params}`)
    const data = await res.json()
    if (res.ok && data.success !== false) {
      return {
        ok: Boolean(data.ok),
        fee: Number(data.fee) || 0,
        minOrder: Number(data.minOrder) || 0,
        zoneLabel: String(data.zoneLabel ?? ''),
        error: data.error,
      }
    }
  } catch {
    /* repli local */
  }
  return getDeliveryQuote(postalCode, pizzaSubtotal, city)
}
