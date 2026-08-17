/** Clés Stripe — une seule source pour Express (create-intent, webhook). */

function cleanEnv(value: string): string {
  let v = (value ?? '').trim()
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1).trim()
  }
  return v
}

export function stripeSecretKey(): string {
  return cleanEnv(process.env.STRIPE_SECRET_KEY ?? '')
}

export function stripePublishableKey(): string {
  return cleanEnv(
    process.env.STRIPE_PUBLISHABLE_KEY ??
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ??
      ''
  )
}

export function stripeWebhookSecret(): string {
  return cleanEnv(process.env.STRIPE_WEBHOOK_SECRET ?? '')
}

export function getStripeMode(): 'test' | 'live' | 'unset' {
  const key = stripeSecretKey()
  if (!key) return 'unset'
  if (key.startsWith('sk_live_')) return 'live'
  return 'test'
}
