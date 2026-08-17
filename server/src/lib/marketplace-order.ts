import { randomUUID } from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import { Server as SocketIOServer } from 'socket.io'
import { getBusinessId } from './business'
import { generateDeliveryHandoverCode } from './delivery-handover'
import { geocodeDeliveryAddress } from './geocode'
import { enqueueConfirmedOrderPrints } from './enqueue-order-prints'
import { ensureSnapshotMenuItem } from './online-order'
import type { MarketplaceProvider } from './marketplace-integrations'
import { marketplaceChannel, touchMarketplaceIntegration, getMarketplaceIntegrationState } from './marketplace-integrations'
import { parseBusinessSettings } from './business-settings'

export type MarketplaceOrderLine = {
  name: string
  quantity: number
  unitCents: number
  notes?: string
}

export type MarketplaceOrderPayload = {
  event?: string
  externalId?: string
  order: {
    type: 'DELIVERY' | 'TAKEAWAY' | 'DINE_IN'
    customerName: string
    customerPhone?: string
    addressLine?: string
    postalCode?: string
    city?: string
    lines: MarketplaceOrderLine[]
    subtotalCents?: number
    deliveryFeeCents?: number
    totalCents: number
    notes?: string
    scheduledAt?: string
  }
}

function validatePayload(body: MarketplaceOrderPayload): string | null {
  if (!body?.order) return 'Payload commande manquant'
  const { order } = body
  if (!order.customerName?.trim()) return 'Nom client obligatoire'
  if (!order.lines?.length) return 'Lignes commande vides'
  if (!Number.isFinite(order.totalCents) || order.totalCents <= 0) return 'Total invalide'
  if (order.type === 'DELIVERY') {
    if (!order.addressLine?.trim() || !order.postalCode?.trim() || !order.city?.trim()) {
      return 'Adresse livraison incomplète'
    }
  }
  return null
}

export async function ingestMarketplaceOrder(
  prisma: PrismaClient,
  io: SocketIOServer | undefined,
  provider: MarketplaceProvider,
  body: MarketplaceOrderPayload,
) {
  const businessId = getBusinessId()
  const validationError = validatePayload(body)
  if (validationError) {
    await touchMarketplaceIntegration(prisma, businessId, provider, {
      lastError: validationError,
      lastWebhookAt: new Date().toISOString(),
    })
    return { error: validationError, status: 400 as const }
  }

  const event = body.event ?? 'order.new'
  if (event !== 'order.new' && event !== 'order.created') {
    await touchMarketplaceIntegration(prisma, businessId, provider, {
      lastWebhookAt: new Date().toISOString(),
    })
    return { ok: true, ignored: true, event }
  }

  if (body.externalId) {
    const existing = await prisma.order.findFirst({
      where: {
        businessId,
        notes: { contains: `ext:${body.externalId}` },
      },
      select: { id: true, orderNumber: true },
    })
    if (existing) {
      return { ok: true, duplicate: true, orderId: existing.id, orderNumber: existing.orderNumber }
    }
  }

  const snapshot = await ensureSnapshotMenuItem(prisma, businessId)
  const { order: input } = body
  const channel = marketplaceChannel(provider)

  let itemsSubtotalCents = 0
  const orderItemsData: Array<{
    menuItemId: string
    quantity: number
    price: number
    notes: string | null
    selectedModifiers: object
  }> = []

  for (const line of input.lines) {
    const priceCents = Math.round(line.unitCents)
    itemsSubtotalCents += priceCents * line.quantity
    orderItemsData.push({
      menuItemId: snapshot.id,
      quantity: line.quantity,
      price: priceCents,
      notes: line.notes?.trim() || line.name,
      selectedModifiers: { name: line.name, source: provider },
    })
  }

  const deliveryCents = input.type === 'DELIVERY' ? Math.round(input.deliveryFeeCents ?? 0) : 0
  const computedTotal = itemsSubtotalCents + deliveryCents
  if (Math.abs(computedTotal - Math.round(input.totalCents)) > 5) {
    const err = 'Total incohérent avec les lignes'
    await touchMarketplaceIntegration(prisma, businessId, provider, {
      lastError: err,
      lastWebhookAt: new Date().toISOString(),
    })
    return { error: err, status: 400 as const }
  }

  const orderNumber = parseInt(Date.now().toString().slice(-6), 10) + Math.floor(Math.random() * 100)
  const trackingToken = randomUUID().replace(/-/g, '').slice(0, 12)
  const orderType = input.type === 'DELIVERY' ? 'DELIVERY' : input.type === 'DINE_IN' ? 'DINE_IN' : 'TAKEAWAY'

  const noteParts = [
    input.notes?.trim(),
    body.externalId ? `ext:${body.externalId}` : null,
    `Canal: ${provider}`,
  ].filter(Boolean)

  const order = await prisma.order.create({
    data: {
      businessId,
      orderNumber,
      customerName: input.customerName.trim(),
      customerPhone: input.customerPhone?.trim() || null,
      type: orderType,
      status: 'CONFIRMED',
      paymentStatus: 'PAID',
      paymentMethod: 'THIRD_PARTY',
      isOnlineOrder: true,
      channel,
      trackingToken,
      subtotal: itemsSubtotalCents,
      tax: 0,
      serviceCharge: deliveryCents,
      total: computedTotal,
      notes: noteParts.join('\n') || null,
      deliveryAddress: orderType === 'DELIVERY' ? input.addressLine?.trim() : null,
      deliveryPostalCode: orderType === 'DELIVERY' ? input.postalCode?.trim() : null,
      deliveryCity: orderType === 'DELIVERY' ? input.city?.trim() : null,
      deliveryHandoverCode: orderType === 'DELIVERY' ? generateDeliveryHandoverCode() : null,
      scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
      items: { create: orderItemsData },
    },
    include: {
      items: { include: { menuItem: true } },
      table: true,
      cashier: { select: { id: true, name: true } },
      driver: { select: { id: true, name: true } },
    },
  })

  if (orderType === 'DELIVERY') {
    void geocodeDeliveryAddress(order.deliveryAddress, order.deliveryPostalCode, order.deliveryCity)
      .then((coords) => {
        if (coords) {
          return prisma.order.update({
            where: { id: order.id },
            data: { deliveryLat: coords.lat, deliveryLng: coords.lng },
          })
        }
      })
      .catch(() => {})
  }

  const now = new Date().toISOString()
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { settings: true },
  })
  const settings = parseBusinessSettings(business?.settings)
  const prevCount = getMarketplaceIntegrationState(settings, provider).orderCount ?? 0
  await touchMarketplaceIntegration(prisma, businessId, provider, {
    lastWebhookAt: now,
    lastOrderAt: now,
    enabled: true,
    orderCount: prevCount + 1,
  })

  if (io) {
    io.to(`business:${businessId}`).emit('order:new', order)
  }
  void enqueueConfirmedOrderPrints(prisma, io, businessId, order.id)

  return { ok: true, order, orderNumber: order.orderNumber }
}
