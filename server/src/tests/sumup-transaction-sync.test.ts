import {
  PAGE_LIMIT,
  syncSumupTransactions,
  listCachedSumupTransactions,
} from '../lib/sumup-transaction-sync';
import type { SumupTransaction } from '../lib/sumup-transactions';

jest.mock('../lib/sumup-transactions');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const sumupTransactionsClient = jest.requireMock('../lib/sumup-transactions') as {
  getSumupTransactionHistory: jest.Mock;
};

function fakeTransaction(overrides: Partial<SumupTransaction> = {}): SumupTransaction {
  return {
    id: 'txn-1',
    transaction_id: 'txn-1',
    transaction_code: 'ABC123',
    amount: 12.5,
    vat_amount: 0.65,
    currency: 'EUR',
    timestamp: '2026-09-01T12:00:00Z',
    status: 'SUCCESSFUL',
    payment_type: 'POS',
    ...overrides,
  };
}

function fakePrisma(latestOccurredAt: Date | null = null) {
  return {
    sumupTransaction: {
      findFirst: jest
        .fn()
        .mockResolvedValue(latestOccurredAt ? { occurredAt: latestOccurredAt } : null),
      upsert: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([]),
    },
  };
}

describe('sumup-transaction-sync — syncSumupTransactions', () => {
  beforeEach(() => jest.clearAllMocks());

  it('looks back 30 days on the very first sync for a business (no cached rows)', async () => {
    sumupTransactionsClient.getSumupTransactionHistory.mockResolvedValue({ items: [] });
    const prisma = fakePrisma(null);

    await syncSumupTransactions(prisma as never, 'b1');

    const call = sumupTransactionsClient.getSumupTransactionHistory.mock.calls[0][0];
    const spanMs = new Date(call.newestTime).getTime() - new Date(call.oldestTime).getTime();
    expect(spanMs).toBeGreaterThan(29 * 24 * 60 * 60 * 1000);
    expect(spanMs).toBeLessThan(31 * 24 * 60 * 60 * 1000);
  });

  it('resumes 30 minutes before the last cached transaction (overlap, not a gap)', async () => {
    sumupTransactionsClient.getSumupTransactionHistory.mockResolvedValue({ items: [] });
    const latest = new Date('2026-09-01T10:00:00Z');
    const prisma = fakePrisma(latest);

    await syncSumupTransactions(prisma as never, 'b1');

    const call = sumupTransactionsClient.getSumupTransactionHistory.mock.calls[0][0];
    expect(call.oldestTime).toBe('2026-09-01T09:30:00.000Z');
  });

  it('upserts each transaction with correct cents conversion and idempotency key', async () => {
    sumupTransactionsClient.getSumupTransactionHistory.mockResolvedValue({
      items: [fakeTransaction({ id: 'txn-42', amount: 12.5, vat_amount: 0.65, fee_amount: 0.21 })],
    });
    const prisma = fakePrisma();

    const result = await syncSumupTransactions(prisma as never, 'b1');

    expect(result.synced).toBe(1);
    expect(prisma.sumupTransaction.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          businessId_sumupTransactionId: { businessId: 'b1', sumupTransactionId: 'txn-42' },
        },
        create: expect.objectContaining({
          amountCents: 1250,
          vatAmountCents: 65,
          feeAmountCents: 21,
        }),
      })
    );
  });

  it('never clears productSummary on update (API never provides it — would erase the CSV import)', async () => {
    sumupTransactionsClient.getSumupTransactionHistory.mockResolvedValue({
      items: [fakeTransaction({ id: 'txn-42' })],
    });
    const prisma = fakePrisma();

    await syncSumupTransactions(prisma as never, 'b1');

    const call = prisma.sumupTransaction.upsert.mock.calls[0][0];
    expect(call.update).not.toHaveProperty('productSummary');
    expect(call.create).toHaveProperty('productSummary', null);
  });

  it('does update productSummary if the API ever provides one', async () => {
    sumupTransactionsClient.getSumupTransactionHistory.mockResolvedValue({
      items: [fakeTransaction({ id: 'txn-42', product_summary: 'Reine Sénior 31cm' })],
    });
    const prisma = fakePrisma();

    await syncSumupTransactions(prisma as never, 'b1');

    const call = prisma.sumupTransaction.upsert.mock.calls[0][0];
    expect(call.update).toHaveProperty('productSummary', 'Reine Sénior 31cm');
  });

  it('paginates past a full page and stops once a short page is returned', async () => {
    const fullPage = Array.from({ length: PAGE_LIMIT }, (_, i) =>
      fakeTransaction({ id: `txn-${i}`, timestamp: new Date(2026, 8, 1, 0, i).toISOString() })
    );
    const shortPage = [fakeTransaction({ id: 'txn-last', timestamp: '2026-09-02T00:00:00Z' })];
    sumupTransactionsClient.getSumupTransactionHistory
      .mockResolvedValueOnce({ items: fullPage })
      .mockResolvedValueOnce({ items: shortPage });
    const prisma = fakePrisma();

    const result = await syncSumupTransactions(prisma as never, 'b1');

    expect(sumupTransactionsClient.getSumupTransactionHistory).toHaveBeenCalledTimes(2);
    expect(result.synced).toBe(PAGE_LIMIT + 1);
    expect(result.pages).toBe(2);
  });

  it('refuses to loop forever when the API keeps returning a full page at the same timestamp', async () => {
    // oldestTime après chevauchement (latest - 30min) tombe exactement sur l'horodatage
    // bloqué : la garde `lastTimestamp <= oldestTime` doit stopper dès le 1er appel.
    const stuckPage = Array.from({ length: PAGE_LIMIT }, (_, i) =>
      fakeTransaction({ id: `txn-stuck-${i}`, timestamp: '2026-09-01T12:00:00.000Z' })
    );
    sumupTransactionsClient.getSumupTransactionHistory.mockResolvedValue({ items: stuckPage });
    const prisma = fakePrisma(new Date('2026-09-01T12:30:00.000Z'));

    const result = await syncSumupTransactions(prisma as never, 'b1');

    expect(sumupTransactionsClient.getSumupTransactionHistory).toHaveBeenCalledTimes(1);
    expect(result.synced).toBe(PAGE_LIMIT);
  });
});

