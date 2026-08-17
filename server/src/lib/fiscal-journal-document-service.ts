import type { PrismaClient } from '@prisma/client'
import { FiscalJournalDocument } from '../emails/fiscal-journal-document'
import { businessDocumentContext } from './business-document-context'
import { renderPrintDocument } from './document-render'
import { verifyFiscalChains } from './fiscal'
import { formatEUR } from './money'

const EVENT_LABEL: Record<string, string> = {
  TICKET_SALE: 'Ticket vente',
  TICKET_VOID: 'Avoir',
  REPRINT: 'DUPLICATA',
  CLOSURE_DAILY: 'Clôture Z',
  OFFLINE_INTEGRATED: 'Intégration offline',
  ARCHIVE_YEARLY: 'Archive annuelle',
  SOFTWARE_START: 'Démarrage logiciel',
}

export async function renderFiscalJournalHtml(
  prisma: PrismaClient,
  businessId: string,
  ticketLimit = 80,
  eventLimit = 120,
): Promise<string> {
  const biz = await businessDocumentContext(prisma, businessId)

  const [sequence, verify, tickets, events] = await Promise.all([
    prisma.fiscalSequence.findUnique({ where: { businessId } }),
    verifyFiscalChains(prisma, businessId),
    prisma.fiscalTicket.findMany({
      where: { businessId },
      orderBy: { serialNumber: 'desc' },
      take: ticketLimit,
    }),
    prisma.fiscalEvent.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
      take: eventLimit,
    }),
  ])

  return renderPrintDocument(
    FiscalJournalDocument({
      ...biz,
      softwareVersion: sequence?.softwareVersion ?? '1.0.0',
      commissionedAt: sequence?.commissionedAt
        ? new Date(sequence.commissionedAt).toLocaleDateString('fr-FR')
        : '—',
      verifyOk: verify.ok,
      ticketsChecked: verify.ticketsChecked,
      tickets: tickets.map((t) => ({
        serialNumber: t.serialNumber,
        kind: t.kind,
        issuedAt: new Date(t.issuedAt).toLocaleString('fr-FR'),
        totalCents: formatEUR(t.totalCents),
        paymentMethod: t.paymentMethod ?? '—',
        hashPreview: t.recordHash.slice(0, 10).toUpperCase(),
      })),
      events: events.map((e) => {
        const payload = e.payload as { reprintNumber?: number } | null
        const label = EVENT_LABEL[e.eventType] ?? e.eventType
        const detail =
          payload?.reprintNumber != null
            ? `DUPLICATA n°${payload.reprintNumber}`
            : e.entityId
              ? `${e.entityType ?? 'entité'} ${e.entityId.slice(0, 8)}…`
              : '—'
        return {
          eventType: label,
          createdAt: new Date(e.createdAt).toLocaleString('fr-FR'),
          detail,
        }
      }),
    }),
  )
}
