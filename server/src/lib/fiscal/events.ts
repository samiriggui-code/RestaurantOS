import type { Prisma, PrismaClient } from '@prisma/client'
import { fiscalGenesisHash } from './hash'
import { fiscalEventRecordHash } from './event-hash'

export type FiscalEventType =
  | 'TICKET_ISSUED'
  | 'TICKET_VOID'
  | 'CLOSURE_DAILY'
  | 'CLOSURE_MONTHLY'
  | 'CLOSURE_YEARLY'
  | 'REPRINT'
  | 'OFFLINE_INTEGRATED'
  | 'OFFLINE_SALE'
  | 'TRAINING_MODE_ON'
  | 'TRAINING_MODE_OFF'
  | 'PRICE_CHANGE'
  | 'OPERATOR_LOGIN'
  | 'OPERATOR_LOGOUT'
  | 'CLOCK_SKEW'
  | 'ARCHIVE_YEARLY'
  | 'SOFTWARE_START'
  | 'FISCAL_ACTIVATION'

type AppendEventInput = {
  businessId: string
  eventType: FiscalEventType | string
  operatorId?: string | null
  entityType?: string
  entityId?: string
  payload?: Prisma.InputJsonValue
}

/** Append JET event inside an open transaction (chain updated on FiscalSequence). */
export async function appendFiscalEvent(
  tx: Prisma.TransactionClient,
  input: AppendEventInput,
): Promise<void> {
  const seq = await tx.fiscalSequence.upsert({
    where: { businessId: input.businessId },
    create: { businessId: input.businessId },
    update: {},
  })

  const previousHash = seq.lastEventHash ?? fiscalGenesisHash()
  const at = new Date()
  const recordHash = fiscalEventRecordHash({
    eventType: input.eventType,
    operatorId: input.operatorId ?? null,
    entityType: input.entityType ?? null,
    entityId: input.entityId ?? null,
    payload: input.payload ?? null,
    at,
    previousHash,
  })

  await tx.fiscalEvent.create({
    data: {
      businessId: input.businessId,
      eventType: input.eventType,
      operatorId: input.operatorId ?? null,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      payload: input.payload ?? undefined,
      previousHash,
      recordHash,
      createdAt: at,
    },
  })

  await tx.fiscalSequence.update({
    where: { businessId: input.businessId },
    data: { lastEventHash: recordHash },
  })
}

export async function logFiscalEvent(
  prisma: PrismaClient,
  input: AppendEventInput,
): Promise<void> {
  await prisma.$transaction((tx) => appendFiscalEvent(tx, input))
}
