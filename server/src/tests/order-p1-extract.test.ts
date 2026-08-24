import { assignDriverToOrder } from '../lib/order-assign-driver';
import { cancelOrder, ORDER_CANCEL_REASONS } from '../lib/order-cancel';

describe('order-assign-driver', () => {
  it('rejects empty driverId', async () => {
    const prisma = { order: { findFirst: jest.fn() } };
    const io = { to: jest.fn().mockReturnThis(), emit: jest.fn() };
    const result = await assignDriverToOrder(prisma as never, io as never, {
      orderId: 'o1',
      businessId: 'b1',
      driverId: '  ',
    });
    expect(result).toEqual({ ok: false, status: 400, error: 'Livreur requis' });
    expect(prisma.order.findFirst).not.toHaveBeenCalled();
  });

  it('assigns driver and moves READY → OUT_FOR_DELIVERY', async () => {
    const order = {
      id: 'o1',
      businessId: 'b1',
      type: 'DELIVERY',
      status: 'READY',
      orderNumber: 12,
    };
    const updated = {
      ...order,
      status: 'OUT_FOR_DELIVERY',
      driverId: 'd1',
      items: [],
      table: null,
      driver: { id: 'd1', name: 'Alex' },
    };
    const prisma = {
      order: {
        findFirst: jest.fn().mockResolvedValue(order),
        update: jest.fn().mockResolvedValue(updated),
      },
      user: {
        findFirst: jest.fn().mockResolvedValue({ id: 'd1', name: 'Alex' }),
      },
    };
    const io = { to: jest.fn().mockReturnThis(), emit: jest.fn() };

    const result = await assignDriverToOrder(prisma as never, io as never, {
      orderId: 'o1',
      businessId: 'b1',
      driverId: 'd1',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.order.status).toBe('OUT_FOR_DELIVERY');
    }
    expect(prisma.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          driverId: 'd1',
          status: 'OUT_FOR_DELIVERY',
        }),
      })
    );
  });
});

describe('order-cancel', () => {
  it('exposes cancel reasons', () => {
    expect(ORDER_CANCEL_REASONS).toContain('CLIENT_REFUSED');
  });

  it('rejects already cancelled orders', async () => {
    const prisma = {
      order: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'o1',
          businessId: 'b1',
          status: 'CANCELLED',
          paymentStatus: 'UNPAID',
          items: [],
        }),
      },
    };
    const io = { to: jest.fn().mockReturnThis(), emit: jest.fn() };
    const result = await cancelOrder(prisma as never, io as never, {
      orderId: 'o1',
      businessId: 'b1',
      userId: 'u1',
      reason: 'OTHER',
    });
    expect(result).toEqual({
      ok: false,
      status: 400,
      error: 'Commande déjà clôturée ou annulée',
    });
  });
});
