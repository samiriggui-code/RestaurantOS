#!/usr/bin/env tsx
/**
 * Labo : remet à zéro commandes / tickets / factures, conserve les clôtures Z journalières.
 * Reconstruit un journal JET minimal + chaîne cohérente.
 *
 * Usage : FISCAL_LAB_RESET=true npm run fiscal:lab-reset --prefix server [businessId]
 */
import dotenv from 'dotenv'
import path from 'path'
import { PrismaClient } from '@prisma/client'
import { parseBusinessSettings } from '../src/lib/business-settings'
import { logFiscalEvent } from '../src/lib/fiscal/events'
import { repairFiscalEventChain } from '../src/lib/fiscal/repair-jet-chain'
import { verifyFiscalChains } from '../src/lib/fiscal/verify-chain'

dotenv.config({ path: path.join(__dirname, '..', '.env') })

const IMMUTABLE_TRIGGERS = [
  ['FiscalTicket', 'fiscal_ticket_immutable'],
  ['FiscalEvent', 'fiscal_event_immutable'],
  ['FiscalClosure', 'fiscal_closure_immutable'],
] as const

async function setImmutableTriggers(prisma: PrismaClient, enable: boolean) {
  const verb = enable ? 'ENABLE' : 'DISABLE'
  for (const [table, trigger] of IMMUTABLE_TRIGGERS) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "${table}" ${verb} TRIGGER ${trigger}`)
  }
}

async function main() {
  if (process.env.FISCAL_LAB_RESET !== 'true') {
    console.error('Refusé — définir FISCAL_LAB_RESET=true (labo uniquement).')
    process.exit(1)
  }

  const prisma = new PrismaClient()
  const singleId = process.argv[2]
  const businesses = singleId
    ? [{ id: singleId }]
    : await prisma.business.findMany({
        where: { id: { not: '' } },
        select: { id: true },
      })

  try {
    let allOk = true
    for (const biz of businesses) {
      const result = await resetBusiness(prisma, biz.id)
      console.log(JSON.stringify({ businessId: biz.id, ...result }, null, 2))
      if (!result.verifyOk) allOk = false
    }
    process.exit(allOk ? 0 : 1)
  } finally {
    await prisma.$disconnect()
  }
}

async function resetBusiness(prisma: PrismaClient, businessId: string) {
  const dailyClosures = await prisma.fiscalClosure.findMany({
    where: { businessId, periodType: 'DAILY' },
    orderBy: { periodKey: 'asc' },
  })
  const keptDayKeys = dailyClosures.map((c) => c.periodKey)
  const activationDayKey = keptDayKeys[0] ?? null
  const grandTotal = dailyClosures.reduce((s, c) => s + Number(c.grandTotalCents), 0)

  await setImmutableTriggers(prisma, false)
  try {
    await prisma.printJob.deleteMany({ where: { businessId } })
    await prisma.guestCheckoutDraft.deleteMany({ where: { businessId } })
    await prisma.stockMovement.deleteMany({
      where: { orderId: { in: (await prisma.order.findMany({ where: { businessId }, select: { id: true } })).map((o) => o.id) } },
    })
    await prisma.orderItem.deleteMany({ where: { order: { businessId } } })
    await prisma.fiscalDayPreclose.deleteMany({ where: { businessId } })
    await prisma.fiscalTicket.deleteMany({ where: { businessId } })
    await prisma.fiscalEvent.deleteMany({ where: { businessId } })
    await prisma.invoiceLine.deleteMany({ where: { invoice: { businessId } } })
    await prisma.invoice.deleteMany({ where: { businessId } })
    await prisma.order.deleteMany({ where: { businessId } })
    await prisma.fiscalClosure.deleteMany({
      where: { businessId, periodType: { not: 'DAILY' } },
    })
  } finally {
    await setImmutableTriggers(prisma, true)
  }

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { settings: true },
  })
  const settings = parseBusinessSettings(business?.settings)

  await prisma.fiscalSequence.upsert({
    where: { businessId },
    create: {
      businessId,
      nextTicketNo: 1,
      grandTotalCents: BigInt(grandTotal),
      lastTicketHash: null,
      lastEventHash: null,
      lastClosureHash: null,
      softwareVersion: process.env.FISCAL_SOFTWARE_VERSION ?? '1.0.0',
      commissionedAt: activationDayKey
        ? new Date(`${activationDayKey}T12:00:00.000Z`)
        : new Date(),
    },
    update: {
      nextTicketNo: 1,
      grandTotalCents: BigInt(grandTotal),
      lastTicketHash: null,
      lastEventHash: null,
      lastClosureHash: null,
      ...(activationDayKey
        ? { commissionedAt: new Date(`${activationDayKey}T12:00:00.000Z`) }
        : {}),
    },
  })

  if (activationDayKey) {
    await prisma.business.update({
      where: { id: businessId },
      data: {
        settings: {
          ...settings,
          fiscalActivationDate: activationDayKey,
          fiscalTrainingMode: true,
        },
      },
    })
  }

  await logFiscalEvent(prisma, {
    businessId,
    eventType: 'SOFTWARE_START',
    payload: {
      softwareVersion: process.env.FISCAL_SOFTWARE_VERSION ?? '1.0.0',
      labReset: true,
      keptClosures: keptDayKeys,
    },
  })

  if (activationDayKey) {
    await logFiscalEvent(prisma, {
      businessId,
      eventType: 'FISCAL_ACTIVATION',
      payload: { activationDayKey, source: 'lab-reset' },
    })
  }

  for (const c of dailyClosures) {
    await logFiscalEvent(prisma, {
      businessId,
      eventType: 'CLOSURE_DAILY',
      entityType: 'FiscalClosure',
      entityId: c.id,
      payload: { periodKey: c.periodKey, ticketCount: c.ticketCount, labReset: true },
    })
  }

  const repair = await repairFiscalEventChain(prisma, businessId)
  const verify = await verifyFiscalChains(prisma, businessId)

  return {
    keptDailyClosures: keptDayKeys.length,
    keptDayKeys,
    activationDayKey,
    verifyOk: verify.ok,
    repair,
    message: verify.ok
      ? `Reset labo OK — ${keptDayKeys.length} clôture(s) Z conservée(s).`
      : `Reset partiel — ${verify.message}`,
  }
}

void main()
