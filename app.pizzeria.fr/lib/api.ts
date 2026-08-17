import { getApiBase } from '@/lib/api-base'
import { apiUnreachableMessage, fetchWithRetry } from '@/lib/api-fetch'

function stripTrailingSlash(url: string): string {
  return url.replace(/\/$/, '')
}

export function apiUrl(path: string): string {
  const base = stripTrailingSlash(getApiBase())
  const normalized = path.startsWith('/') ? path : `/${path}`
  let apiPath = normalized.startsWith('/api') ? normalized : `/api${normalized}`
  // NEXT_PUBLIC_API_URL se termine souvent par /api — éviter /api/api/...
  if (base.endsWith('/api') && apiPath.startsWith('/api')) {
    apiPath = apiPath.slice(4) || '/'
  }
  return `${base}${apiPath}`
}
export async function apiFetch<T>(
  path: string,
  init?: RequestInit & { token?: string },
  retry?: { retries?: number; delayMs?: number; timeoutMs?: number }
): Promise<T> {
  const { token, ...rest } = init ?? {}
  const headers = new Headers(rest.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (!headers.has('Content-Type') && rest.body) {
    headers.set('Content-Type', 'application/json')
  }

  let res: Response
  try {
    res = await fetchWithRetry(apiUrl(path), { ...rest, headers }, retry)
  } catch (err) {
    if (err instanceof Error && err.message.includes('réseau')) throw err
    throw new Error(apiUnreachableMessage())
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `API ${res.status}`)
  }
  return res.json() as Promise<T>
}
