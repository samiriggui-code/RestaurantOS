/**
 * Pré-clôture journalière Z — contrôles avant figement définitif (art. 286 CGI / BOFiP).
 * Clôtures mensuelles et annuelles : cumuls obligatoires cumulatifs (grand total + total perpétuel).
 */

import type { Prisma, PrismaClient } from '@prisma/client'
import { verifyOrRepairFiscalChains } from './ensure-chain'
import {
  assertFiscalDayOnOrAfterActivation,
  getFiscalActivationDayKey,
} from './fiscal-config'
import {
  addParisDays,
  fiscalDayBoundsParis,
  fiscalDayKey,
  formatFiscalDayLabel,
  parisHour,
  suggestFiscalCloseDayKey,
} from './timezone'

export type PrecloseCheckSeverity = 'ok' | 'warning' | 'blocker'

export type PrecloseCheck = {
  id: string
  severity: PrecloseCheckSeverity
  label: string
  detail: string
  count?: number
  actionHint?: string
}

export type PrecloseOrderChannel =
  | 'COUNTER'
  | 'ONLINE'
  | 'DELIVERY_ONLINE'
  | 'THIRD_PARTY'

export type PrecloseOrderRow = {
  id: string
  orderNumber: number
  total: number
  status: string
  paymentStatus: string
  paymentMethod: string | null
  channel: PrecloseOrderChannel
  customerName: string | null
  createdAt: string
  hasFiscalTicket: boolean
  hasVoidTicket: boolean
}

export type PrecloseTicketRow = {
  id: string
  serialNumber: number
  kind: string
  totalCents: number
  paymentMethod: string | null
  orderId: string | null
  issuedAt: string
  voidOfId: string | null
}

export type DailyPreclosePreview = {
  dayKey: string
  dayLabel: string
  timezone: string
  parisNow: string
  parisHour: number
  suggestedDayKey: string
  /** Première journée de clôture Z autorisée (mise en service) */
  activationDayKey: string | null
  periodStart: string
  periodEnd: string
  alreadyClosed: boolean
  closureId?: string
  closedAt?: string
  canClose: boolean
  blockerCount: number
  warningCount: number
  checks: PrecloseCheck[]
  fiscal: {
    saleCount: number
    voidCount: number
    revenueCents: number
    byPaymentMethod: Record<string, number>
    taxByRate: Record<string, number>
    tickets: PrecloseTicketRow[]
  }
  orders: {
    byChannel: Record<PrecloseOrderChannel, { count: number; totalCents: number }>
    paidWithoutTicket: PrecloseOrderRow[]
    pendingPayment: PrecloseOrderRow[]
    openKitchen: PrecloseOrderRow[]
    cancelledPaid: PrecloseOrderRow[]
    thirdParty: PrecloseOrderRow[]
  }
  chainIntegrity: boolean
  grandTotalPerpetualCents: string
  periodicReminders: {
    monthlyDue: boolean
    monthlyKey?: string
    yearlyDue: boolean
    yearlyKey?: number
  }
}

const PRECLOSE_TTL_MS = 4 * 60 * 60 * 1000

const PAYMENT_LABEL: Record<string, string> = {
  CASH: 'Espèces',
  CARD: 'Carte',
  STRIPE: 'Stripe en ligne',
  TERMINAL: 'TPE',
  UNKNOWN: 'Non renseigné',
}

const CHANNEL_LABEL: Record<PrecloseOrderChannel, string> = {
  COUNTER: 'Comptoir / salle',
  ONLINE: 'Commande en ligne',
  DELIVERY_ONLINE: 'Livraison site',
  THIRD_PARTY: 'Plateforme tierce',
}

function isValidDayKey(dayKey: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(dayKey)
}

function detectOrderChannel(order: {
  isOnlineOrder: boolean
  type: string
  notes: string | null
}): PrecloseOrderChannel {
  const notes = (order.notes ?? '').toLowerCase()
  if (/uber\s*eats?|deliveroo|just\s*eat|glovo|frichti|platforme|plateforme/.test(notes)) {
    return 'THIRD_PARTY'
  }
  if (order.isOnlineOrder) {
    return order.type === 'DELIVERY' ? 'DELIVERY_ONLINE' : 'ONLINE'
  }
  return 'COUNTER'
}

