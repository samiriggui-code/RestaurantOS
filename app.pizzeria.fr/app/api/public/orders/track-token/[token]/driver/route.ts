import { apiUrl } from '@/lib/api'

type Props = { params: Promise<{ token: string }> }

export async function GET(_request: Request, { params }: Props) {
  const { token } = await params
  const url = apiUrl(`/public/orders/track-token/${encodeURIComponent(token)}/driver`)
  const upstream = await fetch(url, { method: 'GET' })
  const text = await upstream.text()
  return new Response(text, {
    status: upstream.status,
    headers: { 'Content-Type': upstream.headers.get('Content-Type') ?? 'application/json' },
  })
}
