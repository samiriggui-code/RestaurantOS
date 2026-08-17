/** Filtre Prisma — exclut les commandes non payées (tentatives CB, comptoir non encaissé). */
export const UNPAID_PENDING_ORDER_FILTER = {
  status: 'PENDING_PAYMENT' as const,
  paymentStatus: 'UNPAID' as const,
}

/**
 * Exclure les commandes impayées de la liste admin sauf si le client demande explicitement
 * les impayées (POS comptoir) ou includeUnpaid=true.
 */
export function shouldExcludeUnpaidOrders(query: {
  includeUnpaid?: string
  paymentStatus?: string | string[] | undefined
  status?: string | string[] | undefined
}): boolean {
  if (query.includeUnpaid === 'true') return false
  if (query.paymentStatus === 'UNPAID') return false
  const status = query.status
  if (typeof status === 'string' && status.includes('PENDING_PAYMENT')) return false
  return true
}