function orderToRow(
  order: {
    id: string
    orderNumber: number
    total: number
    status: string
    paymentStatus: string
    paymentMethod: string | null
    isOnlineOrder: boolean
    type: string
    notes: string | null
    customerName: string | null
    createdAt: Date
    fiscalTickets: { kind: string }[]
  },
): PrecloseOrderRow {
  const saleTicket = order.fiscalTickets.some((t) => t.kind === 'SALE' || t.kind === 'TRAINING')
  const voidTicket = order.fiscalTickets.some((t) => t.kind === 'VOID')
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    total: order.total,
    status: order.status,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    channel: detectOrderChannel(order),
    customerName: order.customerName,
    createdAt: order.createdAt.toISOString(),
    hasFiscalTicket: saleTicket,
    hasVoidTicket: voidTicket,
  }
}

export async function listOpenFiscalDays(
  prisma: PrismaClient,
  businessId: string,
  lookbackDays = 14,
): Promise<
  Array<{
    dayKey: string
    dayLabel: string
    closed: boolean
    hasActivity: boolean
    revenueCents: number
    suggested: boolean
  }>
> {
  const suggested = suggestFiscalCloseDayKey()
  const today = fiscalDayKey()
  const activationDayKey = await getFiscalActivationDayKey(prisma, businessId)
  const days: string[] = []
  for (let i = 0; i < lookbackDays; i++) {
    const dk = addParisDays(today, -i)
    if (activationDayKey && dk < activationDayKey) continue
    days.push(dk)
  }

  const closures = await prisma.fiscalClosure.findMany({
    where: {
      businessId,
      periodType: 'DAILY',
      periodKey: { in: days },
    },
    select: { periodKey: true },
  })
  const closedSet = new Set(closures.map((c) => c.periodKey))

  const result = []
  for (const dayKey of days) {
    const { start, end } = fiscalDayBoundsParis(dayKey)
    const [ticketAgg, orderCount] = await Promise.all([
      prisma.fiscalTicket.aggregate({
        where: {
          businessId,
          kind: { in: ['SALE', 'VOID'] },
          issuedAt: { gte: start, lte: end },
        },
        _sum: { totalCents: true },
        _count: true,
      }),
      prisma.order.count({
        where: {
          businessId,
          createdAt: { gte: start, lte: end },
          status: { not: 'CANCELLED' },
          total: { gt: 0 },
        },
      }),
    ])
    const hasActivity = ticketAgg._count > 0 || orderCount > 0
    result.push({
      dayKey,
      dayLabel: formatFiscalDayLabel(dayKey),
      closed: closedSet.has(dayKey),
      hasActivity,
      revenueCents: ticketAgg._sum.totalCents ?? 0,
      suggested: dayKey === suggested,
    })
  }

  return result.filter((d) => d.hasActivity || d.suggested || !d.closed)
}

