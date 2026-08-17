import { io, type Socket } from 'socket.io-client'
import { getSocketBase } from '@/lib/api-base'

let trackSocket: Socket | null = null

export function getTrackSocket(): Socket {
  if (trackSocket?.connected) return trackSocket

  trackSocket = io(getSocketBase(), {
    autoConnect: true,
    transports: ['websocket', 'polling'],
  })

  return trackSocket
}

export function joinTrackRoom(socket: Socket, trackingToken: string) {
  socket.emit('join:track', trackingToken)
}

export function resetTrackSocket() {
  trackSocket?.disconnect()
  trackSocket = null
}
