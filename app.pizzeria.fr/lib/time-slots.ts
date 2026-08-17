import { PIZZERIA } from './pizzeria-content'
import { getOpenStatus } from './hours'
import {
  isOrderTestSlotsEnabled,
  ORDER_TEST_LAST_HOUR,
  ORDER_TEST_LAST_MINUTE,
} from './order-test-mode'

/** Valeur par défaut quand la commande peut partir tout de suite */
export const ASAP_SLOT = 'Dès que possible'

/** Dernières commandes acceptées 15 min avant la fermeture affichée. */
export const ORDER_CUTOFF_BEFORE_CLOSE_MINUTES = 15

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

/** Créneaux 15 min — commande possible avant ouverture, jusqu'à 15 min avant fermeture. */
export function getAvailableTimeSlots(now = new Date()): string[] {
  const { open, close } = PIZZERIA.hours
  const openToday = new Date(now)
  openToday.setHours(open, 0, 0, 0)
  openToday.setSeconds(0, 0)

  const lastOrder = lastOrderMoment(close, now)
  if (now > lastOrder) return []

  const slots: string[] = []
  const serviceStarted = now >= openToday
  if (serviceStarted && now <= lastOrder) {
    slots.push(ASAP_SLOT)
  }

  let cursor = serviceStarted ? alignToNextSlot(now) : new Date(openToday)

  while (cursor <= lastOrder) {
    const label = cursor.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
    slots.push(label)
    cursor = new Date(cursor.getTime() + 15 * 60 * 1000)
  }

  return [...new Set(slots)]
}

/** Statut affichage header (physique) — distinct de la possibilité de commander. */
export { getOpenStatus }
