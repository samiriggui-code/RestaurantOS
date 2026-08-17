/** URL publique site client (pizzeria.fr) — QR tables, WiFi invité. */
export function getPublicSiteUrl(): string {
  const fromEnv = process.env.PUBLIC_SITE_URL?.trim()
  if (fromEnv) return fromEnv.replace(/\/$/, '')
  const front = process.env.FRONTEND_URL?.split(',')[0]?.trim()
  if (front) return front.replace(/\/$/, '')
  return 'http://localhost:3000'
}
