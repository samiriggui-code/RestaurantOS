import { PrismaClient } from '@prisma/client'
import {
  getBusinessHours,
  getOpenStatus,
  isExceptionallyClosed,
  parseBusinessSettings,
  type BusinessSettingsJson,
} from './business-settings'
import {
  isOrderTestSlotsEnabled,
  ORDER_TEST_LAST_HOUR,
  ORDER_TEST_LAST_MINUTE,
} from './order-test-mode'

export const ASAP_SLOT = 'Dès que possible'
/** Dernières commandes acceptées 15 min avant la fermeture affichée. */
export const ORDER_CUTOFF_BEFORE_CLOSE_MINUTES = 15
const SLOT_INTERVAL_MS = 15 * 60 * 1000

export type TimeSlotsResult = {
  /** Peut passer commande en ligne (créneaux disponibles). */
  isOpen: boolean
  closedReason?: string
  openStatus: ReturnType<typeof getOpenStatus>
  slots: string[]
  capacity: number
}

function formatSlotLabel(d: Date): string {
  return d.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function alignToNextSlot(d: Date): Date {
  const aligned = new Date(d)
  aligned.setMinutes(Math.ceil(aligned.getMinutes() / 15) * 15, 0, 0)
  aligned.setSeconds(0, 0)
  return aligned
}

function lastOrderMoment(closeHour: number, now = new Date()): Date {
  if (isOrderTestSlotsEnabled()) {
    const last = new Date(now)
    last.setHours(ORDER_TEST_LAST_HOUR, ORDER_TEST_LAST_MINUTE, 0, 0)
    return last
  }
  const last = new Date(now)
  last.setHours(closeHour, 0, 0, 0)
  last.setMinutes(last.getMinutes() - ORDER_CUTOFF_BEFORE_CLOSE_MINUTES, 0, 0)
  return last
}

function openMoment(openHour: number, now = new Date()): Date {
  const open = new Date(now)
  open.setHours(openHour, 0, 0, 0)
  open.setSeconds(0, 0)
  return open
}

/** Convertit un libellé créneau en Date (aujourd'hui). ASAP → null. */
export function parseTimeSlotToDate(label: string | undefined, now = new Date()): Date | null {
  if (!label?.trim() || label === ASAP_SLOT) return null
  const match = label.match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return null
  const d = new Date(now)
  d.setHours(parseInt(match[1], 10), parseInt(match[2], 10), 0, 0)
  return d
}

async function getSlotCapacity(
  prisma: PrismaClient,
  businessId: string,
  settings: BusinessSettingsJson,
  dayOfWeek: number
): Promise<number> {
  const row = await prisma.timeSlot.findFirst({
    where: { businessId, dayOfWeek, isActive: true },
  })
  if (row) return row.capacity
  return settings.slotCapacity ?? 10
}

async function countOrdersBySlotStarts(
  prisma: PrismaClient,
  businessId: string,
  slotStarts: Date[],
): Promise<Map<number, number>> {
  const counts = new Map<number, number>()
  for (const slotStart of slotStarts) {
    counts.set(slotStart.getTime(), 0)
  }
  if (slotStarts.length === 0) return counts

  const rangeStart = slotStarts[0]
  const rangeEnd = new Date(
    slotStarts[slotStarts.length - 1].getTime() + SLOT_INTERVAL_MS,
  )

  const orders = await prisma.order.findMany({
    where: {
      businessId,
      isOnlineOrder: true,
      status: { notIn: ['CANCELLED'] },
      scheduledAt: { gte: rangeStart, lt: rangeEnd },
    },
    select: { scheduledAt: true },
  })

  for (const order of orders) {
    const scheduledAt = order.scheduledAt
    if (!scheduledAt) continue
    const t = scheduledAt.getTime()
    for (const slotStart of slotStarts) {
      const startMs = slotStart.getTime()
      if (t >= startMs && t < startMs + SLOT_INTERVAL_MS) {
        counts.set(startMs, (counts.get(startMs) ?? 0) + 1)
        break
      }
    }
  }

  return counts
}

export async function computeAvailableTimeSlots(
  prisma: PrismaClient,
  businessId: string,
  now = new Date()
): Promise<TimeSlotsResult> {
  const business = await prisma.business.findUnique({ where: { id: businessId } })
  const settings = parseBusinessSettings(business?.settings)
  const openStatus = getOpenStatus(settings, now)
  const hours = getBusinessHours(settings)
  const capacity = await getSlotCapacity(prisma, businessId, settings, now.getDay())

  const closure = isExceptionallyClosed(settings, now)
  if (closure) {
    return {
      isOpen: false,
      closedReason: closure.reason ?? 'Fermeture exceptionnelle',
      openStatus,
      slots: [],
      capacity,
    }
  }

  const openToday = openMoment(hours.open, now)
  const lastOrder = lastOrderMoment(hours.close, now)

  if (now > lastOrder) {
    return {
      isOpen: false,
      closedReason: isOrderTestSlotsEnabled()
        ? `Commandes closes (mode test — dernier créneau ${formatSlotLabel(lastOrder)})`
        : `Commandes closes (dernier créneau ${formatSlotLabel(lastOrder)})`,
      openStatus,
      slots: [],
      capacity,
    }
  }

  const slots: string[] = []
  const serviceStarted = now >= openToday
  if (serviceStarted && now <= lastOrder) {
    slots.push(ASAP_SLOT)
  }

  let cursor = serviceStarted ? alignToNextSlot(now) : new Date(openToday)
  if (cursor < openToday) cursor = new Date(openToday)

  const candidateSlots: Date[] = []
  while (cursor <= lastOrder) {
    candidateSlots.push(new Date(cursor))
    cursor = new Date(cursor.getTime() + SLOT_INTERVAL_MS)
  }

  const bookedBySlot = await countOrdersBySlotStarts(prisma, businessId, candidateSlots)
  for (const slotStart of candidateSlots) {
    const booked = bookedBySlot.get(slotStart.getTime()) ?? 0
    if (booked < capacity) slots.push(formatSlotLabel(slotStart))
  }

  const uniqueSlots = [...new Set(slots)]

  return {
    isOpen: uniqueSlots.length > 0,
    closedReason:
      uniqueSlots.length === 0
        ? `Aucun créneau disponible avant ${formatSlotLabel(lastOrder)}`
        : undefined,
    openStatus,
    slots: uniqueSlots,
    capacity,
  }
}

export async function validateTimeSlot(
  prisma: PrismaClient,
  businessId: string,
  timeSlot: string | undefined,
  now = new Date()
): Promise<string | null> {
  const result = await computeAvailableTimeSlots(prisma, businessId, now)
  if (!result.isOpen) return result.closedReason ?? 'Commandes indisponibles'
  if (!timeSlot?.trim()) return 'Créneau horaire obligatoire'
  if (!result.slots.includes(timeSlot)) return 'Créneau indisponible ou complet'
  return null
}
