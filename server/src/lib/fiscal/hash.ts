import { createHmac } from 'crypto'

const GENESIS = 'GENESIS'

export function fiscalGenesisHash(): string {
  return GENESIS
}

export function fiscalHmac(payload: string, secret?: string): string {
  const key = secret ?? process.env.FISCAL_HMAC_SECRET ?? process.env.JWT_SECRET
  if (!key) {
    throw new Error('FISCAL_HMAC_SECRET or JWT_SECRET required for fiscal chain')
  }
  return createHmac('sha256', key).update(payload, 'utf8').digest('hex')
}

export function hashPreview(fullHash: string, length = 6): string {
  return fullHash.slice(0, length)
}
