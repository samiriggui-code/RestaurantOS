import {
  getSumupTransactionHistory,
  sumSumupFees,
  type SumupTransaction,
} from '../lib/sumup-transactions';

const originalFetch = global.fetch;

function mockFetchOnce(status: number, body: unknown): jest.Mock {
  const fn = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  });
  global.fetch = fn as unknown as typeof fetch;
  return fn;
}

describe('sumup-transactions / getSumupTransactionHistory', () => {
  const prevKey = process.env.SUMUP_API_KEY;
  const prevMerchant = process.env.SUMUP_MERCHANT_CODE;

  beforeEach(() => {
    process.env.SUMUP_API_KEY = 'sup_sk_test';
    process.env.SUMUP_MERCHANT_CODE = 'MTEST123';
  });

  afterAll(() => {
    global.fetch = originalFetch;
    process.env.SUMUP_API_KEY = prevKey;
    process.env.SUMUP_MERCHANT_CODE = prevMerchant;
  });

  it('builds the request URL with merchant code, date range, limit and payment_types[]', async () => {
    const fetchMock = mockFetchOnce(200, { items: [] });

    await getSumupTransactionHistory({
      oldestTime: '2026-08-01T00:00:00Z',
      newestTime: '2026-09-01T00:00:00Z',
      limit: 50,
      paymentTypes: ['CASH', 'POS'],
      order: 'descending',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/merchants/MTEST123/transactions/history');
    expect(url).toContain('oldest_time=2026-08-01T00%3A00%3A00Z');
    expect(url).toContain('newest_time=2026-09-01T00%3A00%3A00Z');
    expect(url).toContain('limit=50');
    expect(url).toContain('order=descending');
    expect(url).toContain('payment_types%5B%5D=CASH');
    expect(url).toContain('payment_types%5B%5D=POS');
    expect(init.headers.Authorization).toBe('Bearer sup_sk_test');
  });

  it('returns the parsed items on success', async () => {
    mockFetchOnce(200, {
      items: [
        {
          id: 't1',
          transaction_id: 't1',
          transaction_code: 'X',
          amount: 12.5,
          currency: 'EUR',
          timestamp: '2026-08-26T10:00:00Z',
          status: 'SUCCESSFUL',
          payment_type: 'CASH',
        },
      ],
    });

    const result = await getSumupTransactionHistory();
    expect(result.items).toHaveLength(1);
    expect(result.items[0].payment_type).toBe('CASH');
  });

  it('throws a SumupApiError with the SumUp message on a non-2xx response', async () => {
    mockFetchOnce(401, { message: 'Invalid token' });

    await expect(getSumupTransactionHistory()).rejects.toThrow('Invalid token');
  });

  it('refuses to call the API without an API key configured', async () => {
    delete process.env.SUMUP_API_KEY;
    await expect(getSumupTransactionHistory()).rejects.toThrow(/SUMUP_API_KEY/);
  });
});

describe('sumup-transactions / sumSumupFees', () => {
  it('sums fee_amount across transactions, treating missing fees as 0', () => {
    const transactions = [{ fee_amount: 0.25 }, { fee_amount: 0.4 }, {}] as SumupTransaction[];
    expect(sumSumupFees(transactions)).toBeCloseTo(0.65);
  });

  it('returns 0 for an empty list', () => {
    expect(sumSumupFees([])).toBe(0);
  });
});
