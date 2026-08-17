import { apiUrl } from '@/lib/api'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const expressUrl = apiUrl(`/public/delivery/day-recap${url.search}`)
  const pin = request.headers.get('x-driver-pin')
  const upstream = await fetch(expressUrl, {
    method: 'GET',
    headers: pin ? { 'x-driver-pin': pin } : {},
  })
  const text = await upstream.text()
  return new Response(text, {
    status: upstream.status,
    headers: { 'Content-Type': upstream.headers.get('Content-Type') ?? 'application/json' },
  })
}
