import type { Prisma, PrismaClient } from '@prisma/client'
import { fiscalGenesisHash, fiscalHmac } from './hash'
import { appendFiscalEvent, logFiscalEvent } from './events'
import {
  aggregateTaxByRate,
  bpsFromBusinessTaxRate,
  fiscalLinesFromOrder,
  resolveOrderPriceMode,
  sumTaxByRate,
} from './vat'
import { parseBusinessSettings } from '../business-settings'

export type IssueFiscalTicketInput = {
  businessId: string
  orderId: string
  operatorId?: string | null
  paymentMethod?: string | null
  offlineRef?: string | null
  offlineSoldAt?: Date | null
}

export type IssueFiscalVoidInput = {
  businessId: string
  voidOfTicketId: string
  operatorId: string
  reason: string
}

function softwareVersion(): string {
  return process.env.FISCAL_SOFTWARE_VERSION ?? '1.0.0'
}

async function isTrainingMode(prisma: PrismaClient, businessId: string): Promise<boolean> {
  const biz = await prisma.business.findUnique({ where: { id: businessId }, select: { settings: true } })
  const settings = parseBusinessSettings(biz?.settings)
  return settings.fiscalTrainingMode === true
}

/** Idempotent : un ticket SALE par commande (hors TRAINING). */
export async function ensureFiscalTicketForPaidOrder(
  prisma: PrismaClient,
  input: IssueFiscalTicketInput,
): Promise<{ ticketId: string; serialNumber: number; created: boolean } | null> {
  const existing = await prisma.fiscalTicket.findFirst({
    where: {
      businessId: input.businessId,
      orderId: input.orderId,
      kind: { in: ['SALE', 'TRAINING'] },
    },
  })
  if (existing) {
    return { ticketId: existing.id, serialNumber: existing.serialNumber, created: false }
  }

  const order = await prisma.order.findFirst({
    where: { id: input.orderId, businessId: input.businessId, paymentStatus: 'PAID' },
    include: { items: { include: { menuItem: true } } },
  })
  if (!order) return null

  const training = await isTrainingMode(prisma, input.businessId)
  const ticket = await issueFiscalTicket(prisma, {
    ...input,
    kind: training ? 'TRAINING' : 'SALE',
    order,
  })
  return { ticketId: ticket.id, serialNumber: ticket.serialNumber, created: true }
}

type OrderWithItems = Prisma.OrderGetPayload<{
  include: { items: { include: { menuItem: true } } }
}>

export async function issueFiscalTicket(
  prisma: PrismaClient,
  input: IssueFiscalTicketInput & { kind?: string; order: OrderWithItems },
) {
  const business = await prisma.business.findUniqueOrThrow({ where: { id: input.businessId } })
  const defaultVatBps = bpsFromBusinessTaxRate(business.taxRate)
  const priceMode = resolveOrderPriceMode(input.order)
  const lines = fiscalLinesFromOrder(input.order, defaultVatBps)
  const taxByRate = aggregateTaxByRate(lines, priceMode)

  // Caisse HT : recaler sur Order.tax si écart minime
  if (priceMode === 'HT' && input.order.tax > 0) {
    const computed = sumTaxByRate(taxByRate)
    if (Math.abs(computed - input.order.tax) > 2 && Object.keys(taxByRate).length === 1) {
      const key = Object.keys(taxByRate)[0]
      taxByRate[key] = input.order.tax
    }
  }

  const kind = input.kind ?? 'SALE'
  const issuedAt = new Date()
  const payload = {
    orderNumber: input.order.orderNumber,
    type: input.order.type,
    lines,
    subtotalCents: input.order.subtotal,
    serviceChargeCents: input.order.serviceCharge,
    discountCents: input.order.discount,
    totalCents: input.order.total,
    customerName: input.order.customerName,
    isOnlineOrder: input.order.isOnlineOrder,
    priceMode,
  } satisfies Record<string, unknown>

  return prisma.$transaction(async (tx) => {
    const seq = await tx.fiscalSequence.upsert({
      where: { businessId: input.businessId },
      create: {
        businessId: input.businessId,
        softwareVersion: softwareVersion(),
      },
      update: {},
    })

    const serialNumber = seq.nextTicketNo
    const previousHash = seq.lastTicketHash ?? fiscalGenesisHash()

    const hashBody = JSON.stringify({
      serialNumber,
      kind,
      issuedAt: issuedAt.toISOString(),
      orderId: input.orderId,
      subtotalCents: input.order.subtotal,
      taxByRate,
      totalCents: input.order.total,
      paymentMethod: input.paymentMethod ?? input.order.paymentMethod,
      operatorId: input.operatorId ?? input.order.cashierId,
      offlineRef: input.offlineRef ?? null,
      previousHash,
    })
    const recordHash = fiscalHmac(hashBody)

    const ticket = await tx.fiscalTicket.create({
      data: {
        businessId: input.businessId,
        serialNumber,
        orderId: input.orderId,
        kind,
        issuedAt,
        offlineSoldAt: input.offlineSoldAt ?? null,
        offlineRef: input.offlineRef ?? null,
        operatorId: input.operatorId ?? input.order.cashierId,
        paymentMethod: input.paymentMethod ?? input.order.paymentMethod,
        subtotalCents: input.order.subtotal,
        taxByRate,
        discountCents: input.order.discount,
        totalCents: input.order.total,
        payload: payload as Prisma.InputJsonValue,
        previousHash,
        recordHash,
      },
    })

    const grandDelta = BigInt(kind === 'VOID' ? -input.order.total : input.order.total)
    await tx.fiscalSequence.update({
      where: { businessId: input.businessId },
      data: {
        nextTicketNo: serialNumber + 1,
        lastTicketHash: recordHash,
        grandTotalCents: seq.grandTotalCents + grandDelta,
        softwareVersion: softwareVersion(),
      },
    })

    await appendFiscalEvent(tx, {
      businessId: input.businessId,
      eventType: input.offlineRef ? 'OFFLINE_INTEGRATED' : 'TICKET_ISSUED',
      operatorId: input.operatorId ?? input.order.cashierId,
      entityType: 'FiscalTicket',
      entityId: ticket.id,
      payload: {
        serialNumber,
        orderId: input.orderId,
        kind,
        totalCents: input.order.total,
        offlineRef: input.offlineRef ?? undefined,
      },
    })

    return ticket
  })
}

