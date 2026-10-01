import { fiscalGenesisHash, fiscalHmac } from '../lib/fiscal/hash';
import { verifyFiscalChains } from '../lib/fiscal/verify-chain';
import { fiscalClosureHashBody } from '../lib/fiscal/closure-hash';
import { fiscalEventRecordHash } from '../lib/fiscal/event-hash';
import { ensureFiscalTicketForPaidOrder, issueFiscalVoid } from '../lib/fiscal/ticket';
import { closeFiscalDay } from '../lib/fiscal/closure';

// ---------------------------------------------------------------------------
// hash.ts — les primitives dont dépend toute la chaîne
// ---------------------------------------------------------------------------

describe('fiscal/hash', () => {
  it('genesis hash is a stable, non-empty sentinel', () => {
    expect(fiscalGenesisHash()).toBe('GENESIS');
  });

  it('fiscalHmac is deterministic for the same payload + secret', () => {
    const a = fiscalHmac('payload', 'secret');
    const b = fiscalHmac('payload', 'secret');
    expect(a).toBe(b);
  });

  it('fiscalHmac changes if a single byte of the payload changes', () => {
    const a = fiscalHmac('payload', 'secret');
    const b = fiscalHmac('payloae', 'secret');
    expect(a).not.toBe(b);
  });

  it('throws when no secret is configured', () => {
    const prevFiscal = process.env.FISCAL_HMAC_SECRET;
    const prevJwt = process.env.JWT_SECRET;
    delete process.env.FISCAL_HMAC_SECRET;
    delete process.env.JWT_SECRET;
    expect(() => fiscalHmac('payload')).toThrow(/FISCAL_HMAC_SECRET/);
    process.env.FISCAL_HMAC_SECRET = prevFiscal;
    process.env.JWT_SECRET = prevJwt;
  });
});

// ---------------------------------------------------------------------------
// verify-chain.ts — détection d'altération
// ---------------------------------------------------------------------------

function makeTicket(
  overrides: Record<string, unknown> & { previousHash: string }
): Record<string, unknown> & { recordHash: string } {
  const base = {
    id: 't1',
    serialNumber: 1,
    kind: 'SALE',
    issuedAt: new Date('2026-08-01T10:00:00Z'),
    orderId: 'o1',
    subtotalCents: 1000,
    taxByRate: { '10': 100 },
    totalCents: 1100,
    paymentMethod: 'CASH',
    operatorId: 'u1',
    offlineRef: null,
    voidOfId: null,
    voidReason: null,
    ...overrides,
  };
  const body = JSON.stringify({
    serialNumber: base.serialNumber,
    kind: base.kind,
    issuedAt: (base.issuedAt as Date).toISOString(),
    orderId: base.orderId,
    subtotalCents: base.subtotalCents,
    taxByRate: base.taxByRate,
    totalCents: base.totalCents,
    paymentMethod: base.paymentMethod,
    operatorId: base.operatorId,
    offlineRef: base.offlineRef,
    previousHash: overrides.previousHash,
  });
  return { ...base, recordHash: fiscalHmac(body) };
}

function makeClosure(overrides: Record<string, unknown>): Record<string, unknown> {
  const base = {
    periodType: 'DAILY',
    periodKey: '2026-08-01',
    totals: { revenueCents: 1100 },
    grandTotalCents: 1100n,
    ticketCount: 1,
    closedAt: new Date('2026-08-02T02:00:00Z'),
    ...overrides,
  };
  const body = fiscalClosureHashBody(base as never);
  return { ...base, recordHash: fiscalHmac(body) };
}

