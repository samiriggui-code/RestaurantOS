import { proxyToExpress } from '@/lib/express-proxy'

export async function GET(
  request: Request,
  ctx: { params: Promise<{ checkoutId: string }> },
) {
  const { checkoutId } = await ctx.params
  return proxyToExpress(request, `/public/kiosk/sumup/checkout/${encodeURIComponent(checkoutId)}`)
}

export async function POST(
  request: Request,
  ctx: { params: Promise<{ checkoutId: string }> },
) {
  const { checkoutId } = await ctx.params
  return proxyToExpress(
    request,
    `/public/kiosk/sumup/checkout/${encodeURIComponent(checkoutId)}/cancel`,
  )
}