export async function buildDailyPreclosePreview(
  prisma: PrismaClient,
  businessId: string,
  dayKeyInput?: string,
): Promise<DailyPreclosePreview> {
  const now = new Date()
  const suggestedDayKey = suggestFiscalCloseDayKey(now)
  const dayKey = dayKeyInput && isValidDayKey(dayKeyInput) ? dayKeyInput : suggestedDayKey
  const activationDayKey = await getFiscalActivationDayKey(prisma, businessId)
  assertFiscalDayOnOrAfterActivation(dayKey, activationDayKey)
  const { start, end } = fiscalDayBoundsParis(dayKey)

  const [
    closure,
    tickets,
    orders,
    chain,
    seq,
    monthlyClosure,
    yearlyClosure,
  ] = await Promise.all([
    prisma.fiscalClosure.findUnique({
      where: {
        businessId_periodType_periodKey: {
          businessId,
          periodType: 'DAILY',
          periodKey: dayKey,
        },
      },
    }),
    prisma.fiscalTicket.findMany({
      where: {
        businessId,
        kind: { in: ['SALE', 'VOID'] },
        issuedAt: { gte: start, lte: end },
      },
      orderBy: { serialNumber: 'asc' },
    }),
    prisma.order.findMany({
      where: {
        businessId,
        createdAt: { gte: start, lte: end },
      },
      include: {
        fiscalTickets: { select: { kind: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),
    verifyOrRepairFiscalChains(prisma, businessId),
    prisma.fiscalSequence.findUnique({ where: { businessId } }),
    prisma.fiscalClosure.findFirst({
      where: {
        businessId,
        periodType: 'MONTHLY',
        periodKey: dayKey.slice(0, 7),
      },
    }),
    prisma.fiscalClosure.findFirst({
      where: {
        businessId,
        periodType: 'YEARLY',
        periodKey: dayKey.slice(0, 4),
      },
    }),
  ])

  const byPayment: Record<string, number> = {}
  const taxByRate: Record<string, number> = {}
  let revenueCents = 0
  for (const t of tickets) {
    const pm = t.paymentMethod ?? 'UNKNOWN'
    byPayment[pm] = (byPayment[pm] ?? 0) + t.totalCents
    revenueCents += t.totalCents
    const rates = t.taxByRate as Record<string, number>
    for (const [k, v] of Object.entries(rates)) {
      taxByRate[k] = (taxByRate[k] ?? 0) + v
    }
  }

  const byChannel: Record<PrecloseOrderChannel, { count: number; totalCents: number }> = {
    COUNTER: { count: 0, totalCents: 0 },
    ONLINE: { count: 0, totalCents: 0 },
    DELIVERY_ONLINE: { count: 0, totalCents: 0 },
    THIRD_PARTY: { count: 0, totalCents: 0 },
  }

  const paidWithoutTicket: PrecloseOrderRow[] = []
  const pendingPayment: PrecloseOrderRow[] = []
  const openKitchen: PrecloseOrderRow[] = []
  const cancelledPaid: PrecloseOrderRow[] = []
  const thirdParty: PrecloseOrderRow[] = []

  for (const order of orders) {
    const row = orderToRow(order)
    const ch = row.channel
    if (order.status !== 'CANCELLED' && order.total > 0) {
      byChannel[ch].count += 1
      byChannel[ch].totalCents += order.total
    }
    if (ch === 'THIRD_PARTY' && order.status !== 'CANCELLED') {
      thirdParty.push(row)
    }
    const isPaid =
      order.paymentStatus === 'PAID' ||
      order.status === 'COMPLETED' ||
      Boolean(order.paymentCapturedAt)
    if (
      isPaid &&
      order.total > 0 &&
      order.status !== 'CANCELLED' &&
      !row.hasFiscalTicket
    ) {
      paidWithoutTicket.push(row)
    }
    if (
      (order.status === 'PENDING_PAYMENT' || order.paymentStatus === 'UNPAID') &&
      order.total > 0 &&
      order.status !== 'CANCELLED'
    ) {
      pendingPayment.push(row)
    }
    if (['CONFIRMED', 'PREPARING', 'READY'].includes(order.status)) {
      openKitchen.push(row)
    }
    if (
      order.status === 'CANCELLED' &&
      row.hasFiscalTicket &&
      !row.hasVoidTicket &&
      order.total > 0
    ) {
      cancelledPaid.push(row)
    }
  }

  const checks: PrecloseCheck[] = []
  const todayKey = fiscalDayKey(now)

  if (dayKey > todayKey) {
    checks.push({
      id: 'future_day',
      severity: 'blocker',
      label: 'Journée future',
      detail: `Impossible de clôturer une date postérieure à aujourd'hui (${todayKey}).`,
    })
  }

  if (closure) {
    checks.push({
      id: 'already_closed',
      severity: 'blocker',
      label: 'Journée déjà clôturée',
      detail: `Clôture Z enregistrée le ${closure.closedAt.toISOString()} — modification impossible (ISCA).`,
    })
  }

  if (!chain.ok) {
    checks.push({
      id: 'chain_integrity',
      severity: 'blocker',
      label: 'Journal fiscal (chaîne ISCA)',
      detail:
        'Le journal informatique (JET) présente une incohérence cryptographique — comme une page de grand livre dont la signature ne correspond plus. ' +
        `Détail technique : ${chain.message}. ` +
        'La clôture Z est bloquée tant que l’intégrité n’est pas rétablie (obligation légale art. 286 CGI).',
      actionHint:
        'Contactez le support ou relancez la réparation labo (script fiscal-repair-jet). Aucune vente n’est perdue : seules les empreintes de contrôle doivent être recalculées.',
    })
  } else {
    checks.push({
      id: 'chain_integrity',
      severity: 'ok',
      label: 'Journal fiscal (chaîne ISCA)',
      detail:
        'Chaque ticket et chaque événement technique sont enchaînés et signés — aucune altération détectée.',
    })
  }

  if (paidWithoutTicket.length > 0) {
    checks.push({
      id: 'paid_without_ticket',
      severity: 'blocker',
      label: 'Ventes payées sans ticket fiscal',
      detail: `${paidWithoutTicket.length} commande(s) encaissée(s) sans ticket SALE — émettez les tickets avant clôture.`,
      count: paidWithoutTicket.length,
      actionHint: 'Onglet Commandes ou POS — finaliser l’encaissement fiscal.',
    })
  } else {
    checks.push({
      id: 'paid_without_ticket',
      severity: 'ok',
      label: 'Tickets fiscaux',
      detail: 'Toutes les ventes payées ont un ticket fiscal.',
    })
  }

  if (cancelledPaid.length > 0) {
    checks.push({
      id: 'cancelled_without_void',
      severity: 'blocker',
      label: 'Annulations sans avoir fiscal',
      detail: `${cancelledPaid.length} commande(s) annulée(s) avec ticket initial mais sans avoir (VOID).`,
      count: cancelledPaid.length,
      actionHint: 'Onglet Tickets — émettre un avoir pour chaque annulation.',
    })
  } else {
    checks.push({
      id: 'cancelled_without_void',
      severity: 'ok',
      label: 'Avoirs / annulations',
      detail: 'Aucune annulation payée sans avoir.',
    })
  }

  if (pendingPayment.length > 0) {
    checks.push({
      id: 'pending_payment',
      severity: 'warning',
      label: 'Paiements en attente',
      detail: `${pendingPayment.length} commande(s) non soldées sur la journée.`,
      count: pendingPayment.length,
    })
  }

  if (openKitchen.length > 0) {
    checks.push({
      id: 'open_orders',
      severity: 'warning',
      label: 'Commandes encore ouvertes',
      detail: `${openKitchen.length} commande(s) en cours (cuisine / prête) — vérifiez qu’elles appartiennent bien à cette journée.`,
      count: openKitchen.length,
    })
  }

  if (thirdParty.length > 0) {
    checks.push({
      id: 'third_party_reconciliation',
      severity: 'warning',
      label: 'Plateformes tierces (Uber Eats, Deliveroo…)',
      detail: `${thirdParty.length} commande(s) — rapprochez les montants avec les relevés plateforme avant clôture.`,
      count: thirdParty.length,
      actionHint: 'Comparez CA ticket vs. virement plateforme du jour.',
    })
  }

  const saleCount = tickets.filter((t) => t.kind === 'SALE').length
  const voidCount = tickets.filter((t) => t.kind === 'VOID').length

  if (saleCount === 0 && orders.filter((o) => o.total > 0 && o.status !== 'CANCELLED').length === 0) {
    checks.push({
      id: 'no_activity',
      severity: 'warning',
      label: 'Aucune activité',
      detail: 'Aucune vente enregistrée sur cette journée — confirmez la date choisie.',
    })
  } else {
    checks.push({
      id: 'activity_summary',
      severity: 'ok',
      label: 'Activité du jour',
      detail: `${saleCount} vente(s), ${voidCount} avoir(s), CA tickets ${(revenueCents / 100).toFixed(2)} € TTC.`,
      count: saleCount,
    })
  }

  const isLastDayOfMonth = addParisDays(dayKey, 1).slice(8, 10) === '01'
  const isLastDayOfYear = isLastDayOfMonth && dayKey.endsWith('-12-31')

  if (isLastDayOfMonth && !monthlyClosure) {
    checks.push({
      id: 'monthly_closure_due',
      severity: 'warning',
      label: 'Clôture mensuelle requise',
      detail: `Fin de mois ${dayKey.slice(0, 7)} — après la clôture Z, effectuez la clôture mensuelle (BOFiP art. 286).`,
    })
  }

  if (isLastDayOfYear && !yearlyClosure) {
    checks.push({
      id: 'yearly_closure_due',
      severity: 'warning',
      label: 'Clôture annuelle / exercice',
      detail: `Fin d'exercice ${dayKey.slice(0, 4)} — export archive annuelle obligatoire après clôture Z.`,
    })
  }

  const blockerCount = checks.filter((c) => c.severity === 'blocker').length
  const warningCount = checks.filter((c) => c.severity === 'warning').length
  const canClose = blockerCount === 0 && !closure

  return {
    dayKey,
    dayLabel: formatFiscalDayLabel(dayKey),
    timezone: 'Europe/Paris',
    parisNow: now.toISOString(),
    parisHour: parisHour(now),
    suggestedDayKey,
    activationDayKey,
    periodStart: start.toISOString(),
    periodEnd: end.toISOString(),
    alreadyClosed: Boolean(closure),
    closureId: closure?.id,
    closedAt: closure?.closedAt.toISOString(),
    canClose,
    blockerCount,
    warningCount,
    checks,
    fiscal: {
      saleCount,
      voidCount,
      revenueCents,
      byPaymentMethod: byPayment,
      taxByRate,
      tickets: tickets.map((t) => ({
        id: t.id,
        serialNumber: t.serialNumber,
        kind: t.kind,
        totalCents: t.totalCents,
        paymentMethod: t.paymentMethod,
        orderId: t.orderId,
        issuedAt: t.issuedAt.toISOString(),
        voidOfId: t.voidOfId,
      })),
    },
    orders: {
      byChannel,
      paidWithoutTicket,
      pendingPayment,
      openKitchen,
      cancelledPaid,
      thirdParty,
    },
    chainIntegrity: chain.ok,
    grandTotalPerpetualCents: (seq?.grandTotalCents ?? BigInt(0)).toString(),
    periodicReminders: {
      monthlyDue: isLastDayOfMonth && !monthlyClosure,
      monthlyKey: isLastDayOfMonth ? dayKey.slice(0, 7) : undefined,
      yearlyDue: isLastDayOfYear && !yearlyClosure,
      yearlyKey: isLastDayOfYear ? Number(dayKey.slice(0, 4)) : undefined,
    },
  }
}

export async function acknowledgeDailyPreclose(
  prisma: PrismaClient,
  businessId: string,
  operatorId: string,
  input: {
    dayKey: string
    managerNotes?: string
    cashCountedCents?: number | null
    confirmWarnings?: boolean
  },
): Promise<{ precloseId: string; expiresAt: string; preview: DailyPreclosePreview }> {
  const preview = await buildDailyPreclosePreview(prisma, businessId, input.dayKey)

  if (!preview.canClose) {
    throw new Error(
      `Pré-clôture impossible : ${preview.blockerCount} blocage(s) — corrigez les erreurs avant de continuer.`,
    )
  }

  if (preview.warningCount > 0 && !input.confirmWarnings) {
    throw new Error(
      `${preview.warningCount} avertissement(s) non confirmé(s) — cochez la confirmation explicite.`,
    )
  }

  const expiresAt = new Date(Date.now() + PRECLOSE_TTL_MS)

  const row = await prisma.fiscalDayPreclose.create({
    data: {
      businessId,
      dayKey: preview.dayKey,
      snapshot: preview as object,
      checks: preview.checks as object[],
      canClose: true,
      blockerCount: preview.blockerCount,
      warningCount: preview.warningCount,
      managerNotes: input.managerNotes?.trim() || null,
      cashCountedCents: input.cashCountedCents ?? null,
      acknowledgedById: operatorId,
      expiresAt,
    },
  })

  return {
    precloseId: row.id,
    expiresAt: expiresAt.toISOString(),
    preview,
  }
}

export async function assertValidPrecloseForClosure(
  prisma: PrismaClient,
  businessId: string,
  dayKey: string,
  precloseId: string,
): Promise<{ id: string; snapshot: unknown }> {
  const row = await prisma.fiscalDayPreclose.findFirst({
    where: {
      id: precloseId,
      businessId,
      dayKey,
      closureId: null,
      canClose: true,
      expiresAt: { gt: new Date() },
    },
  })
  if (!row) {
    throw new Error(
      'Pré-clôture expirée ou invalide — relancez la vérification (validité 4 h).',
    )
  }
  return { id: row.id, snapshot: row.snapshot }
}

export async function linkPrecloseToClosure(
  prisma: PrismaClient | Prisma.TransactionClient,
  precloseId: string,
  closureId: string,
): Promise<void> {
  await prisma.fiscalDayPreclose.update({
    where: { id: precloseId },
    data: { closureId },
  })
}

export { PAYMENT_LABEL, CHANNEL_LABEL, PRECLOSE_TTL_MS }
