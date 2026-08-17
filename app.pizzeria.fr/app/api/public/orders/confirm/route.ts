import { NextResponse } from 'next/server'
import { apiUrl } from '@/lib/api'
import { proxyToExpress } from '@/lib/express-proxy'

/** Après paiement Stripe — délègue à complete (crée la commande si besoin). */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { token?: string; draftId?: string; paymentIntentId?: string }

    if (body.draftId?.trim()) {
      return proxyToExpress(
        new Request(request.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            draftId: body.draftId,
            paymentIntentId: body.paymentIntentId,
          }),
        }),
        '/public/payments/complete'
      )
    }

    const { token } = body
    if (!token?.trim()) {
      return NextResponse.json({ success: false, error: 'Token manquant' }, { status: 400 })
    }

    const res = await fetch(apiUrl(`/public/orders/track-token/${encodeURIComponent(token.trim())}`))
    if (res.status === 404) {
      return NextResponse.json({ success: false, error: 'Commande introuvable' }, { status: 404 })
    }

    const payload = await res.json()
    if (!res.ok) {
      return NextResponse.json(
        { success: false, error: payload.error ?? 'Erreur serveur' },
        { status: res.status }
      )
    }

    const order = payload.order ?? payload

    if (order.status === 'CONFIRMED' || order.paymentStatus === 'PAID') {
      return NextResponse.json({
        success: true,
        orderNumber: order.orderNumber,
        status: 'CONFIRMED',
      })
    }

    if (order.status === 'PENDING_PAYMENT') {
      const syncRes = await fetch(apiUrl('/public/payments/sync'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token.trim() }),
      })
      const syncData = await syncRes.json()
      if (syncRes.ok && syncData.success) {
        return NextResponse.json({
          success: true,
          orderNumber: syncData.orderNumber,
          token: syncData.token,
          status: 'CONFIRMED',
        })
      }
      return NextResponse.json(
        { success: false, error: syncData.error ?? 'Confirmation en cours — réessayez dans quelques secondes' },
        { status: syncRes.status === 402 ? 202 : syncRes.status }
      )
    }

    return NextResponse.json({ success: false, error: 'Commande non confirmée' }, { status: 400 })
  } catch {
    return NextResponse.json({ success: false, error: 'Erreur serveur' }, { status: 500 })
  }
}
