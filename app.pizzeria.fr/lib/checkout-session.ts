import type { OrderType } from './cart-types'
import type { CartLine } from './cart-types'
import type { CheckoutStepId } from './checkout-flow'
import { buildCheckoutSteps } from './checkout-flow'

const STORAGE_KEY = 'laz-pizza-checkout-v1'

export type CheckoutSessionState = {
  step: CheckoutStepId
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
  /** Empreinte du panier au moment de la sauvegarde — invalide si le panier change. */
  cartFingerprint: string
  subtotal: number
}

/** Identifiant stable du contenu du panier (détecte ajout / suppression d'articles). */
export function computeCartFingerprint(lines: CartLine[]): string {
  if (lines.length === 0) return ''
  return lines
    .map((l) => `${l.slug}:${l.sizeId ?? ''}:${l.unitPrice}:${l.quantity}`)
    .sort()
    .join('|')
}

/** Évite de restaurer une étape « Paiement » sans données complètes ou panier différent. */
export function resolveSafeCheckoutStep(
  requested: CheckoutStepId,
  orderType: OrderType | null,
  fields: Pick<
    CheckoutSessionState,
    | 'customerFirstName'
    | 'customerLastName'
    | 'customerPhone'
    | 'addressLine'
    | 'postalCode'
    | 'city'
    | 'timeSlot'
  >
): CheckoutStepId {
  const steps = buildCheckoutSteps(orderType)
  if (!steps.includes(requested)) return 'recap'

  if (requested === 'mode' || requested === 'recap') return requested

  if (!orderType) return 'mode'

  if (orderType === 'delivery') {
    if (!fields.addressLine.trim() || !fields.postalCode.trim() || !fields.city.trim()) {
      return requested === 'address' ? 'address' : 'address'
    }
    if (requested === 'address') return 'address'
  }

  if (requested === 'details') return 'details'

  if (requested === 'confirm') {
    if (
      !fields.customerFirstName.trim() ||
      !fields.customerLastName.trim() ||
      !fields.customerPhone.trim() ||
      !fields.timeSlot.trim()
    ) {
      return 'details'
    }
    return 'confirm'
  }

  return 'recap'
}

export function saveCheckoutSession(state: CheckoutSessionState): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* quota / mode privé */
  }
}

export function loadCheckoutSession(): CheckoutSessionState | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CheckoutSessionState
    // migration sessionStorage → localStorage
    localStorage.setItem(STORAGE_KEY, raw)
    sessionStorage.removeItem(STORAGE_KEY)
    return parsed
  } catch {
    return null
  }
}

export function clearCheckoutSession(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(STORAGE_KEY)
  sessionStorage.removeItem(STORAGE_KEY)
}

export function hasCheckoutSession(): boolean {
  return loadCheckoutSession() !== null
}
