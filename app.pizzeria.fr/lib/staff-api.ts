import { apiUrl } from '@/lib/api'
import { apiUnreachableMessage, fetchWithRetry } from '@/lib/api-fetch'
import {
  ensureFreshAccessToken,
  getStaffSession,
  refreshAccessToken,
  resolveAuthScope,
  type AuthScope,
} from '@/lib/staff-auth'

type StaffFetchInit = RequestInit & {
  token?: string
  scope?: AuthScope
  _retried?: boolean
  /** Surcharge du timeout par tentative (ms) — défaut 12s, trop long pour un simple check UI. */
  timeoutMs?: number
  /** Surcharge du nombre de tentatives — défaut 5, pensé pour le démarrage du serveur en dev. */
  retries?: number
}

async function parseErrorBody(res: Response): Promise<{ error?: string; code?: string }> {
  return res.json().catch(() => ({})) as Promise<{ error?: string; code?: string }>
}

async function staffRequest(
  path: string,
  init: StaffFetchInit,
): Promise<Response> {
  const { token: explicitToken, scope: scopeOpt, _retried, timeoutMs, retries, ...rest } = init
  const scope = resolveAuthScope(scopeOpt ?? 'auto')
  const token =
    explicitToken ??
    (typeof window !== 'undefined' ? (await ensureFreshAccessToken(scope)) ?? getStaffSession(scope)?.token : null)

  const headers = new Headers(rest.headers)
  if (!headers.has('Content-Type') && rest.body) {
    headers.set('Content-Type', 'application/json')
  }
  if (token) headers.set('Authorization', `Bearer ${token}`)

  let res: Response
  try {
    res = await fetchWithRetry(apiUrl(path), { ...rest, headers }, { timeoutMs, retries })
  } catch {
    throw new Error(apiUnreachableMessage())
  }

  if (res.status === 401 && !_retried && typeof window !== 'undefined' && !explicitToken) {
    const body = await parseErrorBody(res)
    if (body.code === 'TOKEN_EXPIRED' || body.error === 'Token expired') {
      const refreshed = await refreshAccessToken(scope)
      if (refreshed) {
        return staffRequest(path, { ...init, token: refreshed, _retried: true })
      }
    }
  }

  return res
}

export async function staffFetch<T>(path: string, init?: StaffFetchInit): Promise<T> {
  const res = await staffRequest(path, init ?? {})

  if (!res.ok) {
    const body = await parseErrorBody(res)
    throw new Error(body.error ?? `Erreur ${res.status}`)
  }

  return res.json() as Promise<T>
}

/** Réponse texte / HTML (impression facture, etc.) */
export async function staffFetchText(path: string, init?: StaffFetchInit): Promise<string> {
  const res = await staffRequest(path, init ?? {})

  if (!res.ok) {
    const body = await parseErrorBody(res)
    throw new Error(body.error ?? `Erreur ${res.status}`)
  }

  return res.text()
}

export async function staffUpload<T>(path: string, formData: FormData, token: string): Promise<T> {
  let res: Response
  try {
    res = await fetchWithRetry(apiUrl(path), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    })
  } catch {
    throw new Error(apiUnreachableMessage())
  }

  if (res.status === 401) {
    const body = await parseErrorBody(res)
    if (body.code === 'TOKEN_EXPIRED') {
      const refreshed = await refreshAccessToken('crm')
      if (refreshed) {
        return staffUpload(path, formData, refreshed)
      }
    }
  }

  if (!res.ok) {
    const body = await parseErrorBody(res)
    throw new Error(body.error ?? `Erreur ${res.status}`)
  }

  return res.json() as Promise<T>
}
