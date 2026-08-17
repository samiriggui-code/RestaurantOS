import type { Prisma, PrismaClient } from '@prisma/client'
import { deliveryIssueLabel } from './delivery-handover'

export type DeliveryHistoryPeriod = 'day' | 'week' | 'month' | 'year' | 'all'

export type DeliveryHistoryRow = {
  id: string
  orderNumber: number
  status: string
  customerName: string | null
  customerPhone: string | null
  deliveryAddress: string | null
  deliveryPostalCode: string | null
  deliveryCity: string | null
  total: number
  paymentStatus: string
  paymentMethod: string | null
  isOnlineOrder: boolean
  driverName: string | null
  completedAt: string | null
  createdAt: string
  issueReason: string | null
}

export function deliveryHistoryDateRange(period: DeliveryHistoryPeriod): { from?: Date; to?: Date } {
  if (period === 'all') return {}
  const now = new Date()
  const from = new Date(now)
  if (period === 'day') {
    from.setHours(0, 0, 0, 0)
  } else if (period === 'week') {
    from.setDate(from.getDate() - 7)
  } else if (period === 'month') {
    from.setMonth(from.getMonth() - 1)
  } else if (period === 'year') {
    from.setFullYear(from.getFullYear() - 1)
  }
  return { from, to: now }
}

export async function fetchDeliveryHistory(
  prisma: PrismaClient,
  businessId: string,
  options: {
    period?: DeliveryHistoryPeriod
    driverName?: string
    search?: string
    limit?: number
  } = {},
): Promise<{ rows: DeliveryHistoryRow[]; total: number; period: DeliveryHistoryPeriod }> {
  const period = options.period ?? 'month'
  const { from, to } = deliveryHistoryDateRange(period)
  const limit = Math.min(Math.max(options.limit ?? 500, 1), 1000)

  const where: Prisma.OrderWhereInput = {
    businessId,
    type: 'DELIVERY',
    status: { in: ['DELIVERED', 'DELIVERY_ISSUE', 'COMPLETED', 'CANCELLED', 'OUT_FOR_DELIVERY'] },
  }

  if (from || to) {
    where.updatedAt = {}
    if (from) where.updatedAt.gte = from
    if (to) where.updatedAt.lte = to
  }

  const orders = await prisma.order.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    take: limit,
    select: {
      id: true,
      orderNumber: true,
      status: true,
      customerName: true,
      customerPhone: true,
      deliveryAddress: true,
      deliveryPostalCode: true,
      deliveryCity: true,
      total: true,
      paymentStatus: true,
      paymentMethod: true,
      isOnlineOrder: true,
      deliveryIssueReason: true,
      createdAt: true,
      updatedAt: true,
      driver: { select: { name: true } },
    },
  })

  let rows: DeliveryHistoryRow[] = orders.map((o) => {
    const terminal = ['DELIVERED', 'DELIVERY_ISSUE', 'COMPLETED'].includes(o.status)
    return {
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      customerName: o.customerName,
      customerPhone: o.customerPhone,
      deliveryAddress: o.deliveryAddress,
      deliveryPostalCode: o.deliveryPostalCode,
      deliveryCity: o.deliveryCity,
      total: o.total,
      paymentStatus: o.paymentStatus,
      paymentMethod: o.paymentMethod,
      isOnlineOrder: o.isOnlineOrder,
      driverName: o.driver?.name ?? null,
      completedAt: terminal ? o.updatedAt.toISOString() : null,
      createdAt: o.createdAt.toISOString(),
      issueReason:
        o.status === 'DELIVERY_ISSUE' ? deliveryIssueLabel(o.deliveryIssueReason) : null,
    }
  })

  const search = options.search?.trim().toLowerCase()
  if (search) {
    rows = rows.filter((r) => {
      const blob = [
        String(r.orderNumber),
        r.customerName,
        r.customerPhone,
        r.deliveryAddress,
        r.deliveryCity,
        r.deliveryPostalCode,
        r.driverName,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return blob.includes(search)
    })
  }

  const driverFilter = options.driverName?.trim().toLowerCase()
  if (driverFilter) {
    rows = rows.filter((r) => r.driverName?.toLowerCase().includes(driverFilter))
  }

  return { rows, total: rows.length, period }
}
