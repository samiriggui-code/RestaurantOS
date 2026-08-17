/** Logo La Z Pizza — aligné sur app.pizzeria.fr/public/brand/ */

/** Fond charbon — emails / fonds clairs */
const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 80" fill="none" role="img" aria-label="La Z Pizza"><title>La Z Pizza</title><rect width="280" height="80" rx="10" fill="#1A1614"/><text x="140" y="40" text-anchor="middle" font-family="'Playfair Display', Georgia, 'Times New Roman', serif" font-weight="700" font-size="28" fill="#F5F0E6"><tspan>La </tspan><tspan fill="#E85D3F" font-size="36" dy="-2">Z</tspan><tspan fill="#F5F0E6" font-size="28" dy="2"> Pizza</tspan></text><text x="140" y="62" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="500" font-size="10" fill="#8C867E" letter-spacing="4">FARGUES • 33370</text></svg>`

/** Fond transparent — en-têtes PDF / factures (bandeau terracotta) */
const LOGO_TRANSPARENT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 80" fill="none" role="img" aria-label="La Z Pizza"><title>La Z Pizza</title><text x="140" y="40" text-anchor="middle" font-family="'Playfair Display', Georgia, 'Times New Roman', serif" font-weight="700" font-size="28" fill="#F5F0E6"><tspan>La </tspan><tspan fill="#E85D3F" font-size="36" dy="-2">Z</tspan><tspan fill="#F5F0E6" font-size="28" dy="2"> Pizza</tspan></text><text x="140" y="62" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="500" font-size="10" fill="#D4C4B8" letter-spacing="4">FARGUES • 33370</text></svg>`

function svgDataUri(svg: string): string {
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
}

export const BRAND_LOGO_DATA_URI = svgDataUri(LOGO_SVG)
export const BRAND_LOGO_TRANSPARENT_DATA_URI = svgDataUri(LOGO_TRANSPARENT_SVG)

/** Logo par défaut sur bandeau coloré (factures, emails, rapports PDF). */
export const BRAND_LOGO_ON_PRIMARY_URI = BRAND_LOGO_TRANSPARENT_DATA_URI

export function resolveBrandLogoUrl(customLogo: string | null | undefined, siteUrl: string): string {
  if (customLogo?.trim()) {
    if (/^https?:\/\//i.test(customLogo)) return customLogo
    const base = siteUrl.replace(/\/$/, '')
    return customLogo.startsWith('/') ? `${base}${customLogo}` : `${base}/${customLogo}`
  }
  return `${siteUrl.replace(/\/$/, '')}/brand/logo-transparent.svg`
}
