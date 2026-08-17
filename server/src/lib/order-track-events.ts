import { Server as SocketIOServer } from 'socket.io'

type TrackableOrder = {
  trackingToken?: string | null
  orderNumber?: number
  status?: string
  paymentStatus?: string
  total?: number
  type?: string
  driverLat?: number | null
  driverLng?: number | null
  driverLocationAt?: Date | string | null
}

export function emitOrderTrackUpdate(io: SocketIOServer | undefined, order: TrackableOrder) {
  if (!io || !order.trackingToken) return
  io.to(`track:${order.trackingToken}`).emit('order:trackUpdate', {
    orderNumber: order.orderNumber,
    status: order.status,
    paymentStatus: order.paymentStatus,
    total: order.total,
    type: order.type,
    driverLat: order.driverLat,
    driverLng: order.driverLng,
    driverLocationAt: order.driverLocationAt,
  })
}
