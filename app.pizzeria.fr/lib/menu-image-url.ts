import { apiUrl } from '@/lib/api'

/**
 * URL affichable pour une image produit menu.
 * - `/images/...` → assets Next.js (public/)
 * - `/uploads/...` ou upload admin → API Express
 */
export function resolveMenuItemImageUrl(image?: string | null): string | null {
  if (!image?.trim()) return null
  const value = image.trim()

  if (value.startsWith('http://') || value.startsWith('https://')) return value
  if (value.startsWith('/images/')) return value
  if (value.startsWith('/api/uploads/')) return apiUrl(value.replace(/^\/api/, ''))
  if (value.startsWith('/uploads/')) return apiUrl(value)

  return apiUrl(`/uploads/${value.replace(/^\/?uploads\//, '')}`)
}