describe('fiscal/verify-chain', () => {
  it('passes on an empty ledger', async () => {
    const prisma = {
      fiscalTicket: { findMany: jest.fn().mockResolvedValue([]) },
      fiscalEvent: { findMany: jest.fn().mockResolvedValue([]) },
      fiscalClosure: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const result = await verifyFiscalChains(prisma as never, 'b1');
    expect(result.ok).toBe(true);
  });

  it('passes on a correctly chained ticket sequence', async () => {
    const t1 = makeTicket({ serialNumber: 1, previousHash: fiscalGenesisHash() });
    const t2 = makeTicket({ serialNumber: 2, previousHash: t1.recordHash });
    const prisma = {
      fiscalTicket: { findMany: jest.fn().mockResolvedValue([t1, t2]) },
      fiscalEvent: { findMany: jest.fn().mockResolvedValue([]) },
      fiscalClosure: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const result = await verifyFiscalChains(prisma as never, 'b1');
    expect(result.ok).toBe(true);
    expect(result.ticketsChecked).toBe(2);
  });

  it('detects a tampered ticket amount (recordHash no longer matches content)', async () => {
    const t1 = makeTicket({ serialNumber: 1, previousHash: fiscalGenesisHash() });
    // Falsification après coup : le montant est modifié mais pas le recordHash.
    const tampered = { ...t1, totalCents: 999999 };
    const prisma = {
      fiscalTicket: { findMany: jest.fn().mockResolvedValue([tampered]) },
      fiscalEvent: { findMany: jest.fn().mockResolvedValue([]) },
      fiscalClosure: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const result = await verifyFiscalChains(prisma as never, 'b1');
    expect(result.ok).toBe(false);
    expect(result.firstBreakAt).toContain('recordHash');
  });

  it('detects a ticket removed from the middle of the sequence (broken previousHash link)', async () => {
    const t1 = makeTicket({ serialNumber: 1, previousHash: fiscalGenesisHash() });
    const t2 = makeTicket({ serialNumber: 2, previousHash: t1.recordHash });
    const t3 = makeTicket({ serialNumber: 3, previousHash: t2.recordHash });
    // t2 supprimé : t3.previousHash ne correspond plus au dernier hash vu (t1).
    const prisma = {
      fiscalTicket: { findMany: jest.fn().mockResolvedValue([t1, t3]) },
      fiscalEvent: { findMany: jest.fn().mockResolvedValue([]) },
      fiscalClosure: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const result = await verifyFiscalChains(prisma as never, 'b1');
    expect(result.ok).toBe(false);
    expect(result.firstBreakAt).toContain('previousHash');
  });

  it('detects a tampered JET event', async () => {
    const at = new Date('2026-08-01T10:00:00Z');
    const e1 = {
      id: 'e1',
      eventType: 'TICKET_ISSUED',
      operatorId: 'u1',
      entityType: 'FiscalTicket',
      entityId: 't1',
      payload: { serialNumber: 1 },
      previousHash: fiscalGenesisHash(),
      createdAt: at,
    };
    const recordHash = fiscalEventRecordHash({ ...e1, at });
    const tampered = { ...e1, recordHash, payload: { serialNumber: 999 } };
    const prisma = {
      fiscalTicket: { findMany: jest.fn().mockResolvedValue([]) },
      fiscalEvent: { findMany: jest.fn().mockResolvedValue([tampered]) },
      fiscalClosure: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const result = await verifyFiscalChains(prisma as never, 'b1');
    expect(result.ok).toBe(false);
    expect(result.firstBreakAt).toContain('event');
  });

  it('passes on a correctly chained closure sequence', async () => {
    const c1 = makeClosure({ periodKey: '2026-08-01', previousHash: fiscalGenesisHash() });
    const c2 = makeClosure({ periodKey: '2026-08-02', previousHash: c1.recordHash });
    const prisma = {
      fiscalTicket: { findMany: jest.fn().mockResolvedValue([]) },
      fiscalEvent: { findMany: jest.fn().mockResolvedValue([]) },
      fiscalClosure: { findMany: jest.fn().mockResolvedValue([c1, c2]) },
    };
    const result = await verifyFiscalChains(prisma as never, 'b1');
    expect(result.ok).toBe(true);
    expect(result.closuresChecked).toBe(2);
  });

  it('detects a closure spliced out of the middle of the sequence', async () => {
    const c1 = makeClosure({ periodKey: '2026-08-01', previousHash: fiscalGenesisHash() });
    const c2 = makeClosure({ periodKey: '2026-08-02', previousHash: c1.recordHash });
    const c3 = makeClosure({ periodKey: '2026-08-03', previousHash: c2.recordHash });
    // c2 supprimée : c3 reste interne-cohérente (son propre recordHash matche son
    // propre previousHash+contenu) mais ne s'enchaîne plus derrière c1.
    const prisma = {
      fiscalTicket: { findMany: jest.fn().mockResolvedValue([]) },
      fiscalEvent: { findMany: jest.fn().mockResolvedValue([]) },
      fiscalClosure: { findMany: jest.fn().mockResolvedValue([c1, c3]) },
    };
    const result = await verifyFiscalChains(prisma as never, 'b1');
    expect(result.ok).toBe(false);
    expect(result.firstBreakAt).toContain('previousHash');
  });
});

// ---------------------------------------------------------------------------
// ticket.ts / closure.ts — fake Prisma en mémoire, exécute le vrai code métier
// ---------------------------------------------------------------------------

type FakeState = {
  sequence: {
    businessId: string;
    nextTicketNo: number;
    lastTicketHash: string | null;
    lastEventHash: string | null;
    lastClosureHash: string | null;
    grandTotalCents: bigint;
    softwareVersion: string;
  };
  tickets: Array<Record<string, unknown>>;
  events: Array<Record<string, unknown>>;
  closures: Array<Record<string, unknown>>;
  orders: Array<Record<string, unknown>>;
  business: { id: string; taxRate: number; settings: unknown };
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- fake Prisma client, forme dérivée des jest.fn() ci-dessous.
function createFakeFiscalPrisma(businessId: string) {
  const state: FakeState = {
    sequence: {
      businessId,
      nextTicketNo: 1,
      lastTicketHash: null,
      lastEventHash: null,
      lastClosureHash: null,
      grandTotalCents: 0n,
      softwareVersion: '1.0.0',
    },
    tickets: [],
    events: [],
    closures: [],
    orders: [],
    business: { id: businessId, taxRate: 10, settings: {} },
  };

  const fiscalSequence = {
    upsert: jest.fn(async () => ({ ...state.sequence })),
    update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
      Object.assign(state.sequence, data);
      return { ...state.sequence };
    }),
    findUnique: jest.fn(async () => ({ ...state.sequence })),
    findUniqueOrThrow: jest.fn(async () => ({ ...state.sequence })),
  };

  const fiscalTicket = {
    create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
      const row = { id: `t${state.tickets.length + 1}`, ...data };
      state.tickets.push(row);
      return row;
    }),
    findFirst: jest.fn(
      async ({ where }: { where: Record<string, unknown> }) =>
        state.tickets.find(t => {
          if (where.orderId && t.orderId !== where.orderId) return false;
          if (where.id && t.id !== where.id) return false;
          if (where.voidOfId && t.voidOfId !== where.voidOfId) return false;
          if (where.kind && typeof where.kind === 'object') {
            const inList = (where.kind as { in: string[] }).in;
            if (!inList.includes(t.kind as string)) return false;
          }
          return true;
        }) ?? null
    ),
  };

  const fiscalEvent = {
    create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
      const row = { id: `e${state.events.length + 1}`, ...data };
      state.events.push(row);
      return row;
    }),
    count: jest.fn(async () => 0),
  };

  const fiscalClosure = {
    create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
      const row = { id: `c${state.closures.length + 1}`, ...data };
      state.closures.push(row);
      return row;
    }),
    findUnique: jest.fn(async () => null),
  };

  const tx = {
    fiscalSequence,
    fiscalTicket,
    fiscalEvent,
    fiscalClosure,
    // SELECT … FOR UPDATE de lockFiscalSequence — sans effet dans le fake
    $queryRaw: jest.fn(async () => []),
  };

  const prisma = {
    business: {
      findUniqueOrThrow: jest.fn(async () => state.business),
      findUnique: jest.fn(async () => state.business),
    },
    order: {
      findFirst: jest.fn(
        async ({ where }: { where: Record<string, unknown> }) =>
          state.orders.find(
            o =>
              o.id === where.id &&
              (!where.businessId || o.businessId === where.businessId) &&
              (!where.paymentStatus || o.paymentStatus === where.paymentStatus)
          ) ?? null
      ),
    },
    fiscalTicket: {
      ...fiscalTicket,
      findMany: jest.fn(async () => state.tickets),
    },
    fiscalSequence,
    fiscalClosure: {
      findUnique: jest.fn(async () => null),
    },
    $transaction: jest.fn(async (cb: (txArg: typeof tx) => unknown) => cb(tx)),
  };

  return { prisma, state };
}

