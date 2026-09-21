import { getCounterSales, getCounterSaleItems } from '../lib/sumup-counter-sales';

describe('sumup-counter-sales — getCounterSales', () => {
  it('filters to SUCCESSFUL POS/CASH transactions within the date range', async () => {
    const prisma = { sumupTransaction: { findMany: jest.fn().mockResolvedValue([]) } };
    const from = new Date('2026-09-07T00:00:00Z');
    const to = new Date('2026-09-13T23:59:59Z');

    await getCounterSales(prisma as never, 'b1', from, to);

    expect(prisma.sumupTransaction.findMany).toHaveBeenCalledWith({
      where: {
        businessId: 'b1',
        status: 'SUCCESSFUL',
        paymentType: { in: ['POS', 'CASH'] },
        occurredAt: { gte: from, lte: to },
      },
      select: { occurredAt: true, amountCents: true, paymentType: true },
    });
  });
});

describe('sumup-counter-sales — getCounterSaleItems', () => {
  it('filters through the parent transaction (SUCCESSFUL, POS/CASH, date range)', async () => {
    const prisma = { sumupTransactionItem: { findMany: jest.fn().mockResolvedValue([]) } };
    const from = new Date('2026-09-07T00:00:00Z');
    const to = new Date('2026-09-13T23:59:59Z');

    await getCounterSaleItems(prisma as never, 'b1', from, to);

    expect(prisma.sumupTransactionItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          transaction: {
            businessId: 'b1',
            status: 'SUCCESSFUL',
            paymentType: { in: ['POS', 'CASH'] },
            occurredAt: { gte: from, lte: to },
          },
        },
      })
    );
  });

  it('flattens the joined transaction.occurredAt onto each item row', async () => {
    const occurredAt = new Date('2026-09-07T19:35:00Z');
    const prisma = {
      sumupTransactionItem: {
        findMany: jest.fn().mockResolvedValue([
          {
            description: 'Crémeuse Sénior 31cm',
            category: '2 - Pizzas Base Crème Fraîche',
            quantity: 1,
            amountCents: 1350,
            transaction: { occurredAt },
          },
        ]),
      },
    };

    const items = await getCounterSaleItems(prisma as never, 'b1', new Date(0), new Date());

    expect(items).toEqual([
      {
        description: 'Crémeuse Sénior 31cm',
        category: '2 - Pizzas Base Crème Fraîche',
        quantity: 1,
        amountCents: 1350,
        occurredAt,
      },
    ]);
  });
});
