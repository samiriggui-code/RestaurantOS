import { cn } from '@/lib/cn'

/** Palette logo officielle (capture CRM / site sombre). */
const BRAND = {
  bg: '#1A1614',
  cream: '#F5F0E6',
  accent: '#E85D3F',
  muted: '#8C867E',
} as const

type BrandLogoProps = {
  className?: string
  /** Badge fond charbon #1A1614 — comme la capture officielle */
  withBackground?: boolean
  /** Centré (fichier logo-transparent.svg) vs aligné à gauche (barre nav) */
  centered?: boolean
}

/**
 * Logo La Z Pizza — SVG inline (Playfair + Z terracotta).
 * Fichiers statiques : /brand/logo.svg · /brand/logo-transparent.svg
 */
export function BrandLogo({ className, withBackground = false, centered = false }: BrandLogoProps) {
  const useCentered = withBackground || centered
  const viewBox = withBackground || centered ? '0 0 280 80' : '0 0 220 52'
  const titleX = useCentered ? 140 : 0
  const titleY = useCentered ? 40 : 27
  const titleAnchor = useCentered ? 'middle' : 'start'
  const subX = useCentered ? 140 : 0
  const subY = useCentered ? 62 : 45
  const subAnchor = useCentered ? 'middle' : 'start'

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={viewBox}
      fill="none"
      role="img"
      aria-label="La Z Pizza — Fargues 33370"
      className={cn('block h-11 w-auto shrink-0', className)}
    >
      <title>La Z Pizza</title>
      {withBackground && <rect width="280" height="80" rx="10" fill={BRAND.bg} />}
      <text
        x={titleX}
        y={titleY}
        textAnchor={titleAnchor}
        fontFamily="var(--font-display), Georgia, 'Times New Roman', serif"
        fontWeight="700"
        fontSize={useCentered ? 28 : 24}
        fill={BRAND.cream}
      >
        <tspan>La </tspan>
        <tspan fill={BRAND.accent} fontSize={useCentered ? 36 : 31} dy={useCentered ? -2 : -1}>
          Z
        </tspan>
        <tspan fill={BRAND.cream} fontSize={useCentered ? 28 : 24} dy={useCentered ? 2 : 1}>
          {' '}
          Pizza
        </tspan>
      </text>
      <text
        x={subX}
        y={subY}
        textAnchor={subAnchor}
        fontFamily="var(--font-sans), system-ui, sans-serif"
        fontWeight="500"
        fontSize={useCentered ? 10 : 9}
        fill={BRAND.muted}
        letterSpacing={useCentered ? 4 : 2.8}
      >
        FARGUES • 33370
      </text>
    </svg>
  )
}
