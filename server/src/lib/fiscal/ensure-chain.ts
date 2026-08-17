import type { PrismaClient } from '@prisma/client'
import { repairFiscalEventChain } from './repair-jet-chain'
import { verifyFiscalChains, type ChainVerifyResult } from './verify-chain'

/** Labo : répare automatiquement si la chaîne JET est compromise avant contrôle pré-clôture. */
export async function verifyOrRepairFiscalChains(
  prisma: PrismaClient,
  businessId: string,
): Promise<ChainVerifyResult> {
  let result = await verifyFiscalChains(prisma, businessId)
  if (result.ok || process.env.FISCAL_ALLOW_JET_REPAIR !== 'true') {
    return result
  }

  console.warn(`[fiscal] Auto-réparation JET (${businessId}) : ${result.message}`)
  await repairFiscalEventChain(prisma, businessId)
  result = await verifyFiscalChains(prisma, businessId)
  return result
}
