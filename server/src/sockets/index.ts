import { Server as SocketIOServer, Socket } from 'socket.io'
import { PrismaClient } from '@prisma/client'
import jwt from 'jsonwebtoken'
import { parseBusinessSettings } from '../lib/business-settings'
import { getBusinessId } from '../lib/business'
import {
  getDevicesFromSettings,
  isDeviceRegistered,
  mergeDevicesSettings,
  touchPairedDevice,
} from '../lib/device-settings'
import { resolveDeviceDiagnosticResult } from '../lib/device-diagnostics'

const JWT_SECRET = process.env.JWT_SECRET

if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is not set for socket auth')
  process.exit(1)
}

interface AuthenticatedSocket extends Socket {
  userId?: string
  businessId?: string
  role?: string
}

export function setupSocketHandlers(io: SocketIOServer, prisma: PrismaClient) {
  // Authentication middleware for sockets
  io.use((socket: AuthenticatedSocket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token
    if (!token) {
      // Allow unauthenticated connections (for public viewing)
      return next()
    }

    try {
      const decoded = jwt.verify(token as string, JWT_SECRET!) as any
      socket.userId = decoded.userId
      socket.businessId = decoded.businessId
      socket.role = decoded.role
      next()
    } catch {
      next(new Error('Authentication failed'))
    }
  })

  io.on('connection', (socket: AuthenticatedSocket) => {
    console.log(`Socket connected: ${socket.id}`)

    // Join business room for real-time updates
    if (socket.businessId) {
      socket.join(`business:${socket.businessId}`)
    }

    // Allow joining specific rooms
    socket.on('join:business', (businessId: string) => {
      socket.join(`business:${businessId}`)
    })

    socket.on('join:table', (tableId: string) => {
      socket.join(`table:${tableId}`)
    })

    socket.on('join:track', (trackingToken: string) => {
      if (typeof trackingToken === 'string' && trackingToken.length >= 8 && trackingToken.length <= 32) {
        socket.join(`track:${trackingToken}`)
      }
    })

    socket.on('join:device', async (deviceId: string, ack?: (result: { ok: boolean }) => void) => {
      if (!socket.businessId || typeof deviceId !== 'string' || !deviceId.trim()) {
        ack?.({ ok: false })
        return
      }
      const normalizedId = deviceId.trim()
      try {
        const business = await prisma.business.findUnique({
          where: { id: getBusinessId() },
          select: { settings: true },
        })
        const devices = getDevicesFromSettings(parseBusinessSettings(business?.settings))
        if (!isDeviceRegistered(devices, normalizedId)) {
          ack?.({ ok: false })
          return
        }
        socket.join(`device:${normalizedId}`)
        const touched = touchPairedDevice(devices, normalizedId, {
          userAgent: socket.handshake.headers['user-agent'],
        })
        if (touched !== devices) {
          const merged = mergeDevicesSettings(parseBusinessSettings(business?.settings), touched)
          await prisma.business.update({
            where: { id: getBusinessId() },
            data: { settings: merged },
          })
        }
        ack?.({ ok: true })
      } catch (error) {
        console.error('join:device error:', error)
        ack?.({ ok: false })
      }
    })

    socket.on(
      'device:diagnosticResponse',
      (data: { requestId?: string; ok?: boolean; method?: string; detail?: string; error?: string }) => {
        if (!data?.requestId) return
        resolveDeviceDiagnosticResult(data.requestId, {
          ok: Boolean(data.ok),
          method: data.method,
          detail: data.detail,
          error: data.error,
        })
      },
    )

    // Kitchen: mark item as done
    socket.on('kitchen:itemDone', async (data: { orderId: string; itemId: string }) => {
      try {
        const item = await prisma.orderItem.update({
          where: { id: data.itemId },
          data: { status: 'READY' },
        })

        io.to(`business:${socket.businessId}`).emit('kitchen:itemUpdated', {
          orderId: data.orderId,
          itemId: data.itemId,
          status: 'READY',
        })
      } catch (error) {
        socket.emit('error', { message: 'Failed to update item' })
      }
    })

    // Kitchen: start preparing item
    socket.on('kitchen:startPrep', async (data: { orderId: string; itemId: string }) => {
      try {
        const item = await prisma.orderItem.update({
          where: { id: data.itemId },
          data: { status: 'PREPARING' },
        })

        io.to(`business:${socket.businessId}`).emit('kitchen:itemUpdated', {
          orderId: data.orderId,
          itemId: data.itemId,
          status: 'PREPARING',
        })
      } catch (error) {
        socket.emit('error', { message: 'Failed to update item' })
      }
    })

    // Waiter/Cashier: call for service
    socket.on('table:callService', (data: { tableId: string; message: string }) => {
      io.to(`business:${socket.businessId}`).emit('table:serviceCalled', {
        tableId: data.tableId,
        message: data.message,
        timestamp: new Date().toISOString(),
      })
    })

    // Typing indicators
    socket.on('order:typing', (data: { tableId: string; isTyping: boolean }) => {
      socket.to(`business:${socket.businessId}`).emit('order:customerTyping', {
        tableId: data.tableId,
        isTyping: data.isTyping,
      })
    })

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`)
    })
  })

  // Periodic cleanup of expired WiFi sessions
  setInterval(async () => {
    try {
      const now = new Date()
      await prisma.wifiSession.updateMany({
        where: { endTime: { lte: now }, status: 'ACTIVE' },
        data: { status: 'EXPIRED' },
      })
    } catch (error) {
      console.error('WiFi cleanup error:', error)
    }
  }, 60000) // Every minute
}
