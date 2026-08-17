import { getAvailableTimeSlots, ASAP_SLOT } from '@/lib/time-slots'

export { ASAP_SLOT }

export type TimeSlotsResponse = {
  isOpen: boolean
  closedReason?: string
  openStatus?: { label: string; sublabel: string }
  slots: string[]
  capacity?: number
}

/** Créneaux depuis PostgreSQL avec repli local. */
export async function fetchAvailableTimeSlots(): Promise<TimeSlotsResponse> {
  try {
    const res = await fetch('/api/public/time-slots', { cache: 'no-store' })
    const data = await res.json()
    if (res.ok && data.success !== false && Array.isArray(data.slots)) {
      return {
        isOpen: Boolean(data.isOpen),
        closedReason: data.closedReason,
        openStatus: data.openStatus,
        slots: data.slots as string[],
        capacity: data.capacity,
      }
    }
  } catch {
    /* repli local */
  }
  const local = getAvailableTimeSlots()
  return { isOpen: local.length > 0, slots: local }
}

export type HoursResponse = {
  isOpen: boolean
  label: string
  sublabel: string
  closedReason?: string
  hours: { open: number; close: number; daysOpen?: number }
  exceptionalClosures: Array<{ date: string; reason?: string }>
}

export async function fetchOpenHours(): Promise<HoursResponse | null> {
  try {
    const res = await fetch('/api/public/hours', { cache: 'no-store' })
    const data = await res.json()
    if (res.ok && data.success !== false) return data as HoursResponse
  } catch {
    return null
  }
  return null
}
