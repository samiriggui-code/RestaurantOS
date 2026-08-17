/** PIN employé — caisse et cuisine (4 chiffres, standard restauration). */
export const STAFF_PIN_LENGTH = 4

export const STAFF_PIN_PATTERN = /^\d{4}$/

export function isValidStaffPin(pin: string): boolean {
  return STAFF_PIN_PATTERN.test(pin.trim())
}
