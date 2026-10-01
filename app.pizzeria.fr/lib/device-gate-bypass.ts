const BYPASS_KEY = 'pizzeria_device_gate_bypass_until'

export function getDeviceGateBypassUntil(): number | null {
  if (typeof window === 'undefined') return null
  const raw = sessionStorage.getItem(BYPASS_KEY)
  if (!raw) return null
  const until = Number(raw)
  if (!Number.isFinite(until) || until <= Date.now()) {
    sessionStorage.removeItem(BYPASS_KEY)
    return null
  }
  return until
}

export function hasValidDeviceGateBypass(): boolean {
  return getDeviceGateBypassUntil() != null
}

export function saveDeviceGateBypass(expiresAtIso: string): void {
  if (typeof window === 'undefined') return
  const until = Date.parse(expiresAtIso)
  if (!Number.isFinite(until)) return
  sessionStorage.setItem(BYPASS_KEY, String(until))
}

export function clearDeviceGateBypass(): void {
  if (typeof window === 'undefined') return
  sessionStorage.removeItem(BYPASS_KEY)
}
