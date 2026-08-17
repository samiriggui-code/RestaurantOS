import type { OrderType } from './cart-types'

export type CheckoutStepId = 'recap' | 'mode' | 'address' | 'details' | 'confirm' | 'track'

export const CHECKOUT_STEP_LABELS: Record<CheckoutStepId, string> = {
  recap: 'Panier',
  mode: 'Mode',
  address: 'Livraison',
  details: 'Coordonnées',
  confirm: 'Paiement',
  track: 'Suivi',
}

export function buildCheckoutSteps(orderType: OrderType | null): CheckoutStepId[] {
  const steps: CheckoutStepId[] = ['recap', 'mode']
  if (orderType === 'delivery') steps.push('address')
  steps.push('details', 'confirm')
  return steps
}

/** Étapes dans le panier latéral — le mode est choisi via le toggle en haut. */
export function buildSheetCheckoutSteps(orderType: OrderType): CheckoutStepId[] {
  const steps: CheckoutStepId[] = ['recap']
  if (orderType === 'delivery') steps.push('address')
  steps.push('details', 'confirm')
  return steps
}

export function stepIndex(steps: CheckoutStepId[], id: CheckoutStepId): number {
  return steps.indexOf(id)
}
