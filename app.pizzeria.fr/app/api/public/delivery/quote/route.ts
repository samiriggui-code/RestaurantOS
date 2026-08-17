import { proxyToExpress } from '@/lib/express-proxy'

export async function GET(request: Request) {
  const url = new URL(request.url)
  return proxyToExpress(request, `/public/delivery/quote${url.search}`)
}
