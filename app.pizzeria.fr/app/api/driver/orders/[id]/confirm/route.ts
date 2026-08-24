import { proxyToExpress } from '@/lib/express-proxy'

type Props = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: Props) {
  const { id } = await params
  return proxyToExpress(request, `/driver/orders/${encodeURIComponent(id)}/confirm`)
}
