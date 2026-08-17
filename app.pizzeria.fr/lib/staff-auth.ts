/**
 * Auth staff — double session (inspiré gsms-school, sans NextAuth).
 *
 * - **CRM** : email + mot de passe → `/admin` (ADMIN / MANAGER)
 * - **Appareil** : PIN → `/pos` / `/kitchen` (ne remplace plus la session CRM)
 *
 * Backend : Express JWT (`/api/auth/login`, `/api/auth/pin`, `/api/auth/refresh`).
 */

const LEGACY_TOKEN = 'token'
const LEGACY_REFRESH = 'refreshToken'
const LEGACY_USER = 'staffUser'

const CRM_TOKEN = 'crm_token'
const CRM_REFRESH = 'crm_refreshToken'
const CRM_USER = 'crm_staffUser'
const CRM_EMAIL = 'crm_remember_email'

const DEVICE_TOKEN = 'device_token'
const DEVICE_REFRESH = 'device_refreshToken'
const DEVICE_USER = 'device_staffUser'

const BUSINESS_KEY = 'businessId'

export type StaffUser = {
  id: string
  name: string
  email: string
  role: string
}

export type StaffSession = {
  token: string
  businessId: string
}

export type AuthScope = 'crm' | 'device' | 'auto'

let legacyMigrated = false

function migrateLegacySession() {
  if (legacyMigrated || typeof window === 'undefined') return
  legacyMigrated = true

  const legacyToken = localStorage.getItem(LEGACY_TOKEN)
  if (!legacyToken) return

  if (!localStorage.getItem(CRM_TOKEN)) {
    localStorage.setItem(CRM_TOKEN, legacyToken)
    const refresh = localStorage.getItem(LEGACY_REFRESH)
    const user = localStorage.getItem(LEGACY_USER)
    if (refresh) localStorage.setItem(CRM_REFRESH, refresh)
    if (user) localStorage.setItem(CRM_USER, user)
  }

  localStorage.removeItem(LEGACY_TOKEN)
  localStorage.removeItem(LEGACY_REFRESH)
  localStorage.removeItem(LEGACY_USER)
}

function keys(scope: 'crm' | 'device') {
  return scope === 'crm'
    ? { token: CRM_TOKEN, refresh: CRM_REFRESH, user: CRM_USER }
    : { token: DEVICE_TOKEN, refresh: DEVICE_REFRESH, user: DEVICE_USER }
}

export function resolveAuthScope(scope: AuthScope = 'auto'): 'crm' | 'device' {
  if (scope !== 'auto') return scope
  if (typeof window === 'undefined') return 'crm'
  const path = window.location.pathname
  if (path.startsWith('/pos') || path.startsWith('/kitchen')) return 'device'
  return 'crm'
}

function readUser(key: string): StaffUser | null {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem(key)
  if (!raw) return null
  try {
    return JSON.parse(raw) as StaffUser
  } catch {
    return null
  }
}

function saveSession(
  scope: 'crm' | 'device',
  data: {
    accessToken: string
    refreshToken?: string
    business?: { id: string } | null
    user?: StaffUser | null
  },
) {
  if (typeof window === 'undefined') return
  const k = keys(scope)
  localStorage.setItem(k.token, data.accessToken)
  if (data.refreshToken) localStorage.setItem(k.refresh, data.refreshToken)
  if (data.business?.id) localStorage.setItem(BUSINESS_KEY, data.business.id)
  if (data.user) localStorage.setItem(k.user, JSON.stringify(data.user))
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('staff-auth-changed'))
  }
}

function clearSession(scope: 'crm' | 'device') {
  if (typeof window === 'undefined') return
  const k = keys(scope)
  localStorage.removeItem(k.token)
  localStorage.removeItem(k.refresh)
  localStorage.removeItem(k.user)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('staff-auth-changed'))
  }
}

export function saveCrmSession(data: Parameters<typeof saveSession>[1]) {
  migrateLegacySession()
  saveSession('crm', data)
}

export function saveDeviceSession(data: Parameters<typeof saveSession>[1]) {
  migrateLegacySession()
  saveSession('device', data)
}

