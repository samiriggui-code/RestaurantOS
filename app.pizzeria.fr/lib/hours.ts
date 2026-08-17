import { PIZZERIA } from './pizzeria-content'

export type OpenStatus = {
  isOpen: boolean
  label: string
  sublabel: string
}

export function getOpenStatus(now = new Date()): OpenStatus {
  const hour = now.getHours()
  const minute = now.getMinutes()
  const current = hour + minute / 60
  const { open, close } = PIZZERIA.hours

  if (current >= open && current < close) {
    return {
      isOpen: true,
      label: 'Ouvert — commandez maintenant',
      sublabel: `Aujourd'hui jusqu'à ${close}h00`,
    }
  }

  if (current < open) {
    return {
      isOpen: false,
      label: 'Fermé',
      sublabel: `Réouverture à ${open}h00`,
    }
  }

  return {
    isOpen: false,
    label: 'Fermé',
    sublabel: `Réouverture demain à ${open}h00`,
  }
}
