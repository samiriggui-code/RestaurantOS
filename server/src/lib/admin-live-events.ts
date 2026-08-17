import { Server as SocketIOServer } from 'socket.io'

export type AdminLiveDomain = 'orders' | 'dashboard' | 'stock' | 'expenses' | 'reports' | 'all'

export type AdminLivePayload = {
  domain: AdminLiveDomain
  action?: string
  label?: string
  detail?: string
  at?: string
}

export function emitAdminLive(
  io: SocketIOServer | undefined,
  businessId: string,
  payload: AdminLivePayload
) {
  if (!io) return
  io.to(`business:${businessId}`).emit('admin:live', {
    ...payload,
    at: payload.at ?? new Date().toISOString(),
  })
}
