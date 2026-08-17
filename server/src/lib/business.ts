export const DEFAULT_BUSINESS_ID = '00000000-0000-0000-0000-000000000001'

export function getBusinessId(): string {
  return process.env.BUSINESS_ID?.trim() || DEFAULT_BUSINESS_ID
}

export function resolveBusinessId(fromRequest?: string): string {
  if (process.env.BUSINESS_ID) return process.env.BUSINESS_ID
  return fromRequest?.trim() || DEFAULT_BUSINESS_ID
}