describe('sumup-transaction-sync — listCachedSumupTransactions', () => {
  it('defaults to unbilled (invoiceId null) when no filter is given', async () => {
    const prisma = fakePrisma();
    await listCachedSumupTransactions(prisma as never, 'b1');
    expect(prisma.sumupTransaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          businessId: 'b1',
          status: 'SUCCESSFUL',
          invoiceId: null,
          paymentType: { not: 'ECOM' },
        },
      })
    );
  });

  it('excludes FAILED transactions (déclinées/réessai) — jamais dans le journal officiel SumUp', async () => {
    const prisma = fakePrisma();
    await listCachedSumupTransactions(prisma as never, 'b1', { billed: 'all' });
    expect(prisma.sumupTransaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: 'SUCCESSFUL' }) })
    );
  });

  it('excludes ECOM (déjà facturé via la commande web) unless a payment type is explicitly requested', async () => {
    const prisma = fakePrisma();
    await listCachedSumupTransactions(prisma as never, 'b1', { paymentType: 'ECOM' });
    expect(prisma.sumupTransaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ paymentType: 'ECOM' }) })
    );
  });

  it('caps the requested limit at 500', async () => {
    const prisma = fakePrisma();
    await listCachedSumupTransactions(prisma as never, 'b1', { limit: 10000 });
    expect(prisma.sumupTransaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 500 })
    );
  });

  it('filters by [from, to] and includes billed+unbilled when billed is "all"', async () => {
    const prisma = fakePrisma();
    const from = new Date('2026-09-01T00:00:00Z');
    const to = new Date('2026-09-08T00:00:00Z');
    await listCachedSumupTransactions(prisma as never, 'b1', { billed: 'all', from, to });
    expect(prisma.sumupTransaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          businessId: 'b1',
          status: 'SUCCESSFUL',
          occurredAt: { gte: from, lte: to },
          paymentType: { not: 'ECOM' },
        },
      })
    );
  });
});
