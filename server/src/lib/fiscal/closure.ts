import type { Prisma, PrismaClient } from '@prisma/client'
import { fiscalGenesisHash, fiscalHmac } from './hash'
import { fiscalClosureHashBody } from './closure-hash'
import { appendFiscalEvent } from './events'
import { fiscalDayBoundsParis, fiscalDayKey, suggestFiscalCloseDayKey } from './timezone'
import {
  assertValidPrecloseForClosure,
  linkPrecloseToClosure,
} from './preclose-daily'
import {
  assertFiscalDayOnOrAfterActivation,
  getFiscalActivationDayKey,
} from './fiscal-config'

export type CloseFiscalDayOptions = {
  /** Journée civile Paris YYYY-MM-DD (prioritaire) */
  dayKey?: string
  /** Pré-clôture validée obligatoire en production */
  precloseId?: string
  /** Rétrocompat — converti en dayKey */
  forDate?: Date
  reconciliation?: unknown
  /** Clôture automatique nocturne (scheduler) — labo uniquement si FISCAL_AUTO_SKIP_PRECLOSE=true */
  skipPreclose?: boolean
}

/** Clôture journalière Z — agrège tickets SALE/VOID du jour (Europe/Paris). Irréversible. */
export async function closeFiscalDay(
  prisma: PrismaClient,
  businessId: string,
  closedById?: string | null,
  options: CloseFiscalDayOptions = {},
) {
  const periodKey =
    options.dayKey ??
    (options.forDate ? fiscalDayKey(options.forDate) : suggestFiscalCloseDayKey())

  if (!/^\d{4}-\d{2}-\d{2}$/.test(periodKey)) {
    throw new Error('dayKey invalide (attendu YYYY-MM-DD Europe/Paris)')
  }

  let precloseId: string | undefined
  let reconciliation: unknown = options.reconciliation

  if (options.precloseId) {
    const preclose = await assertValidPrecloseForClosure(
      prisma,
      businessId,
      periodKey,
      options.precloseId,
    )
    precloseId = preclose.id
    reconciliation = preclose.snapshot
  } else if (
    process.env.FISCAL_REQUIRE_PRECLOSE !== 'false' &&
    !options.skipPreclose
  ) {
    throw new Error(
      'Pré-clôture obligatoire — validez le rapprochement avant la clôture Z définitive.',
    )
  }

  const existing = await prisma.fiscalClosure.findUnique({
    where: {
      businessId_periodType_periodKey: {
        businessId,
        periodType: 'DAILY',
        periodKey,
      },
    },
  })
  if (existing) return existing

  const activationDayKey = await getFiscalActivationDayKey(prisma, businessId)
  assertFiscalDayOnOrAfterActivation(periodKey, activationDayKey)

  const { start, end } = fiscalDayBoundsParis(periodKey)

  const tickets = await prisma.fiscalTicket.findMany({
    where: {
      businessId,
      kind: { in: ['SALE', 'VOID'] },
      issuedAt: { gte: start, lte: end },
    },
  })

  const byPayment: Record<string, number> = {}
  const taxByRate: Record<string, number> = {}
  let dayTotal = 0

  for (const t of tickets) {
    const pm = t.paymentMethod ?? 'UNKNOWN'
    byPayment[pm] = (byPayment[pm] ?? 0) + t.totalCents
    dayTotal += t.totalCents
    const rates = t.taxByRate as Record<string, number>
    for (const [k, v] of Object.entries(rates)) {
      taxByRate[k] = (taxByRate[k] ?? 0) + v
    }
  }

  const seq = await prisma.fiscalSequence.findUnique({ where: { businessId } })
  const grandTotalCents = seq?.grandTotalCents ?? BigInt(0)

  const totals = {
    revenueCents: dayTotal,
    byPaymentMethod: byPayment,
    taxByRate,
    voidCount: tickets.filter((t) => t.kind === 'VOID').length,
    saleCount: tickets.filter((t) => t.kind === 'SALE').length,
    dayKey: periodKey,
    precloseId: precloseId ?? null,
  }

  return prisma.$transaction(async (tx) => {
    const seqRow = await tx.fiscalSequence.upsert({
      where: { businessId },
      create: { businessId },
      update: {},
    })
    const previousHash = seqRow.lastClosureHash ?? fiscalGenesisHash()
    const closedAt = new Date()

    const hashBody = fiscalClosureHashBody({
      periodType: 'DAILY',
      periodKey,
      totals,
      grandTotalCents,
      ticketCount: tickets.length,
      closedAt,
      previousHash,
    })
    const recordHash = fiscalHmac(hashBody)

    const closure = await tx.fiscalClosure.create({
      data: {
        businessId,
        periodType: 'DAILY',
        periodKey,
        totals,
        grandTotalCents,
        ticketCount: tickets.length,
        previousHash,
        recordHash,
        closedAt,
        closedById: closedById ?? null,
        reconciliation: reconciliation as Prisma.InputJsonValue | undefined,
      },
    })

    await tx.fiscalSequence.update({
      where: { businessId },
      data: { lastClosureHash: recordHash },
    })

    await appendFiscalEvent(tx, {
      businessId,
      eventType: 'CLOSURE_DAILY',
      operatorId: closedById,
      entityType: 'FiscalClosure',
      entityId: closure.id,
      payload: {
        periodKey,
        ticketCount: tickets.length,
        revenueCents: dayTotal,
        precloseId: precloseId ?? undefined,
      },
    })

    if (precloseId) {
      await linkPrecloseToClosure(tx, precloseId, closure.id)
    }

    return closure
  })
}
