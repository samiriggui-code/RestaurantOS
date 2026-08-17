import { proxyToExpress } from '@/lib/express-proxy'

export async function POST(request: Request) {
  return proxyToExpress(request, '/public/payments/complete')
}
