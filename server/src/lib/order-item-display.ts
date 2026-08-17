const GENERIC_MENU_NAMES = new Set(['Ligne commande en ligne', 'Article', 'Commande en ligne (interne)'])

type LineSnapshot = {
  name?: string
  slug?: string
  categoryId?: string
  sizeLabel?: string
  offerTag?: string
}

export function orderItemDisplayName(item: {
  menuItem: { name?: string | null; nameAr?: string | null }
  selectedModifiers?: unknown
  notes?: string | null
}): string {
  const snap = item.selectedModifiers as LineSnapshot | null | undefined
  if (snap?.name?.trim()) return snap.name.trim()

  const dbName = item.menuItem.name?.trim() || item.menuItem.nameAr?.trim()
  if (dbName && !GENERIC_MENU_NAMES.has(dbName)) return dbName

  return 'Article'
}

export function orderItemModifierLines(item: {
  selectedModifiers?: unknown
  notes?: string | null
}): string[] {
  const lines: string[] = []
  const snap = item.selectedModifiers as LineSnapshot | null | undefined

  if (snap?.sizeLabel?.trim()) lines.push(snap.sizeLabel.trim())
  else if (item.notes) {
    const sizePart = item.notes.split(' · ').find((p) => p && !p.startsWith('Offre:'))
    if (sizePart) lines.push(sizePart)
  }

  if (snap?.offerTag?.trim()) {
    const tag = snap.offerTag.trim()
    if (tag === 'formule-duo') lines.push('Formule menu — boisson')
    else if (tag === 'formule-dessert' || tag === 'menu_dessert') lines.push('Formule menu — dessert')
    else lines.push(tag)
  } else if (item.notes?.includes('Offre:')) {
    const offer = item.notes.split(' · ').find((p) => p.startsWith('Offre:'))
    if (offer) lines.push(offer.replace(/^Offre:\s*/, ''))
  }

  return lines
}

