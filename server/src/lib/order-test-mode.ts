/** Créneaux élargis pour tests locaux — prod reste sur cutoff 21h45 (fermeture 22h). */
export function isOrderTestSlotsEnabled(): boolean {
  if (process.env.ORDER_TEST_SLOTS === 'false') return false
  if (process.env.ORDER_TEST_SLOTS === 'true' || process.env.ORDER_TEST_SLOTS === '1') {
    return true
  }
  return process.env.NODE_ENV === 'development'
}

/** Dernière prise de commande en mode test (23h45). */
export const ORDER_TEST_LAST_HOUR = 23
export const ORDER_TEST_LAST_MINUTE = 45