/** @deprecated Préférer saveCrmSession ou saveDeviceSession */
export function saveStaffSession(data: Parameters<typeof saveSession>[1]) {
  saveCrmSession(data)
}

export function getStaffUser(scope: AuthScope = 'auto'): StaffUser | null {
  if (typeof window === 'undefined') return null
  migrateLegacySession()
  const resolved = resolveAuthScope(scope)
  return readUser(keys(resolved).user)
}

export function getStaffSession(scope: AuthScope = 'auto'): StaffSession | null {
  if (typeof window === 'undefined') return null
  migrateLegacySession()
  const resolved = resolveAuthScope(scope)
  const k = keys(resolved)
  const token = localStorage.getItem(k.token)
  const businessId = localStorage.getItem(BUSINESS_KEY)
  if (!token || !businessId) return null
  return { token, businessId }
}

export function getCrmSession(): StaffSession | null {
  return getStaffSession('crm')
}

export function getDeviceSession(): StaffSession | null {
  return getStaffSession('device')
}

export function clearCrmSession() {
  clearSession('crm')
}

export function clearDeviceSession() {
  clearSession('device')
}

export function clearStaffSession() {
  clearCrmSession()
  clearDeviceSession()
  if (typeof window !== 'undefined') {
    void import('@/lib/socket').then(({ resetKitchenSocket }) => resetKitchenSocket())
  }
}

export function getRememberedCrmEmail(): string {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem(CRM_EMAIL) ?? ''
}

export function setRememberedCrmEmail(email: string, remember: boolean) {
  if (typeof window === 'undefined') return
  if (remember && email.trim()) {
    localStorage.setItem(CRM_EMAIL, email.trim().toLowerCase())
  } else {
    localStorage.removeItem(CRM_EMAIL)
  }
}

export async function refreshCrmAccessToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null
  migrateLegacySession()
  const refresh = localStorage.getItem(CRM_REFRESH)
  if (!refresh) return null

  const { apiUrl } = await import('@/lib/api')
  const res = await fetch(apiUrl('/auth/refresh'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: refresh }),
  })
  if (!res.ok) return null
  const data = (await res.json()) as {
    accessToken: string
    refreshToken?: string
    user?: StaffUser
  }
  saveCrmSession({
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    user: data.user,
    business: { id: localStorage.getItem(BUSINESS_KEY) ?? '' },
  })
  return data.accessToken
}

export async function refreshDeviceAccessToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null
  migrateLegacySession()
  const refresh = localStorage.getItem(DEVICE_REFRESH)
  if (!refresh) return null

  const { apiUrl } = await import('@/lib/api')
  const res = await fetch(apiUrl('/auth/refresh'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: refresh }),
  })
  if (!res.ok) return null
  const data = (await res.json()) as {
    accessToken: string
    refreshToken?: string
    user?: StaffUser
  }
  saveDeviceSession({
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    user: data.user,
    business: { id: localStorage.getItem(BUSINESS_KEY) ?? '' },
  })
  return data.accessToken
}

/** Décode l'exp JWT sans lib externe — retourne true si expiré ou proche de l'expiration. */
export function isAccessTokenExpiringSoon(token: string, bufferSeconds = 120): boolean {
  try {
    const part = token.split('.')[1]
    if (!part) return true
    const payload = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/'))) as { exp?: number }
    if (!payload.exp) return false
    return payload.exp * 1000 <= Date.now() + bufferSeconds * 1000
  } catch {
    return true
  }
}

export async function refreshAccessToken(scope: 'crm' | 'device'): Promise<string | null> {
  return scope === 'crm' ? refreshCrmAccessToken() : refreshDeviceAccessToken()
}

export async function ensureFreshAccessToken(scope: 'crm' | 'device' = 'crm'): Promise<string | null> {
  if (typeof window === 'undefined') return null
  migrateLegacySession()
  const session = getStaffSession(scope)
  if (!session) return null
  if (!isAccessTokenExpiringSoon(session.token)) return session.token
  return refreshAccessToken(scope)
}
