import { computeSalesVsExpenses } from '../lib/sales-vs-expenses';

function fakePrisma(overrides: Record<string, unknown> = {}) {
  return {
    order: {
      aggregate: jest.fn().mockResolvedValue({ _sum: { total: 0 }, _count: 0 }),
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
    },
    sumupTransaction: {
      aggregate: jest.fn().mockResolvedValue({ _sum: { amountCents: 0 } }),
    },
    expense: {
      aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 0 } }),
    },
    pennylaneSupplierInvoice: {
      aggregate: jest.fn().mockResolvedValue({ _sum: { amountCents: 0 } }),
    },
    ...overrides,
  };
}

describe('sales-vs-expenses — computeSalesVsExpenses', () => {
  const from = new Date('2026-09-01T00:00:00Z');
  const to = new Date('2026-09-08T00:00:00Z');

  it('sums online (Order) and counter (SumUp cache) sales into one total', async () => {
    const prisma = fakePrisma({
      order: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { total: 50000 }, _count: 0 }),
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
      sumupTransaction: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { amountCents: 12000 } }),
      },
    });

    const result = await computeSalesVsExpenses(prisma as never, 'b1', { from, to });

    expect(result.sales).toEqual({ onlineCents: 50000, counterCents: 12000, totalCents: 62000 });
  });

  it('sums manual expenses and Pennylane supplier invoices into one total', async () => {
    const prisma = fakePrisma({
      expense: { aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 8000 } }) },
      pennylaneSupplierInvoice: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { amountCents: 15000 } }),
      },
    });

    const result = await computeSalesVsExpenses(prisma as never, 'b1', { from, to });

    expect(result.expenses).toEqual({
      manualCents: 8000,
      supplierInvoicesCents: 15000,
      totalCents: 23000,
    });
  });

  it('computes net as sales minus expenses (can go negative)', async () => {
    const prisma = fakePrisma({
      order: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { total: 1000 }, _count: 0 }),
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
      expense: { aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 5000 } }) },
    });

    const result = await computeSalesVsExpenses(prisma as never, 'b1', { from, to });

    expect(result.netCents).toBe(1000 - 5000);
  });

  it('reports cancelled orders as losses (count + lost value)', async () => {
    const prisma = fakePrisma({
      order: {
        aggregate: jest.fn().mockImplementation((args: { where: { status?: string } }) => {
          if (args.where.status === 'CANCELLED') {
            return Promise.resolve({ _sum: { total: 4500 }, _count: 3 });
          }
          return Promise.resolve({ _sum: { total: 0 }, _count: 0 });
        }),
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
    });

    const result = await computeSalesVsExpenses(prisma as never, 'b1', { from, to });

    expect(result.losses).toEqual({ cancelledOrdersCount: 3, cancelledOrdersValueCents: 4500 });
  });

  it('reports refunded orders separately from cancelled ones', async () => {
    const prisma = fakePrisma({
      order: {
        aggregate: jest.fn().mockImplementation((args: { where: { paymentStatus?: string } }) => {
          if (args.where.paymentStatus === 'REFUNDED') {
            return Promise.resolve({ _sum: { total: 2200 }, _count: 2 });
          }
          return Promise.resolve({ _sum: { total: 0 }, _count: 0 });
        }),
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
    });

    const result = await computeSalesVsExpenses(prisma as never, 'b1', { from, to });

    expect(result.refunds).toEqual({ count: 2, totalCents: 2200 });
  });

  it('reports undelivered orders using a real count query, not the capped findMany list', async () => {
    const orders = Array.from({ length: 3 }, (_, i) => ({
      id: `o${i}`,
      orderNumber: i,
      status: 'DELIVERY_ISSUE',
      total: 1000,
      customerName: null,
      deliveryIssueReason: 'CLIENT_UNREACHABLE',
    }));
    const prisma = fakePrisma({
      order: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { total: 0 }, _count: 0 }),
        count: jest.fn().mockResolvedValue(120), // plus que le findMany plafonné à 50
        findMany: jest.fn().mockResolvedValue(orders),
      },
    });

    const result = await computeSalesVsExpenses(prisma as never, 'b1', { from, to });

    expect(result.undeliveredOrders.count).toBe(120);
    expect(result.undeliveredOrders.orders).toHaveLength(3);
  });

  it('filtre les ventes en ligne au canal WEB (le comptoir vient de SumUp, pas de Order)', async () => {
    const prisma = fakePrisma();
    await computeSalesVsExpenses(prisma as never, 'b1', { from, to });

    expect(prisma.order.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ channel: 'WEB', paymentStatus: 'PAID' }),
      })
    );
  });

  it('filters every query to the given [from, to] window', async () => {
    const prisma = fakePrisma();
    await computeSalesVsExpenses(prisma as never, 'b1', { from, to });

    expect(prisma.order.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ createdAt: { gte: from, lte: to } }),
      })
    );
    expect(prisma.sumupTransaction.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ occurredAt: { gte: from, lte: to } }),
      })
    );
    expect(prisma.sumupTransaction.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: 'SUCCESSFUL' }) })
    );
    expect(prisma.expense.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ date: { gte: from, lte: to } }) })
    );
    expect(prisma.pennylaneSupplierInvoice.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ date: { gte: from, lte: to } }) })
    );
  });
});
