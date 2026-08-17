import { proxyToExpress } from '@/lib/express-proxy'

export async function GET(request: Request) {
  return proxyToExpress(request, '/public/delivery/drivers')
}
