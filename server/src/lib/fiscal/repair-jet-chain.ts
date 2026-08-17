import type { PrismaClient } from '@prisma/client'
import { fiscalGenesisHash, fiscalHmac } from './hash'
import { fiscalEventRecordHash } from './event-hash'
import { fiscalClosureHashBody } from './closure-hash'
import { verifyFiscalChains } from './verify-chain'

export type JetRepairResult = {
  repaired: number
  closuresRepaired: number
  verifyOk: boolean
  message: string
}

function jetRepairAllowed(): boolean {
  return process.env.FISCAL_ALLOW_JET_REPAIR === 'true'
}

/**
 * Recalcule previousHash / recordHash JET à partir de createdAt (labo / migration).
 * Nécessite FISCAL_ALLOW_JET_REPAIR=true — désactive temporairement le trigger d'immutabilité.
 */
export async function repairFiscalEventChain(
  prisma: PrismaClient,
  businessId: string,
): Promise<JetRepairResult> {
  if (!jetRepairAllowed()) {
    return {
      repaired: 0,
      closuresRepaired: 0,
      verifyOk: false,
      message:
        'Réparation JET désactivée — définir FISCAL_ALLOW_JET_REPAIR=true (labo uniquement).',
    }
  }

  const events = await prisma.fiscalEvent.findMany({
    where: { businessId },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  })
  const closures = await prisma.fiscalClosure.findMany({
    where: { businessId },
    orderBy: [{ closedAt: 'asc' }, { id: 'asc' }],
  })

  if (events.length === 0 && closures.length === 0) {
    const verify = await verifyFiscalChains(prisma, businessId)
    return {
      repaired: 0,
      closuresRepaired: 0,
      verifyOk: verify.ok,
      message: verify.ok ? 'Aucun enregistrement fiscal — chaîne OK' : verify.message,
    }
  }

  let expectedEventPrev = fiscalGenesisHash()
  let expectedClosurePrev = fiscalGenesisHash()

  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`ALTER TABLE "FiscalEvent" DISABLE TRIGGER fiscal_event_immutable`)
    await tx.$executeRawUnsafe(`ALTER TABLE "FiscalClosure" DISABLE TRIGGER fiscal_closure_immutable`)

    try {
      for (const e of events) {
        const recordHash = fiscalEventRecordHash({
          eventType: e.eventType,
          operatorId: e.operatorId,
          entityType: e.entityType,
          entityId: e.entityId,
          payload: e.payload,
          at: e.createdAt,
          previousHash: expectedEventPrev,
        })

        await tx.fiscalEvent.update({
          where: { id: e.id },
          data: { previousHash: expectedEventPrev, recordHash },
        })

        expectedEventPrev = recordHash
      }

      for (const c of closures) {
        const body = fiscalClosureHashBody({
          periodType: c.periodType,
          periodKey: c.periodKey,
          totals: c.totals,
          grandTotalCents: c.grandTotalCents,
          ticketCount: c.ticketCount,
          closedAt: c.closedAt,
          previousHash: expectedClosurePrev,
        })
        const recordHash = fiscalHmac(body)

        await tx.fiscalClosure.update({
          where: { id: c.id },
          data: { previousHash: expectedClosurePrev, recordHash },
        })

        expectedClosurePrev = recordHash
      }

      await tx.fiscalSequence.upsert({
        where: { businessId },
        create: {
          businessId,
          lastEventHash: expectedEventPrev,
          lastClosureHash: expectedClosurePrev,
        },
        update: {
          lastEventHash: expectedEventPrev,
          lastClosureHash: expectedClosurePrev,
        },
      })
    } finally {
      await tx.$executeRawUnsafe(`ALTER TABLE "FiscalClosure" ENABLE TRIGGER fiscal_closure_immutable`)
      await tx.$executeRawUnsafe(`ALTER TABLE "FiscalEvent" ENABLE TRIGGER fiscal_event_immutable`)
    }
  })

  const verify = await verifyFiscalChains(prisma, businessId)
  return {
    repaired: events.length,
    closuresRepaired: closures.length,
    verifyOk: verify.ok,
    message: verify.ok
      ? `Chaînes réparées (${events.length} JET, ${closures.length} clôtures) — intégrité OK`
      : `Réparation partielle — ${verify.message}`,
  }
}
