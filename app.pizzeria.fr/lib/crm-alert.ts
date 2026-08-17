import { playAlertSound } from '@/lib/ui-sounds'

/** Son court pour alerte nouvelle commande dans le CRM (navigateur). */
export function playCrmAlertSound() {
  playAlertSound()
}

export function requestCrmNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return
  if (Notification.permission === 'default') {
    void Notification.requestPermission()
  }
}

export function notifyCrmBrowser(title: string, body?: string) {
  if (typeof window === 'undefined' || !('Notification' in window)) return
  if (Notification.permission !== 'granted') return
  try {
    new Notification(title, { body, tag: 'crm-order' })
  } catch {
    /* ignore */
  }
}
