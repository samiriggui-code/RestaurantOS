import { assertDriverMayAct, acceptDelivery, confirmDeliveryHandover } from '../lib/driver-actions';

jest.mock('../lib/invoice-from-order');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const invoiceFromOrder = jest.requireMock('../lib/invoice-from-order') as {
  ensureInvoiceForPaidOrder: jest.Mock;
};

describe('assertDriverMayAct', () => {
  it('requires identity when asked', () => {
    expect(assertDriverMayAct({ driverId: null }, null, { requireIdentity: true })).toEqual({
      ok: false,
      status: 401,
      error: 'Identité livreur requise',
    });
  });

  it('blocks another driver on assigned order', () => {
    expect(assertDriverMayAct({ driverId: 'd1' }, 'd2', { requireIdentity: true })).toMatchObject({
      ok: false,
      status: 403,
    });
  });

  it('allows assigned driver', () => {
    expect(assertDriverMayAct({ driverId: 'd1' }, 'd1', { requireIdentity: true })).toBeNull();
  });

  it('compat public: no identity ok if not required', () => {
    expect(assertDriverMayAct({ driverId: 'd1' }, null, { requireIdentity: false })).toBeNull();
  });
});

describe('acceptDelivery', () => {
  it('rejects without READY/OUT_FOR_DELIVERY', async () => {
    const prisma = {
      order: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'o1',
          businessId: 'b1',
          type: 'DELIVERY',
          status: 'PREPARING',
          driverId: null,
        }),
      },
    };
    const result = await acceptDelivery(prisma as never, undefined, {
      orderId: 'o1',
      businessId: 'b1',
      driverUserId: 'd1',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(400);
  });

  it('assigns driver and moves READY → OUT_FOR_DELIVERY', async () => {
    const updated = {
      id: 'o1',
      businessId: 'b1',
      status: 'OUT_FOR_DELIVERY',
      driverId: 'd1',
      orderNumber: 7,
      driver: { id: 'd1', name: 'Alex' },
    };
    const prisma = {
      order: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'o1',
          businessId: 'b1',
          type: 'DELIVERY',
          status: 'READY',
          driverId: null,
          driverTrail: null,
          deliveryHandoverCode: '1234',
          orderNumber: 7,
        }),
        update: jest.fn().mockResolvedValue(updated),
      },
    };
    const io = { to: jest.fn().mockReturnThis(), emit: jest.fn() };
    const result = await acceptDelivery(prisma as never, io as never, {
      orderId: 'o1',
      businessId: 'b1',
      driverUserId: 'd1',
    });
    expect(result.ok).toBe(true);
    expect(prisma.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ driverId: 'd1', status: 'OUT_FOR_DELIVERY' }),
      })
    );
  });
});

describe('confirmDeliveryHandover', () => {
  beforeEach(() => {
    invoiceFromOrder.ensureInvoiceForPaidOrder.mockReset().mockResolvedValue({
      invoice: { id: 'inv-1' },
      created: true,
    });
  });

  it('rejects wrong code', async () => {
    const prisma = {
      order: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'o1',
          businessId: 'b1',
          type: 'DELIVERY',
          status: 'OUT_FOR_DELIVERY',
          driverId: 'd1',
          deliveryHandoverCode: '9999',
          orderNumber: 1,
        }),
      },
    };
    const result = await confirmDeliveryHandover(prisma as never, undefined, {
      businessId: 'b1',
      orderId: 'o1',
      driverUserId: 'd1',
      code: '1111',
      requireIdentity: true,
    });
    expect(result).toMatchObject({ ok: false, status: 400 });
  });

  it('generates the CRM invoice on successful handover (livraison, pas paiement)', async () => {
    const updated = {
      id: 'o1',
      businessId: 'b1',
      status: 'DELIVERED',
      driverId: 'd1',
      orderNumber: 1,
    };
    const prisma = {
      order: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'o1',
          businessId: 'b1',
          type: 'DELIVERY',
          status: 'OUT_FOR_DELIVERY',
          driverId: 'd1',
          deliveryHandoverCode: '1234',
          orderNumber: 1,
        }),
        update: jest.fn().mockResolvedValue(updated),
      },
    };
    const result = await confirmDeliveryHandover(prisma as never, undefined, {
      businessId: 'b1',
      orderId: 'o1',
      driverUserId: 'd1',
      code: '1234',
      requireIdentity: true,
    });
    expect(result).toMatchObject({ ok: true, order: { status: 'DELIVERED' } });
    expect(invoiceFromOrder.ensureInvoiceForPaidOrder).toHaveBeenCalledWith(prisma, 'b1', 'o1');
  });
});
