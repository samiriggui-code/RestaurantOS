import {
  createInvoiceFromSumupTransaction,
  SumupTransactionNotFoundError,
} from '../lib/invoice-from-sumup-transaction';

function fakeCachedTransaction(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cache-1',
    businessId: 'b1',
    sumupTransactionId: 'txn-1',
    amountCents: 2110,
    vatAmountCents: 110,
    invoiceId: null,
    productSummary: null,
    occurredAt: new Date('2026-09-01T12:00:00Z'),
    ...overrides,
  };
}

function fakePrisma(opts: { cached?: ReturnType<typeof fakeCachedTransaction> | null } = {}) {
  const invoiceCreate = jest
    .fn()
    .mockImplementation(({ data }) =>
      Promise.resolve({ id: 'inv-new', ...data, lines: data.lines.create })
    );
  const sumupTransactionUpdate = jest.fn().mockResolvedValue({});
  return {
    sumupTransaction: {
      findFirst: jest
        .fn()
        .mockResolvedValue(opts.cached === undefined ? fakeCachedTransaction() : opts.cached),
      update: sumupTransactionUpdate,
    },
    invoice: {
      findUnique: jest.fn().mockResolvedValue({ id: 'inv-existing', lines: [] }),
      create: invoiceCreate,
    },
    $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        fiscalSequence: {
          upsert: jest.fn().mockResolvedValue({ nextInvoiceNo: 5 }),
          update: jest.fn().mockResolvedValue({}),
        },
        invoice: { create: invoiceCreate },
        sumupTransaction: { update: sumupTransactionUpdate },
      };
      return fn(tx);
    }),
  };
}

describe('invoice-from-sumup-transaction — createInvoiceFromSumupTransaction', () => {
  it('throws SumupTransactionNotFoundError when the cache row does not exist', async () => {
    const prisma = fakePrisma({ cached: null });
    await expect(
      createInvoiceFromSumupTransaction(prisma as never, 'b1', 'missing', { clientName: 'Jean' })
    ).rejects.toBeInstanceOf(SumupTransactionNotFoundError);
  });

  it('is idempotent: returns the existing invoice instead of re-billing an already-invoiced transaction', async () => {
    const prisma = fakePrisma({ cached: fakeCachedTransaction({ invoiceId: 'inv-existing' }) });
    const result = await createInvoiceFromSumupTransaction(prisma as never, 'b1', 'cache-1', {
      clientName: 'Jean Dupont',
    });
    expect(result).toEqual({ invoice: { id: 'inv-existing', lines: [] }, created: false });
    expect(prisma.invoice.create).not.toHaveBeenCalled();
  });

  it('refuses a blank client name', async () => {
    const prisma = fakePrisma();
    await expect(
      createInvoiceFromSumupTransaction(prisma as never, 'b1', 'cache-1', { clientName: '   ' })
    ).rejects.toThrow(/Nom client/);
  });

  it('splits the exact SumUp VAT (no rounding drift) and snaps to the 5.5% takeaway rate', async () => {
    const prisma = fakePrisma({
      cached: fakeCachedTransaction({ amountCents: 2110, vatAmountCents: 110 }),
    });

    const result = await createInvoiceFromSumupTransaction(prisma as never, 'b1', 'cache-1', {
      clientName: 'Jean Dupont',
    });

    expect(result.created).toBe(true);
    const createCall = prisma.invoice.create.mock.calls[0][0];
    expect(createCall.data.subtotalCents).toBe(2000);
    expect(createCall.data.taxCents).toBe(110);
    expect(createCall.data.totalCents).toBe(2110);
    expect(createCall.data.lines.create[0]).toEqual(
      expect.objectContaining({ unitPriceCents: 2000, taxRate: 5.5, quantity: 1 })
    );
  });

  it('links the invoice back onto the cached transaction row', async () => {
    const prisma = fakePrisma();
    await createInvoiceFromSumupTransaction(prisma as never, 'b1', 'cache-1', {
      clientName: 'Jean Dupont',
    });
    expect(prisma.sumupTransaction.update).toHaveBeenCalledWith({
      where: { id: 'cache-1' },
      data: { invoiceId: 'inv-new' },
    });
  });

  it('defaults to ISSUED status (money already captured by SumUp)', async () => {
    const prisma = fakePrisma();
    await createInvoiceFromSumupTransaction(prisma as never, 'b1', 'cache-1', {
      clientName: 'Jean Dupont',
    });
    expect(prisma.invoice.create.mock.calls[0][0].data.status).toBe('ISSUED');
  });

  it('falls back to 0% VAT when SumUp reports no vat_amount at all', async () => {
    const prisma = fakePrisma({
      cached: fakeCachedTransaction({ amountCents: 1000, vatAmountCents: null }),
    });
    await createInvoiceFromSumupTransaction(prisma as never, 'b1', 'cache-1', {
      clientName: 'Jean Dupont',
    });
    const createCall = prisma.invoice.create.mock.calls[0][0];
    expect(createCall.data.lines.create[0]).toEqual(
      expect.objectContaining({ unitPriceCents: 1000, taxRate: 0 })
    );
  });

  it('uses the SumUp product summary as the line description when present', async () => {
    const prisma = fakePrisma({
      cached: fakeCachedTransaction({ productSummary: '2x Pizza Regina' }),
    });
    await createInvoiceFromSumupTransaction(prisma as never, 'b1', 'cache-1', {
      clientName: 'Jean Dupont',
    });
    const createCall = prisma.invoice.create.mock.calls[0][0];
    expect(createCall.data.lines.create[0].description).toBe('2x Pizza Regina');
  });
});
