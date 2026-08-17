import { apiUrl } from '@/lib/api'
import { apiUnreachableMessage, fetchWithRetry } from '@/lib/api-fetch'

/** Proxy serveur Next → API Express (évite CORS, garde les URLs /api/public/* côté client). */
export async function proxyToExpress(
  request: Request,
  expressPath: string,
  extraHeaders?: Record<string, string>,
): Promise<Response> {
  const url = apiUrl(expressPath)
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...extraHeaders,
  }
  const pin = request.headers.get('x-driver-pin')
  const driverUserId = request.headers.get('x-driver-user-id')
  if (pin) headers['x-driver-pin'] = pin
  if (driverUserId) headers['x-driver-user-id'] = driverUserId

  const init: RequestInit = {
    method: request.method,
    headers,
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = await request.text()
  }

  let upstream: Response
  try {
    upstream = await fetchWithRetry(url, init)
  } catch {
    return Response.json({ success: false, error: apiUnreachableMessage() }, { status: 503 })
  }

  const text = await upstream.text()

  return new Response(text, {
    status: upstream.status,
    headers: { 'Content-Type': upstream.headers.get('Content-Type') ?? 'application/json' },
  })
}
