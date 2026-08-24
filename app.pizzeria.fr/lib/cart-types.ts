import type { PizzaSizeId } from './pizza-sizes'

export type OrderType = 'pickup' | 'delivery'

export type CartLine = {
  lineId: string
  slug: string
  name: string
  categoryId: string
  unitPrice: number
  quantity: number
  sizeId?: PizzaSizeId
  sizeLabel?: string
  image?: string
  /** Prix catalogue avant réduction menu */
  catalogPrice?: number
  /** formule-duo | formule-dessert | extra */
  offerTag?: string
}

export type CheckoutDraft = {
  orderType: OrderType
  customerFirstName: string
  customerLastName: string
  customerPhone: string
  customerEmail: string
  addressLine: string
  postalCode: string
  city: string
  instructions: string
  timeSlot: string
  /** online = SumUp (carte en ligne) · counter = encaissement comptoir / TPE */
  paymentMode?: 'online' | 'counter'
}

/** Nom complet pour affichage / impression */
export function customerFullName(checkout: Pick<CheckoutDraft, 'customerFirstName' | 'customerLastName'>): string {
  return `${checkout.customerFirstName} ${checkout.customerLastName}`.trim()
}

export type GuestOrderPayload = {
  lines: CartLine[]
  checkout: CheckoutDraft
  subtotal: number
  deliveryFee: number
  total: number
}

export type GuestOrderResult = {
  success: true
  token: string
  orderNumber: number
}
