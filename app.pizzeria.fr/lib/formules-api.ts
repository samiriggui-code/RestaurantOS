export type FormuleConfig = {
  id: string
  name: string
  tagline: string
  savingsLabel: string
  priceEuros: number
  priceCents: number
  eligibleSlugs: string[]
  offerTag: string
  requiresPizza: boolean
}

export type MenuFormulesConfig = {
  duo: FormuleConfig
  dessert: FormuleConfig
}

type FormulesResponse = {
  success?: boolean
  formules?: MenuFormulesConfig
  error?: string
}

let cached: MenuFormulesConfig | null = null

export async function fetchMenuFormules(force = false): Promise<MenuFormulesConfig> {
  if (cached && !force) return cached

  const res = await fetch('/api/public/formules', { cache: 'no-store' })
  const data = (await res.json()) as FormulesResponse

  if (!res.ok || !data.success || !data.formules) {
    throw new Error(data.error ?? 'Formules menu indisponibles')
  }

  cached = data.formules
  return cached
}

export function clearFormulesCache() {
  cached = null
}
