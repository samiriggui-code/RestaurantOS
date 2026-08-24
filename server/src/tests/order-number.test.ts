import { allocateOrderNumber } from '../lib/order-number';

describe('allocateOrderNumber', () => {
  it('reads nextOrderNo then increments', async () => {
    const tx = {
      fiscalSequence: {
        upsert: jest.fn().mockResolvedValue({ businessId: 'biz-1', nextOrderNo: 42 }),
        update: jest.fn().mockResolvedValue({}),
      },
    };

    const n = await allocateOrderNumber(tx as never, 'biz-1');
    expect(n).toBe(42);
    expect(tx.fiscalSequence.upsert).toHaveBeenCalledWith({
      where: { businessId: 'biz-1' },
      create: { businessId: 'biz-1' },
      update: {},
    });
    expect(tx.fiscalSequence.update).toHaveBeenCalledWith({
      where: { businessId: 'biz-1' },
      data: { nextOrderNo: 43 },
    });
  });
});
