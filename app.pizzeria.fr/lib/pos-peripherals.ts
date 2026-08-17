export type PosPeripheralSettings = {
  printerCounter: boolean
  printerKitchen: boolean
  printerDelivery: boolean
  tpeEnabled: boolean
  cashDrawer: boolean
  coinDispenser: boolean
  autoPrintKitchenOnPay: boolean
  /** Surcharge locale IP (vide = IP CRM boutique) */
  counterLanIpOverride?: string
  kitchenLanIpOverride?: string
  /** Provider TPE préféré (id capabilities APK) */
  preferredTpeProviderId?: string
}

export const DEFAULT_POS_PERIPHERALS: PosPeripheralSettings = {
  printerCounter: true,
  printerKitchen: true,
  printerDelivery: true,
  tpeEnabled: true,
  cashDrawer: true,
  coinDispenser: false,
  autoPrintKitchenOnPay: true,
}

const STORAGE_KEY = 'lz_pos_peripherals_v1'

export function loadPosPeripherals(): PosPeripheralSettings {
  if (typeof window === 'undefined') return DEFAULT_POS_PERIPHERALS
  try {
    return { ...DEFAULT_POS_PERIPHERALS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') }
  } catch {
    return DEFAULT_POS_PERIPHERALS
  }
}

export function savePosPeripherals(s: PosPeripheralSettings) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
}

export type PosPrintTicketType = 'KITCHEN' | 'BAG_LABEL' | 'RECEIPT'

/** Respecte les toggles périphériques POS (imprimantes caisse / cuisine / livraison). */
export function peripheralsAllowPrint(
  type: PosPrintTicketType,
  settings: PosPeripheralSettings = loadPosPeripherals(),
): boolean {
  if (type === 'KITCHEN') return settings.printerKitchen
  if (type === 'BAG_LABEL') return settings.printerDelivery || settings.printerKitchen
  return settings.printerCounter
}

export function shouldAutoPrintKitchenOnPay(
  settings: PosPeripheralSettings = loadPosPeripherals(),
): boolean {
  return settings.autoPrintKitchenOnPay && settings.printerKitchen
}

export function epsonTargetsFromPeripherals(settings: PosPeripheralSettings = loadPosPeripherals()) {
  return {
    kitchenEnabled: settings.printerKitchen,
    counterEnabled: settings.printerCounter || settings.printerDelivery,
  }
}
