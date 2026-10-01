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

  it('allows DELIVERED for DELIVERY when forceDelivered by MANAGER', async () => {
    const orderUpdate = jest.fn().mockResolvedValue({
      id: 'o1',
      businessId: 'b1',
      type: 'DELIVERY',
      status: 'DELIVERED',
      tableId: null,
      notes: null,
    });
    const prisma = {
      order: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'o1',
          businessId: 'b1',
          type: 'DELIVERY',
          status: 'OUT_FOR_DELIVERY',
          notes: null,
        }),
        update: orderUpdate,
      },
    };
    const io = { to: jest.fn().mockReturnValue({ emit: jest.fn() }) };
    const result = await updateOrderStatus(prisma as never, io as never, {
      orderId: 'o1',
      businessId: 'b1',
      status: 'DELIVERED',
      forceDelivered: true,
      actorRole: 'MANAGER',
      actorUserId: 'u1',
    });
    expect(result.ok).toBe(true);
    expect(orderUpdate).toHaveBeenCalled();
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

  it('zeroes original totals when all items are moved', async () => {
    const item = {
      id: 'oi-1',
      quantity: 1,
      price: 1000,
      menuItem: { vatRateBps: 1000 },
    };
    const orderUpdate = jest.fn().mockResolvedValue({});
    const prisma = {
      business: {
        findUnique: jest.fn().mockResolvedValue({ taxRate: 10, serviceChargeRate: 0 }),
      },
      order: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'o1',
          businessId: 'b1',
          paymentStatus: 'UNPAID',
          type: 'TAKEAWAY',
          priceMode: 'TTC',
          tableId: null,
          customerName: null,
          items: [item],
        }),
        update: orderUpdate,
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({ id: 'split-1', items: [item], table: null })
          .mockResolvedValueOnce({ id: 'o1', items: [], subtotal: 0, table: null }),
      },
      orderItem: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          fiscalSequence: {
            upsert: jest.fn().mockResolvedValue({ nextOrderNo: 10 }),
            update: jest.fn().mockResolvedValue({ nextOrderNo: 11 }),
          },
          order: {
            create: jest.fn().mockResolvedValue({ id: 'split-1', orderNumber: 10 }),
          },
        };
        return fn(tx);
      }),
    };

    const result = await splitOrder(prisma as never, undefined, {
      orderId: 'o1',
      businessId: 'b1',
      splits: [{ items: ['oi-1'] }],
    });

    expect(result.ok).toBe(true);
    expect(orderUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'o1' },
        data: { subtotal: 0, tax: 0, serviceCharge: 0, total: 0 },
      })
    );
  });
});
