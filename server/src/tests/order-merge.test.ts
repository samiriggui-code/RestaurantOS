import { mergeOrders } from '../lib/order-merge';

function baseOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 'o-target',
    businessId: 'b1',
    orderNumber: 100,
    type: 'DINE_IN',
    status: 'CONFIRMED',
    paymentStatus: 'UNPAID',
    notes: null,
    items: [{ id: 'it-1', quantity: 1, price: 1000, menuItem: { vatRateBps: 1000 } }],
    ...overrides,
  };
}

describe('order-merge', () => {
  it('rejects when no source ids remain after removing the target itself', async () => {
    const prisma = { order: { findFirst: jest.fn(), findMany: jest.fn() } };
    const result = await mergeOrders(prisma as never, undefined, {
      targetOrderId: 'o1',
      sourceOrderIds: ['o1'],
      businessId: 'b1',
    });
    expect(result).toEqual({
      ok: false,
      status: 400,
      error: 'Au moins une commande source distincte de la cible requise',
    });
  });

  it('404s when the target order is not found', async () => {
    const prisma = {
      order: { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn() },
    };
    const result = await mergeOrders(prisma as never, undefined, {
      targetOrderId: 'o1',
      sourceOrderIds: ['o2'],
      businessId: 'b1',
    });
    expect(result).toEqual({ ok: false, status: 404, error: 'Commande cible introuvable' });
  });

  it('rejects a paid target order', async () => {
    const prisma = {
      order: {
        findFirst: jest.fn().mockResolvedValue(baseOrder({ paymentStatus: 'PAID' })),
        findMany: jest.fn(),
      },
    };
    const result = await mergeOrders(prisma as never, undefined, {
      targetOrderId: 'o-target',
      sourceOrderIds: ['o2'],
      businessId: 'b1',
    });
    expect(result).toEqual({
      ok: false,
      status: 400,
      error: 'Impossible de fusionner sur une commande déjà payée',
    });
  });

  it('rejects when a source order is already paid', async () => {
    const prisma = {
      order: {
        findFirst: jest.fn().mockResolvedValue(baseOrder()),
        findMany: jest
          .fn()
          .mockResolvedValue([
            baseOrder({ id: 'o-src', orderNumber: 101, paymentStatus: 'PAID' }),
          ]),
      },
    };
    const result = await mergeOrders(prisma as never, undefined, {
      targetOrderId: 'o-target',
      sourceOrderIds: ['o-src'],
      businessId: 'b1',
    });
    expect(result).toEqual({
      ok: false,
      status: 400,
      error: 'Commande #101 déjà payée, fusion impossible',
    });
  });

  it('merges items into target, cancels sources, keeps traceability', async () => {
    const target = baseOrder();
    const source = baseOrder({
      id: 'o-src',
      orderNumber: 101,
      status: 'CONFIRMED',
      items: [{ id: 'it-2', quantity: 2, price: 500, menuItem: { vatRateBps: 1000 } }],
    });

    const txOrderUpdate = jest.fn();
    const txOrderItemUpdateMany = jest.fn();
    const finalTarget = { ...target, subtotal: 2000, total: 2200 };

    const tx = {
      orderItem: { updateMany: txOrderItemUpdateMany },
      order: {
        update: txOrderUpdate,
        findUnique: jest.fn().mockResolvedValue(finalTarget),
      },
    };

    const prisma = {
      order: {
        findFirst: jest.fn().mockResolvedValue(target),
        findMany: jest.fn().mockResolvedValue([source]),
      },
      business: {
        findUnique: jest.fn().mockResolvedValue({ taxRate: 10, serviceChargeRate: 0 }),
      },
      $transaction: jest.fn().mockImplementation(async (cb: (tx: unknown) => unknown) => cb(tx)),
    };

    const io = { to: jest.fn().mockReturnValue({ emit: jest.fn() }) };

    const result = await mergeOrders(prisma as never, io as never, {
      targetOrderId: 'o-target',
      sourceOrderIds: ['o-src'],
      businessId: 'b1',
    });

    expect(result.ok).toBe(true);
    expect(txOrderItemUpdateMany).toHaveBeenCalledWith({
      where: { id: { in: ['it-2'] } },
      data: { orderId: 'o-target' },
    });
    // Target totals recomputed (first order.update call) then source cancelled (second call)
    expect(txOrderUpdate).toHaveBeenNthCalledWith(1, {
      where: { id: 'o-target' },
      data: expect.objectContaining({ subtotal: expect.any(Number), total: expect.any(Number) }),
    });
    expect(txOrderUpdate).toHaveBeenNthCalledWith(2, {
      where: { id: 'o-src' },
      data: expect.objectContaining({
        status: 'CANCELLED',
        cancelReason: 'OTHER',
        cancelNote: 'Fusionnée dans #100',
      }),
    });
  });
});
