import type { PrismaClient } from '@prisma/client'
import { ensureFiscalTicketForPaidOrder } from './ticket'

export type FiscalTicketHookOpts = {
  offlineRef?: string | null
  offlineSoldAt?: Date | null
  paymentMethod?: string | null
}

/**
 * Émission ticket fiscal obligatoire après encaissement.
 * @throws si le ticket ne peut pas être créé
 */
export async function requireFiscalTicketForPaidOrder(
  prisma: PrismaClient,
  businessId: string,
  orderId: string,
  operatorId?: string | null,
  opts?: FiscalTicketHookOpts,
): Promise<{ ticketId: string; serialNumber: number; created: boolean }> {
  const result = await ensureFiscalTicketForPaidOrder(prisma, {
    businessId,
    orderId,
    operatorId,
    offlineRef: opts?.offlineRef,
    offlineSoldAt: opts?.offlineSoldAt,
    paymentMethod: opts?.paymentMethod,
  })
  if (!result) {
    throw new Error('Émission ticket fiscal impossible — commande non payée ou introuvable')
  }
  return result
}

/** @deprecated Utiliser requireFiscalTicketForPaidOrder (synchrone, bloquant). */
export function hookFiscalTicketForPaidOrder(
  prisma: PrismaClient,
  businessId: string,
  orderId: string,
  operatorId?: string | null,
  opts?: FiscalTicketHookOpts,
): void {
  void requireFiscalTicketForPaidOrder(prisma, businessId, orderId, operatorId, opts).catch((err) =>
    console.error('[fiscal] ticket issuance failed:', err),
  )
}
