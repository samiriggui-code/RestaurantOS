export const ORDER_TYPE_CHART_LABEL: Record<string, string> = {
  DELIVERY: 'Livraison',
  TAKEAWAY: 'À emporter',
  PICKUP: 'Retrait',
  DINE_IN: 'Sur place',
}

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  CASH: 'Espèces',
  CARD: 'Carte (TPE)',
  STRIPE: 'Stripe en ligne',
  ONLINE: 'En ligne',
  UNKNOWN: 'Non renseigné',
}

export const CHART_COLORS = [
  '#E85D4C',
  '#F4A261',
  '#2A9D8F',
  '#457B9D',
  '#9B5DE5',
  '#F72585',
  '#4CC9F0',
  '#80B918',
]

export function orderTypeLabel(type: string): string {
  return ORDER_TYPE_CHART_LABEL[type] ?? type.replace(/_/g, ' ')
}

export function paymentMethodLabel(method: string): string {
  return PAYMENT_METHOD_LABEL[method] ?? method.replace(/_/g, ' ')
}
