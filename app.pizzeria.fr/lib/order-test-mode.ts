/** Créneaux élargis pour tests locaux — désactiver avec NEXT_PUBLIC_ORDER_TEST_SLOTS=false */
export function isOrderTestSlotsEnabled(): boolean {
  if (process.env.NEXT_PUBLIC_ORDER_TEST_SLOTS === 'false') return false
  if (
    process.env.NEXT_PUBLIC_ORDER_TEST_SLOTS === 'true' ||
    process.env.NEXT_PUBLIC_ORDER_TEST_SLOTS === '1'
  ) {
    return true
  }
  return process.env.NODE_ENV === 'development'
}

export const ORDER_TEST_LAST_HOUR = 23
export const ORDER_TEST_LAST_MINUTE = 45
