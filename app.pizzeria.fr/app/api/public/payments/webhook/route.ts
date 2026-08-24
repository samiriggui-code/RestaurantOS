import { NextResponse } from 'next/server'
import { apiUrl } from '@/lib/api'

/**
 * Dev : proxy vers Express. Prod : SumUp cible Express directement via `return_url`
 * (le webhook n'est pas signé, ce proxy reste un filet de sécurité, pas la cible principale).
 */
export async function POST(request: Request) {
  const body = await request.arrayBuffer()

  const upstream = await fetch(apiUrl('/payments/sumup-checkout/webhook'), {
    method: 'POST',
    headers: {
      'Content-Type': request.headers.get('Content-Type') ?? 'application/json',
    },
    body,
  })

  const text = await upstream.text()
  return new NextResponse(text, {
    status: upstream.status,
    headers: { 'Content-Type': upstream.headers.get('Content-Type') ?? 'application/json' },
  })
}
