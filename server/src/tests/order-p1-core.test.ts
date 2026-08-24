import { isOnlineCheckout } from '../lib/order-create';
import { splitOrder } from '../lib/order-split';
import { updateOrderStatus } from '../lib/order-update-status';

describe('order-update-status', () => {
  it('blocks DELIVERED for DELIVERY type via staff status patch', async () => {
    const prisma = {
      order: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'o1',
          businessId: 'b1',
          type: 'DELIVERY',
          status: 'OUT_FOR_DELIVERY',
        }),
      },
    };
    const result = await updateOrderStatus(prisma as never, {} as never, {
      orderId: 'o1',
      businessId: 'b1',
      status: 'DELIVERED',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
    }
  });
});

describe('order-create helpers', () => {
  it('detects online checkout for guests', () => {
    expect(isOnlineCheckout(undefined, false)).toBe(true);
    expect(isOnlineCheckout(false, true)).toBe(false);
    expect(isOnlineCheckout(true, true)).toBe(true);
  });
});

describe('order-split', () => {
  it('rejects paid orders', async () => {
    const prisma = {
      order: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'o1',
          paymentStatus: 'PAID',
          items: [],
        }),
      },
    };
    const result = await splitOrder(prisma as never, undefined, {
      orderId: 'o1',
      businessId: 'b1',
      splits: [],
    });
    expect(result).toEqual({
      ok: false,
      status: 400,
      error: 'Cannot split a paid order',
    });
  });
});
