'use client'

import { useEffect } from 'react'
import { getBoundDeviceId } from '@/lib/device-binding'
import { getStaffSession } from '@/lib/staff-auth'
import { getKitchenSocket, joinBusinessRoom, joinDeviceRoom, releaseKitchenSocket, retainKitchenSocket } from '@/lib/socket'
import { runDeviceLocalDiagnostic, type DeviceLocalDiagnosticCheck } from '@/lib/device-local-diagnostics'

/**
 * Écoute les tests CRM envoyés au terminal jumelé (room socket device:*).
 */
export function useDeviceDiagnosticListener(enabled = true) {
  useEffect(() => {
    if (!enabled) return

    const session = getStaffSession('device')
    const deviceId = getBoundDeviceId()
    if (!session || !deviceId) return

    retainKitchenSocket()
    const socket = getKitchenSocket(session.token)

    const onConnect = () => {
      joinBusinessRoom(socket, session.businessId)
      joinDeviceRoom(socket, deviceId)
    }

    const onDiagnosticRequest = (payload: { requestId?: string; check?: DeviceLocalDiagnosticCheck }) => {
      if (!payload?.requestId || !payload.check) return
      void (async () => {
        const result = await runDeviceLocalDiagnostic(payload.check!)
        socket.emit('device:diagnosticResponse', {
          requestId: payload.requestId,
          ok: result.ok,
          method: result.method,
          detail: result.detail ?? result.message,
          error: result.ok ? undefined : (result.detail ?? result.message),
        })
      })()
    }

    socket.on('connect', onConnect)
    socket.on('device:diagnosticRequest', onDiagnosticRequest)
    if (socket.connected) onConnect()

    return () => {
      socket.off('connect', onConnect)
      socket.off('device:diagnosticRequest', onDiagnosticRequest)
      releaseKitchenSocket()
    }
  }, [enabled])
}