function fakeOrder(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'o1',
    businessId: 'b1',
    orderNumber: 42,
    type: 'DINE_IN',
    paymentStatus: 'PAID',
    isOnlineOrder: false,
    tax: 0,
    subtotal: 1000,
    serviceCharge: 0,
    discount: 0,
    total: 1100,
    customerName: null,
    cashierId: 'u1',
    paymentMethod: 'CASH',
    items: [
      {
        quantity: 1,
        price: 1000,
        menuItem: { name: 'Pizza Regina', slug: 'regina', vatRateBps: 1000 },
      },
    ],
    ...overrides,
  };
}

describe('fiscal/ticket — issueFiscalTicket via ensureFiscalTicketForPaidOrder', () => {
  it('chains a second ticket onto the first (previousHash = first recordHash)', async () => {
    const { prisma, state } = createFakeFiscalPrisma('b1');
    state.orders.push(fakeOrder({ id: 'o1', orderNumber: 1 }));
    state.orders.push(fakeOrder({ id: 'o2', orderNumber: 2 }));

    const r1 = await ensureFiscalTicketForPaidOrder(prisma as never, {
      businessId: 'b1',
      orderId: 'o1',
    });
    const r2 = await ensureFiscalTicketForPaidOrder(prisma as never, {
      businessId: 'b1',
      orderId: 'o2',
    });

    expect(r1?.created).toBe(true);
    expect(r1?.serialNumber).toBe(1);
    expect(r2?.created).toBe(true);
    expect(r2?.serialNumber).toBe(2);

    const t1 = state.tickets[0];
    const t2 = state.tickets[1];
    expect(t1.previousHash).toBe(fiscalGenesisHash());
    expect(t2.previousHash).toBe(t1.recordHash);

    // La chaîne doit être vérifiable de bout en bout par le vérificateur indépendant.
    const verifyPrisma = {
      fiscalTicket: { findMany: jest.fn().mockResolvedValue(state.tickets) },
      fiscalEvent: { findMany: jest.fn().mockResolvedValue(state.events) },
      fiscalClosure: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const verified = await verifyFiscalChains(verifyPrisma as never, 'b1');
    expect(verified.ok).toBe(true);
  });

  it('is idempotent: a second call for the same order does not create a second ticket', async () => {
    const { prisma, state } = createFakeFiscalPrisma('b1');
    state.orders.push(fakeOrder({ id: 'o1' }));

    const r1 = await ensureFiscalTicketForPaidOrder(prisma as never, {
      businessId: 'b1',
      orderId: 'o1',
    });
    const r2 = await ensureFiscalTicketForPaidOrder(prisma as never, {
      businessId: 'b1',
      orderId: 'o1',
    });

    expect(r1?.created).toBe(true);
    expect(r2?.created).toBe(false);
    expect(r2?.ticketId).toBe(r1?.ticketId);
    expect(state.tickets).toHaveLength(1);
  });

  it('returns null for an order that is not PAID (no ticket for an unpaid order)', async () => {
    const { prisma, state } = createFakeFiscalPrisma('b1');
    state.orders.push(fakeOrder({ id: 'o1', paymentStatus: 'UNPAID' }));

    const result = await ensureFiscalTicketForPaidOrder(prisma as never, {
      businessId: 'b1',
      orderId: 'o1',
    });

    expect(result).toBeNull();
    expect(state.tickets).toHaveLength(0);
  });
});

describe('fiscal/ticket — issueFiscalVoid', () => {
  it('creates a reversing entry with negated amounts, chained after the sale', async () => {
    const { prisma, state } = createFakeFiscalPrisma('b1');
    state.orders.push(fakeOrder({ id: 'o1' }));
    const sale = await ensureFiscalTicketForPaidOrder(prisma as never, {
      businessId: 'b1',
      orderId: 'o1',
    });

    const voidTicket = await issueFiscalVoid(prisma as never, {
      businessId: 'b1',
      voidOfTicketId: sale!.ticketId,
      operatorId: 'u2',
      reason: 'Erreur de saisie',
    });

    expect(voidTicket.kind).toBe('VOID');
    expect(voidTicket.totalCents).toBe(-1100);
    expect(voidTicket.previousHash).toBe(state.tickets[0].recordHash);
    expect(state.sequence.grandTotalCents).toBe(0n); // +1100 (sale) puis -1100 (void)
  });

  it('is idempotent: voiding the same ticket twice returns the same void', async () => {
    const { prisma, state } = createFakeFiscalPrisma('b1');
    state.orders.push(fakeOrder({ id: 'o1' }));
    const sale = await ensureFiscalTicketForPaidOrder(prisma as never, {
      businessId: 'b1',
      orderId: 'o1',
    });

    const v1 = await issueFiscalVoid(prisma as never, {
      businessId: 'b1',
      voidOfTicketId: sale!.ticketId,
      operatorId: 'u2',
      reason: 'Erreur',
    });
    const v2 = await issueFiscalVoid(prisma as never, {
      businessId: 'b1',
      voidOfTicketId: sale!.ticketId,
      operatorId: 'u2',
      reason: 'Erreur',
    });

    expect(v2.id).toBe(v1.id);
    expect(state.tickets.filter(t => t.kind === 'VOID')).toHaveLength(1);
  });
});

describe('fiscal/closure — closeFiscalDay', () => {
  it('refuses to close without a validated pre-closure (ISCA safeguard)', async () => {
    const { prisma } = createFakeFiscalPrisma('b1');
    const prevRequire = process.env.FISCAL_REQUIRE_PRECLOSE;
    delete process.env.FISCAL_REQUIRE_PRECLOSE; // != 'false' => obligatoire

    await expect(
      closeFiscalDay(prisma as never, 'b1', 'u1', { dayKey: '2026-08-01' })
    ).rejects.toThrow(/Pré-clôture obligatoire/);

    process.env.FISCAL_REQUIRE_PRECLOSE = prevRequire;
  });

  it('is idempotent: closing an already-closed day returns the existing closure without re-aggregating', async () => {
    const { prisma, state } = createFakeFiscalPrisma('b1');
    const existingClosure = { id: 'c-existing', periodKey: '2026-08-01', periodType: 'DAILY' };
    prisma.fiscalClosure = {
      ...prisma.fiscalClosure,
      findUnique: jest.fn().mockResolvedValue(existingClosure),
    } as never;

    const result = await closeFiscalDay(prisma as never, 'b1', 'u1', {
      dayKey: '2026-08-01',
      skipPreclose: true,
    });

    expect(result).toBe(existingClosure);
    expect(state.closures).toHaveLength(0); // aucune nouvelle clôture créée
  });
});
