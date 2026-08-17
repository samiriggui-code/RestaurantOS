import type { PrismaClient } from '@prisma/client'
import { displayName } from './locale'
import {
  buildInvoiceLinesFromOrder,
  invoiceTotalsFromOrder,
  computeLineTotals,
} from './invoice-vat'

type OrderWithItems = {
  id: string
  businessId: string
  orderNumber: number
  customerName: string | null
  customerEmail: string | null
  customerPhone: string | null
  isOnlineOrder: boolean
  paymentStatus: string
  status: string
  type: string
  subtotal: number
  tax: number
  serviceCharge: number
  discount: number
  total: number
  deliveryAddress: string | null
  deliveryPostalCode: string | null
  deliveryCity: string | null
  items: Array<{
    quantity: number
    price: number
    menuItem: { name: string; nameAr?: string | null; vatRateBps?: number | null }
  }>
}

export { computeLineTotals } from './invoice-vat'

export function clientAddressFromOrder(order: Pick<OrderWithItems, 'type' | 'deliveryAddress' | 'deliveryPostalCode' | 'deliveryCity'>) {
  if (order.type !== 'DELIVERY') return null
  const parts = [order.deliveryAddress, order.deliveryPostalCode, order.deliveryCity].filter(Boolean)
  return parts.length ? parts.join(', ') : null
}

export function defaultClientName(order: Pick<OrderWithItems, 'customerName' | 'orderNumber'>) {
  return order.customerName?.trim() || `Commande n° ${order.orderNumber}`
}

export function invoiceStatusForOrder(order: Pick<OrderWithItems, 'customerName' | 'customerEmail' | 'isOnlineOrder'>) {
  const name = order.customerName?.trim()
  if (!name) return 'DRAFT' as const
  if (order.isOnlineOrder && !order.customerEmail?.trim()) return 'DRAFT' as const
  return 'ISSUED' as const
}

export function orderLinesToInvoiceLines(order: OrderWithItems, taxRate: number) {
  return buildInvoiceLinesFromOrder(order, taxRate, (item) => displayName(item))
}

async function nextInvoiceNumber(prisma: PrismaClient, businessId: string) {
  const last = await prisma.invoice.findFirst({
    where: { businessId },
    orderBy: { invoiceNumber: 'desc' },
    select: { invoiceNumber: true },
  })
  return (last?.invoiceNumber ?? 0) + 1
}

export type CreateInvoiceFromOrderOptions = {
  createdById?: string
  status?: 'DRAFT' | 'ISSUED'
  type?: string
}

export async function createInvoiceFromOrder(
  prisma: PrismaClient,
  businessId: string,
  orderId: string,
  options: CreateInvoiceFromOrderOptions = {}
) {
  const existing = await prisma.invoice.findFirst({
    where: { businessId, orderId },
    include: { lines: { orderBy: { sortOrder: 'asc' } }, order: { select: { orderNumber: true } } },
  })
  if (existing) return { invoice: existing, created: false as const }

  const order = await prisma.order.findFirst({
    where: { id: orderId, businessId },
    include: { items: { include: { menuItem: true } } },
  })
  if (!order) return null
  if (order.paymentStatus !== 'PAID' || order.status === 'CANCELLED') return null

  const business = await prisma.business.findUnique({ where: { id: businessId } })
  const taxRate = business?.taxRate ?? 10
  const lines = orderLinesToInvoiceLines(order, taxRate)
  const totals = invoiceTotalsFromOrder(order, lines)
  const invoiceNumber = await nextInvoiceNumber(prisma, businessId)
  const status = options.status ?? invoiceStatusForOrder(order)

  const invoice = await prisma.invoice.create({
    data: {
      businessId,
      invoiceNumber,
      status,
      type: options.type ?? 'FROM_ORDER',
      orderId: order.id,
      clientName: defaultClientName(order),
      clientEmail: order.customerEmail?.trim() || null,
      clientPhone: order.customerPhone?.trim() || null,
      clientAddress: clientAddressFromOrder(order),
      subtotalCents: totals.subtotalCents,
      taxCents: totals.taxCents,
      totalCents: totals.totalCents,
      createdById: options.createdById ?? null,
      lines: { create: lines },
    },
    include: { lines: { orderBy: { sortOrder: 'asc' } }, order: { select: { orderNumber: true } } },
  })

  return { invoice, created: true as const }
}

export async function ensureInvoiceForPaidOrder(
  prisma: PrismaClient,
  businessId: string,
  orderId: string,
  createdById?: string
) {
  return createInvoiceFromOrder(prisma, businessId, orderId, { createdById, type: 'AUTO' })
}

export function invoiceMissingFields(invoice: {
  clientName: string
  clientEmail: string | null
  status: string
}) {
  const missing: string[] = []
  if (!invoice.clientName?.trim() || /^Commande n°/.test(invoice.clientName.trim())) {
    missing.push('nom client')
  }
  if (!invoice.clientEmail?.trim()) missing.push('email')
  return missing
}