export async function issueFiscalVoid(prisma: PrismaClient, input: IssueFiscalVoidInput) {
  const original = await prisma.fiscalTicket.findFirst({
    where: { id: input.voidOfTicketId, businessId: input.businessId, kind: 'SALE' },
  })
  if (!original) {
    throw new Error('Ticket fiscal original introuvable')
  }

  const existingVoid = await prisma.fiscalTicket.findFirst({
    where: { businessId: input.businessId, voidOfId: original.id },
  })
  if (existingVoid) {
    return existingVoid
  }

  const issuedAt = new Date()
  const totalCents = -original.totalCents
  const subtotalCents = -original.subtotalCents
  const taxByRate = Object.fromEntries(
    Object.entries(original.taxByRate as Record<string, number>).map(([k, v]) => [k, -v]),
  )

  return prisma.$transaction(async (tx) => {
    const seq = await tx.fiscalSequence.findUniqueOrThrow({ where: { businessId: input.businessId } })
    const serialNumber = seq.nextTicketNo
    const previousHash = seq.lastTicketHash ?? fiscalGenesisHash()

    const hashBody = JSON.stringify({
      serialNumber,
      kind: 'VOID',
      issuedAt: issuedAt.toISOString(),
      voidOfId: original.id,
      voidReason: input.reason,
      totalCents,
      previousHash,
    })
    const recordHash = fiscalHmac(hashBody)

    const ticket = await tx.fiscalTicket.create({
      data: {
        businessId: input.businessId,
        serialNumber,
        orderId: original.orderId,
        kind: 'VOID',
        issuedAt,
        operatorId: input.operatorId,
        paymentMethod: original.paymentMethod,
        subtotalCents,
        taxByRate,
        discountCents: -original.discountCents,
        totalCents,
        payload: {
          voidOfSerial: original.serialNumber,
          voidReason: input.reason,
          originalPayload: original.payload,
        },
        previousHash,
        recordHash,
        voidOfId: original.id,
        voidReason: input.reason,
      },
    })

    await tx.fiscalSequence.update({
      where: { businessId: input.businessId },
      data: {
        nextTicketNo: serialNumber + 1,
        lastTicketHash: recordHash,
        grandTotalCents: seq.grandTotalCents + BigInt(totalCents),
      },
    })

    await appendFiscalEvent(tx, {
      businessId: input.businessId,
      eventType: 'TICKET_VOID',
      operatorId: input.operatorId,
      entityType: 'FiscalTicket',
      entityId: ticket.id,
      payload: { voidOfSerial: original.serialNumber, reason: input.reason },
    })

    return ticket
  })
}

/** Réimpression : incrémente compteur + JET (ticket immuable — pas de UPDATE sur FiscalTicket). */
export async function recordFiscalReprint(
  prisma: PrismaClient,
  businessId: string,
  orderId: string,
  operatorId?: string | null,
): Promise<number> {
  const ticket = await prisma.fiscalTicket.findFirst({
    where: { businessId, orderId, kind: { in: ['SALE', 'TRAINING'] } },
    orderBy: { serialNumber: 'desc' },
  })
  if (!ticket) return 0

  // reprintCount sur ticket : nécessiterait UPDATE interdit — stocker dans JET + table annexe
  // Pour ISCA : compteur via événements REPRINT
  const count = await prisma.fiscalEvent.count({
    where: { businessId, eventType: 'REPRINT', entityId: ticket.id },
  })
  const next = count + 1

  await logFiscalEvent(prisma, {
    businessId,
    eventType: 'REPRINT',
    operatorId,
    entityType: 'FiscalTicket',
    entityId: ticket.id,
    payload: { serialNumber: ticket.serialNumber, reprintNumber: next, duplicata: true },
  })

  return next
}
