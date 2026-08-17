import type { PrismaClient } from '@prisma/client'
import { geocodeDeliveryAddress } from './geocode'
import { haversineKm, optimizeRouteNearestNeighbor, type LatLng } from './route-optimize'

export const PIZZERIA_DEPOT: LatLng = { lat: 44.774046, lng: -0.487389 }

export type DeliveryStopDto = {
  id: string
  orderNumber: number
  status: string
  trackingToken: string | null
  customerName: string | null
  customerPhone: string | null
  deliveryAddress: string | null
  deliveryPostalCode: string | null
  deliveryCity: string | null
  deliveryLat: number | null
  deliveryLng: number | null
  deliveryRouteOrder: number | null
  scheduledAt: string | null
  total: number
  notes: string | null
  distanceKm: number | null
  /** Distance depuis l'arrêt précédent (ou position livreur) */
  legDistanceKm: number | null
  routePosition: number
  driverId: string | null
  driverName: string | null
}

async function ensureCoords(
  prisma: PrismaClient,
  order: {
    id: string
    deliveryAddress: string | null
    deliveryPostalCode: string | null
    deliveryCity: string | null
    deliveryLat: number | null
    deliveryLng: number | null
  },
): Promise<LatLng | null> {
  if (order.deliveryLat != null && order.deliveryLng != null) {
    return { lat: order.deliveryLat, lng: order.deliveryLng }
  }
  const coords = await geocodeDeliveryAddress(
    order.deliveryAddress,
    order.deliveryPostalCode,
    order.deliveryCity,
  )
  if (coords) {
    await prisma.order.update({
      where: { id: order.id },
      data: { deliveryLat: coords.lat, deliveryLng: coords.lng },
    })
  }
  return coords
}

export async function fetchActiveDeliveryStops(
  prisma: PrismaClient,
  businessId: string,
  origin: LatLng = PIZZERIA_DEPOT,
  driverUserId?: string | null,
): Promise<DeliveryStopDto[]> {
  const orders = await prisma.order.findMany({
    where: {
      businessId,
      type: 'DELIVERY',
      paymentStatus: 'PAID',
      status: { in: ['READY', 'OUT_FOR_DELIVERY'] },
      ...(driverUserId
        ? {
            OR: [{ driverId: null }, { driverId: driverUserId }],
          }
        : {}),
    },
    orderBy: [{ deliveryRouteOrder: 'asc' }, { scheduledAt: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      orderNumber: true,
      status: true,
      trackingToken: true,
      customerName: true,
      customerPhone: true,
      deliveryAddress: true,
      deliveryPostalCode: true,
      deliveryCity: true,
      deliveryLat: true,
      deliveryLng: true,
      deliveryRouteOrder: true,
      scheduledAt: true,
      total: true,
      notes: true,
      driverId: true,
      driver: { select: { id: true, name: true } },
    },
  })

  const withCoords: Array<(typeof orders)[0] & { coords: LatLng | null }> = []
  for (const o of orders) {
    const coords = await ensureCoords(prisma, o)
    withCoords.push({ ...o, coords })
  }

  const geocoded = withCoords.filter((o) => o.coords != null) as Array<
    (typeof orders)[0] & { coords: LatLng }
  >
  const noCoords = withCoords.filter((o) => o.coords == null)

  const optimized = optimizeRouteNearestNeighbor(
    origin,
    geocoded.map((o) => ({ id: o.id, lat: o.coords.lat, lng: o.coords.lng })),
  )

  const orderMap = new Map(withCoords.map((o) => [o.id, o]))
  const orderedIds = [...optimized.map((s) => s.id), ...noCoords.map((o) => o.id)]

  await Promise.all(
    orderedIds.map((id, idx) =>
      prisma.order.update({
        where: { id },
        data: { deliveryRouteOrder: idx + 1 },
      }),
    ),
  )

  return orderedIds.map((id, idx) => {
    const o = orderMap.get(id)!
    const coords = o.coords
    let legDistanceKm: number | null = null
    if (coords) {
      if (idx === 0) {
        legDistanceKm = haversineKm(origin, coords)
      } else {
        const prevId = orderedIds[idx - 1]
        const prev = orderMap.get(prevId)!
        if (prev.coords) {
          legDistanceKm = haversineKm(prev.coords, coords)
        }
      }
    }
    return {
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      trackingToken: o.trackingToken,
      customerName: o.customerName,
      customerPhone: o.customerPhone,
      deliveryAddress: o.deliveryAddress,
      deliveryPostalCode: o.deliveryPostalCode,
      deliveryCity: o.deliveryCity,
      deliveryLat: coords?.lat ?? null,
      deliveryLng: coords?.lng ?? null,
      deliveryRouteOrder: idx + 1,
      scheduledAt: o.scheduledAt?.toISOString() ?? null,
      total: o.total,
      notes: o.notes,
      distanceKm: legDistanceKm,
      legDistanceKm,
      routePosition: idx + 1,
      driverId: o.driverId,
      driverName: o.driver?.name ?? null,
    }
  })
}

export function sumRouteKm(stops: DeliveryStopDto[]): number {
  return stops.reduce((s, stop) => s + (stop.legDistanceKm ?? 0), 0)
}
