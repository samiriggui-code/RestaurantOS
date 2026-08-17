import type { PrismaClient } from '@prisma/client'
import { deliveryIssueLabel } from './delivery-handover'

export type DriverDayRecapItem = {
  id: string
  orderNumber: number
  status: 'DELIVERED' | 'DELIVERY_ISSUE'
  customerName: string | null
  deliveryCity: string | null
  total: number
  completedAt: string
  issueReason?: string | null
}

export type DriverDayRecap = {
  dateLabel: string
  deliveredCount: number
  issueCount: number
  totalRevenueCents: number
  items: DriverDayRecapItem[]
}

function parisDateKey(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' })
}

export async function fetchDriverDayRecap(
  prisma: PrismaClient,
  businessId: string,
): Promise<DriverDayRecap> {
  const todayKey = parisDateKey(new Date())
  const dateLabel = new Date().toLocaleDateString('fr-FR', {
    timeZone: 'Europe/Paris',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  const orders = await prisma.order.findMany({
    where: {
      businessId,
      type: 'DELIVERY',
      status: { in: ['DELIVERED', 'DELIVERY_ISSUE'] },
    },
    orderBy: { updatedAt: 'desc' },
    take: 80,
    select: {
      id: true,
      orderNumber: true,
      status: true,
      customerName: true,
      deliveryCity: true,
      total: true,
      updatedAt: true,
      deliveryIssueReason: true,
    },
  })

  const todayOrders = orders.filter((o) => parisDateKey(o.updatedAt) === todayKey)

  const delivered = todayOrders.filter((o) => o.status === 'DELIVERED')
  const issues = todayOrders.filter((o) => o.status === 'DELIVERY_ISSUE')

  const items: DriverDayRecapItem[] = todayOrders.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    status: o.status as 'DELIVERED' | 'DELIVERY_ISSUE',
    customerName: o.customerName,
    deliveryCity: o.deliveryCity,
    total: o.total,
    completedAt: o.updatedAt.toISOString(),
    issueReason:
      o.status === 'DELIVERY_ISSUE' ? deliveryIssueLabel(o.deliveryIssueReason) : undefined,
  }))

  return {
    dateLabel,
    deliveredCount: delivered.length,
    issueCount: issues.length,
    totalRevenueCents: delivered.reduce((s, o) => s + o.total, 0),
    items,
  }
}
