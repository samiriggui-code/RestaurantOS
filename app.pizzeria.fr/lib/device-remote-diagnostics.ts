import { apiUrl } from '@/lib/api'
import { staffFetch } from '@/lib/staff-api'

export type RemoteDiagnosticCheck = 'printKitchen' | 'printReceipt'

export type RemoteDiagnosticResult = {
  ok: boolean
  source?: 'terminal' | 'epson-lan' | 'none'
  method?: string
  detail?: string
  message?: string
  error?: string
  offline?: boolean
}

export type DeviceOnlineStatus = {
  online: boolean
  connections: number
  lastSeenAt: string | null
}

export async function fetchDeviceOnlineStatus(
  token: string,
  deviceId: string,
): Promise<DeviceOnlineStatus> {
  return staffFetch<DeviceOnlineStatus>(`/devices/paired/${deviceId}/online`, { token })
}

export async function runRemoteDeviceDiagnostic(
  token: string,
  deviceId: string,
  check: RemoteDiagnosticCheck,
): Promise<RemoteDiagnosticResult> {
  try {
    const res = await fetch(apiUrl(`/devices/paired/${deviceId}/run-diagnostic`), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ check }),
    })
    const data = (await res.json().catch(() => ({}))) as RemoteDiagnosticResult & { error?: string }
    if (!res.ok) {
      return {
        ok: false,
        error: data.error ?? `Erreur ${res.status}`,
        offline: data.offline ?? res.status === 503,
        source: data.source,
        detail: data.detail,
        method: data.method,
        message: data.message,
      }
    }
    return data
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Échec du test distant'
    return { ok: false, error: message, source: 'none', offline: true }
  }
}
