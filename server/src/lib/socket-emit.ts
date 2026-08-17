import type { Server as SocketIOServer } from 'socket.io'

/** Émet vers la room business + log dev du nombre de clients connectés. */
export async function emitToBusinessRoom(
  io: SocketIOServer,
  businessId: string,
  event: string,
  payload: unknown,
) {
  const room = `business:${businessId}`
  io.to(room).emit(event, payload)
  if (process.env.NODE_ENV !== 'production') {
    try {
      const sockets = await io.in(room).fetchSockets()
      console.log(`[socket] ${event} → ${room} (${sockets.length} client(s))`)
    } catch {
      console.log(`[socket] ${event} → ${room}`)
    }
  }
}
