import { loadPosPeripherals } from '@/lib/pos-peripherals'
import {
  testCounterPrinter,
  testKitchenPrinter,
  type PeripheralTestResult,
} from '@/lib/pos-peripheral-tests'

export type DeviceLocalDiagnosticCheck = 'printKitchen' | 'printReceipt'

export type DeviceLocalDiagnosticResult = PeripheralTestResult & {
  method?: string
}

export async function runDeviceLocalDiagnostic(
  check: DeviceLocalDiagnosticCheck,
): Promise<DeviceLocalDiagnosticResult> {
  const settings = loadPosPeripherals()
  if (check === 'printKitchen') {
    const r = await testKitchenPrinter(settings)
    return { ...r, method: r.detail }
  }
  const r = await testCounterPrinter(settings)
  return { ...r, method: r.detail }
}
