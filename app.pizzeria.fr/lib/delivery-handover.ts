export const DELIVERY_ISSUE_REASONS = [
  { value: 'CUSTOMER_ABSENT', label: 'Client absent' },
  { value: 'WRONG_ADDRESS', label: 'Adresse incorrecte' },
  { value: 'ORDER_PROBLEM', label: 'Problème sur la commande' },
  { value: 'CLIENT_REFUSED', label: 'Client refuse la commande' },
  { value: 'OTHER', label: 'Autre' },
] as const

export function deliveryIssueLabel(reason: string | null | undefined): string {
  return DELIVERY_ISSUE_REASONS.find((r) => r.value === reason)?.label ?? reason ?? 'Problème'
}
