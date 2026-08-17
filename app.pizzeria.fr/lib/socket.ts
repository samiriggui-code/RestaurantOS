import { io, type Socket } from 'socket.io-client'
import { getSocketBase } from '@/lib/api-base'

let socket: Socket | null = null
let activeToken: string | undefined
let connectErrorLogged = false

function attachSocketDiagnostics(sock: Socket) {
  sock.off('connect_error', onConnectError)
  sock.on('connect_error', onConnectError)
}

function onConnectError(err: Error) {
  if (!connectErrorLogged) {
    console.warn('[socket] Connexion impossible :', err.message)
    connectErrorLogged = true
  }
}

/**
 * Socket ops partagé (POS, KDS, admin live, impressions).
 * Ne pas appeler `disconnect` depuis un composant — utiliser `releaseKitchenSocket` au démontage.
 * `resetKitchenSocket` uniquement à la déconnexion staff.
 */
export function getKitchenSocket(token?: string): Socket {
  if (!socket) {
    socket = io(getSocketBase(), {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: Infinity,
      withCredentials: true,
    })
    attachSocketDiagnostics(socket)
    activeToken = token
    return socket
  }

  if (token && token !== activeToken) {
    socket.auth = { token }
    activeToken = token
    if (socket.connected) socket.disconnect().connect()
  }

  return socket
}

let subscriberCount = 0

/** Référence le socket partagé (incrémente le compteur d'abonnés). */
export function retainKitchenSocket(): void {
  subscriberCount++
}

/** Libère une référence — ne coupe la connexion que si plus aucun abonné. */
export function releaseKitchenSocket(): void {
  subscriberCount = Math.max(0, subscriberCount - 1)
  if (subscriberCount === 0 && socket) {
    socket.disconnect()
    socket = null
    activeToken = undefined
  }
}

/** Déconnexion staff — force la fermeture du socket. */
export function resetKitchenSocket(): void {
  subscriberCount = 0
  socket?.disconnect()
  socket = null
  activeToken = undefined
}

export function joinBusinessRoom(sock: Socket, businessId: string) {
  const id = businessId?.trim()
  if (!id) return
  sock.emit('join:business', id)
}

export function joinDeviceRoom(sock: Socket, deviceId: string) {
  const id = deviceId?.trim()
  if (!id) return
  sock.emit('join:device', id)
}

export function getSocketDebugInfo(): { url: string; connected: boolean } {
  return {
    url: getSocketBase(),
    connected: Boolean(socket?.connected),
  }
}
