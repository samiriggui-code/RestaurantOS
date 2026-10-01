export type ArchivePeriod = 'today' | 'week' | 'month' | 'custom' | 'all'

export const ARCHIVE_PERIODS: { value: ArchivePeriod; label: string }[] = [
  { value: 'today', label: "Aujourd'hui" },
  { value: 'week', label: '7 jours' },
  { value: 'month', label: '30 jours' },
  { value: 'all', label: 'Tout' },
]

/** Presets du sélecteur de période partagé (dashboard, rapports, caisse). */
export const DASHBOARD_PERIODS: { value: ArchivePeriod; label: string }[] = [
  { value: 'today', label: 'Jour' },
  { value: 'week', label: 'Semaine' },
  { value: 'month', label: 'Mois' },
  { value: 'custom', label: 'Personnalisé' },
]

export type CustomRange = { from: string; to: string }

export function periodToDateRange(
  period: ArchivePeriod,
  custom?: CustomRange
): { dateFrom?: string; dateTo?: string } {
  if (period === 'custom') {
    if (!custom) return {}
    return { dateFrom: custom.from, dateTo: custom.to }
  }
  if (period === 'all') return {}
  const now = new Date()
  const from = new Date(now)
  if (period === 'today') {
    from.setHours(0, 0, 0, 0)
  } else if (period === 'week') {
    // Aligné sur le début de journée : exactement 7 jours calendaires (aujourd'hui + 6
    // précédents), pas 7×24h glissantes depuis l'heure actuelle qui déborde sur un 8e jour.
    from.setDate(from.getDate() - 6)
    from.setHours(0, 0, 0, 0)
  } else if (period === 'month') {
    from.setDate(from.getDate() - 29)
    from.setHours(0, 0, 0, 0)
  }
  return { dateFrom: from.toISOString(), dateTo: now.toISOString() }
}
