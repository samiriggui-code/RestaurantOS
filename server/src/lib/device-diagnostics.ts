import { randomUUID } from 'crypto'

export type DeviceDiagnosticCheck = 'printKitchen' | 'printReceipt'

export type DeviceDiagnosticResult = {
  ok: boolean
  method?: string
  detail?: string
  error?: string
  offline?: boolean
}

type Pending = {
  resolve: (r: DeviceDiagnosticResult) => void
  reject: (e: Error) => void
  timer: ReturnType<typeof setTimeout>
}

const pending = new Map<string, Pending>()

export function waitDeviceDiagnosticResult(
  requestId: string,
  timeoutMs = 15000,
): Promise<DeviceDiagnosticResult> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(requestId)
      reject(new Error('timeout'))
    }, timeoutMs)
    pending.set(requestId, { resolve, reject, timer })
  })
}

export function resolveDeviceDiagnosticResult(
  requestId: string,
  result: DeviceDiagnosticResult,
): boolean {
  const entry = pending.get(requestId)
  if (!entry) return false
  clearTimeout(entry.timer)
  pending.delete(requestId)
  entry.resolve(result)
  return true
}

export function createDiagnosticRequestId(): string {
  return randomUUID()
}
