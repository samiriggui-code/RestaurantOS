/** Code 4 chiffres remis au client pour valider la livraison avec le livreur. */

export function generateDeliveryHandoverCode(): string {
  return String(Math.floor(1000 + Math.random() * 9000))
}

export function normalizeHandoverCode(input: string): string {
  return input.replace(/\D/g, '').slice(0, 4)
}

export function isValidHandoverCode(input: string, expected: string | null | undefined): boolean {
  if (!expected) return false
  const a = normalizeHandoverCode(input)
  const b = normalizeHandoverCode(expected)
  return a.length === 4 && a === b
}

export const DELIVERY_ISSUE_REASONS = [
  { value: 'CUSTOMER_ABSENT', label: 'Client absent' },
  { value: 'WRONG_ADDRESS', label: 'Adresse incorrecte' },
  { value: 'ORDER_PROBLEM', label: 'Problème sur la commande' },
  { value: 'CLIENT_REFUSED', label: 'Client refuse la commande' },
  { value: 'OTHER', label: 'Autre' },
] as const

export type DeliveryIssueReason = (typeof DELIVERY_ISSUE_REASONS)[number]['value']

export function deliveryIssueLabel(reason: string | null | undefined): string {
  return DELIVERY_ISSUE_REASONS.find((r) => r.value === reason)?.label ?? reason ?? 'Problème'
}
