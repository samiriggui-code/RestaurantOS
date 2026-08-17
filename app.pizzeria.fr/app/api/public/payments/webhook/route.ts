import { NextResponse } from 'next/server'
import { apiUrl } from '@/lib/api'

/**
 * Dev : proxy vers Express (signature Stripe = corps brut inchangé).
 * Prod : Stripe doit cibler Express directement ; ce proxy reste un filet de sécurité.
 */
export async function POST(request: Request) {
  const sig = request.headers.get('stripe-signature')
  const body = await request.arrayBuffer()

  const upstream = await fetch(apiUrl('/payments/webhook'), {
    method: 'POST',
    headers: {
      'Content-Type': request.headers.get('Content-Type') ?? 'application/json',
      ...(sig ? { 'stripe-signature': sig } : {}),
    },
    body,
  })

  const text = await upstream.text()
  return new NextResponse(text, {
    status: upstream.status,
    headers: { 'Content-Type': upstream.headers.get('Content-Type') ?? 'application/json' },
  })
}
