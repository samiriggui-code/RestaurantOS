import { proxyToExpress } from '@/lib/express-proxy'

type Props = { params: Promise<{ token: string }> }

export async function GET(_request: Request, { params }: Props) {
  const { token } = await params
  return proxyToExpress(_request, `/public/orders/track-token/${encodeURIComponent(token)}`)
}
