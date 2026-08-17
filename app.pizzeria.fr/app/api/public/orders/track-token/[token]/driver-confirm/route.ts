import { proxyToExpress } from '@/lib/express-proxy'

type Props = { params: Promise<{ token: string }> }

export async function POST(request: Request, { params }: Props) {
  const { token } = await params
  return proxyToExpress(request, `/public/orders/track-token/${encodeURIComponent(token)}/driver-confirm`)
}
