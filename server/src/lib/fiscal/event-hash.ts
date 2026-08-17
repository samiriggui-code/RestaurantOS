import { fiscalHmac } from './hash'

/** Corps canonique pour le HMAC d'un événement JET (append + vérification). */
export function fiscalEventHashBody(input: {
  eventType: string
  operatorId: string | null
  entityType: string | null
  entityId: string | null
  payload: unknown
  at: Date
  previousHash: string
}): string {
  return JSON.stringify({
    type: input.eventType,
    operatorId: input.operatorId,
    entityType: input.entityType,
    entityId: input.entityId,
    payload: input.payload ?? null,
    at: input.at.toISOString(),
    prev: input.previousHash,
  })
}

export function fiscalEventRecordHash(input: Parameters<typeof fiscalEventHashBody>[0]): string {
  return fiscalHmac(fiscalEventHashBody(input))
}
