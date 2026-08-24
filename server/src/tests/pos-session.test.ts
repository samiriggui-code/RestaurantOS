import { openPosSession, closePosSession } from '../lib/pos-session';

describe('pos-session', () => {
  it('rejects opening a session when one is already open', async () => {
    const prisma = {
      posSession: {
        findFirst: jest.fn().mockResolvedValue({ id: 's1', status: 'OPEN' }),
        create: jest.fn(),
      },
    };
    const result = await openPosSession(prisma as never, {
      businessId: 'b1',
      cashierId: 'u1',
      openingCashAmount: 5000,
    });
    expect(result).toEqual({
      ok: false,
      status: 400,
      error: 'Une session de caisse est déjà ouverte pour ce caissier',
    });
    expect(prisma.posSession.create).not.toHaveBeenCalled();
  });

  it('rejects a negative opening amount', async () => {
    const prisma = {
      posSession: { findFirst: jest.fn(), create: jest.fn() },
    };
    const result = await openPosSession(prisma as never, {
      businessId: 'b1',
      cashierId: 'u1',
      openingCashAmount: -100,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(400);
    expect(prisma.posSession.findFirst).not.toHaveBeenCalled();
  });

  it('404s when closing an unknown session', async () => {
    const prisma = {
      posSession: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const result = await closePosSession(prisma as never, {
      sessionId: 's1',
      businessId: 'b1',
      closingCashAmount: 5000,
    });
    expect(result).toEqual({ ok: false, status: 404, error: 'Session introuvable' });
  });

  it('rejects closing an already-closed session', async () => {
    const prisma = {
      posSession: {
        findFirst: jest.fn().mockResolvedValue({ id: 's1', status: 'CLOSED' }),
      },
    };
    const result = await closePosSession(prisma as never, {
      sessionId: 's1',
      businessId: 'b1',
      closingCashAmount: 5000,
    });
    expect(result).toEqual({ ok: false, status: 400, error: 'Session déjà clôturée' });
  });

  it('computes discrepancy against CASH-paid orders in the session window', async () => {
    const openedAt = new Date('2026-08-25T08:00:00Z');
    const prisma = {
      posSession: {
        findFirst: jest.fn().mockResolvedValue({
          id: 's1',
          status: 'OPEN',
          cashierId: 'u1',
          openedAt,
          notes: null,
        }),
        update: jest.fn().mockImplementation(({ data }) => ({ id: 's1', ...data })),
      },
      order: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { total: 15000 } }),
      },
    };
    const result = await closePosSession(prisma as never, {
      sessionId: 's1',
      businessId: 'b1',
      closingCashAmount: 14500,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const session = result.session as { expectedCashAmount: number; discrepancy: number };
      expect(session.expectedCashAmount).toBe(15000);
      expect(session.discrepancy).toBe(-500);
    }
    expect(prisma.order.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          businessId: 'b1',
          cashierId: 'u1',
          paymentMethod: 'CASH',
          paymentStatus: 'PAID',
        }),
      })
    );
  });
});
