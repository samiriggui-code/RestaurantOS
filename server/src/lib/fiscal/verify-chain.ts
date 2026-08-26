import type { PrismaClient } from '@prisma/client';
import { fiscalGenesisHash, fiscalHmac } from './hash';
import { fiscalEventRecordHash } from './event-hash';
import { fiscalClosureHashBody } from './closure-hash';

export type ChainVerifyResult = {
  ok: boolean;
  ticketsChecked: number;
  eventsChecked: number;
  closuresChecked: number;
  firstBreakAt?: string;
  message: string;
};

function verifyTicketChain(
  tickets: Array<{
    id: string;
    serialNumber: number;
    kind: string;
    issuedAt: Date;
    orderId: string | null;
    subtotalCents: number;
    taxByRate: unknown;
    totalCents: number;
    paymentMethod: string | null;
    operatorId: string | null;
    offlineRef: string | null;
    previousHash: string;
    recordHash: string;
    voidOfId: string | null;
    voidReason: string | null;
  }>
): { ok: boolean; checked: number; breakAt?: string } {
  let expectedPrev = fiscalGenesisHash();
  for (const t of tickets) {
    if (t.previousHash !== expectedPrev) {
      return {
        ok: false,
        checked: t.serialNumber - 1,
        breakAt: `ticket #${t.serialNumber} previousHash`,
      };
    }
    const body =
      t.kind === 'VOID'
        ? JSON.stringify({
            serialNumber: t.serialNumber,
            kind: t.kind,
            issuedAt: t.issuedAt.toISOString(),
            voidOfId: t.voidOfId,
            voidReason: t.voidReason,
            totalCents: t.totalCents,
            previousHash: t.previousHash,
          })
        : JSON.stringify({
            serialNumber: t.serialNumber,
            kind: t.kind,
            issuedAt: t.issuedAt.toISOString(),
            orderId: t.orderId,
            subtotalCents: t.subtotalCents,
            taxByRate: t.taxByRate,
            totalCents: t.totalCents,
            paymentMethod: t.paymentMethod,
            operatorId: t.operatorId,
            offlineRef: t.offlineRef,
            previousHash: t.previousHash,
          });
    const expected = fiscalHmac(body);
    if (expected !== t.recordHash) {
      return {
        ok: false,
        checked: t.serialNumber - 1,
        breakAt: `ticket #${t.serialNumber} recordHash`,
      };
    }
    expectedPrev = t.recordHash;
  }
  return { ok: true, checked: tickets.length };
}

function verifyEventChain(
  events: Array<{
    id: string;
    eventType: string;
    operatorId: string | null;
    entityType: string | null;
    entityId: string | null;
    payload: unknown;
    previousHash: string;
    recordHash: string;
    createdAt: Date;
  }>
): { ok: boolean; checked: number; breakAt?: string } {
  let expectedPrev = fiscalGenesisHash();
  for (const e of events) {
    if (e.previousHash !== expectedPrev) {
      return { ok: false, checked: 0, breakAt: `event ${e.id} previousHash` };
    }
    const expected = fiscalEventRecordHash({
      eventType: e.eventType,
      operatorId: e.operatorId,
      entityType: e.entityType,
      entityId: e.entityId,
      payload: e.payload,
      at: e.createdAt,
      previousHash: e.previousHash,
    });
    if (expected !== e.recordHash) {
      return { ok: false, checked: 0, breakAt: `event ${e.id} recordHash` };
    }
    expectedPrev = e.recordHash;
  }
  return { ok: true, checked: events.length };
}

export async function verifyFiscalChains(
  prisma: PrismaClient,
  businessId: string
): Promise<ChainVerifyResult> {
  const tickets = await prisma.fiscalTicket.findMany({
    where: { businessId },
    orderBy: { serialNumber: 'asc' },
  });
  const events = await prisma.fiscalEvent.findMany({
    where: { businessId },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
  const closures = await prisma.fiscalClosure.findMany({
    where: { businessId },
    orderBy: { closedAt: 'asc' },
  });

  const ticketResult = verifyTicketChain(tickets);
  if (!ticketResult.ok) {
    return {
      ok: false,
      ticketsChecked: ticketResult.checked,
      eventsChecked: 0,
      closuresChecked: 0,
      firstBreakAt: ticketResult.breakAt,
      message: `Chaîne tickets compromise : ${ticketResult.breakAt}`,
    };
  }

  const eventResult = verifyEventChain(events);
  if (!eventResult.ok) {
    return {
      ok: false,
      ticketsChecked: tickets.length,
      eventsChecked: eventResult.checked,
      closuresChecked: 0,
      firstBreakAt: eventResult.breakAt,
      message: `Chaîne JET compromise : ${eventResult.breakAt}`,
    };
  }

  // Clôtures : une seule chaîne partagée (FiscalSequence.lastClosureHash), toutes
  // périodes confondues (DAILY/MONTHLY/YEARLY), dans l'ordre de closedAt.
  let expectedClosurePrev = fiscalGenesisHash();
  for (const c of closures) {
    if (c.previousHash !== expectedClosurePrev) {
      return {
        ok: false,
        ticketsChecked: tickets.length,
        eventsChecked: events.length,
        closuresChecked: 0,
        firstBreakAt: `closure ${c.periodKey} previousHash`,
        message: `Chaîne clôtures compromise : ${c.periodKey}`,
      };
    }
    const body = fiscalClosureHashBody({
      periodType: c.periodType,
      periodKey: c.periodKey,
      totals: c.totals,
      grandTotalCents: c.grandTotalCents,
      ticketCount: c.ticketCount,
      closedAt: c.closedAt,
      previousHash: c.previousHash,
    });
    if (fiscalHmac(body) !== c.recordHash) {
      return {
        ok: false,
        ticketsChecked: tickets.length,
        eventsChecked: events.length,
        closuresChecked: 0,
        firstBreakAt: `closure ${c.periodKey} recordHash`,
        message: `Chaîne clôtures compromise : ${c.periodKey}`,
      };
    }
    expectedClosurePrev = c.recordHash;
  }

  return {
    ok: true,
    ticketsChecked: tickets.length,
    eventsChecked: events.length,
    closuresChecked: closures.length,
    message: 'Intégrité ISCA vérifiée — chaînes tickets, JET et clôtures OK',
  };
}
