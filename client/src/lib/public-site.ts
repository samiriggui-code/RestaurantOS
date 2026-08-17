/** URL du site public Next.js (app.pizzeria.fr) */
export const PUBLIC_SITE_URL =
  import.meta.env.VITE_PUBLIC_SITE_URL?.replace(/\/$/, '') || 'http://localhost:3000'

export const PUBLIC_MENU_URL = `${PUBLIC_SITE_URL}/menu`
export const PUBLIC_ORDER_URL = `${PUBLIC_SITE_URL}/commander`
