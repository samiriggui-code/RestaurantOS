export type ArchivePeriod = 'today' | 'week' | 'month' | 'all'

export const ARCHIVE_PERIODS: { value: ArchivePeriod; label: string }[] = [
  { value: 'today', label: "Aujourd'hui" },
  { value: 'week', label: '7 jours' },
  { value: 'month', label: '30 jours' },
  { value: 'all', label: 'Tout' },
]

export function periodToDateRange(period: ArchivePeriod): { dateFrom?: string; dateTo?: string } {
  if (period === 'all') return {}
  const now = new Date()
  const from = new Date(now)
  if (period === 'today') {
    from.setHours(0, 0, 0, 0)
  } else if (period === 'week') {
    from.setDate(from.getDate() - 7)
  } else if (period === 'month') {
    from.setMonth(from.getMonth() - 1)
  }
  return { dateFrom: from.toISOString(), dateTo: now.toISOString() }
}
