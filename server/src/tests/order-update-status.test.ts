import { updateOrderStatus } from '../lib/order-update-status';

jest.mock('../lib/invoice-from-order');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const invoiceFromOrder = jest.requireMock('../lib/invoice-from-order') as {
  ensureInvoiceForPaidOrder: jest.Mock;
};

function fakePrisma(existing: Record<string, unknown>, updated: Record<string, unknown>) {
  return {
    order: {
      findFirst: jest.fn().mockResolvedValue(existing),
      update: jest.fn().mockResolvedValue(updated),
      count: jest.fn().mockResolvedValue(0),
    },
    table: { update: jest.fn().mockResolvedValue({}) },
  };
}

const fakeIo = { to: jest.fn().mockReturnThis(), emit: jest.fn() };

describe('updateOrderStatus — invoice on DELIVERED (livraison, pas paiement)', () => {
  beforeEach(() => {
    invoiceFromOrder.ensureInvoiceForPaidOrder.mockReset().mockResolvedValue({
      invoice: { id: 'inv-1' },
      created: true,
    });
  });

  it('generates the invoice when a manager force-delivers a DELIVERY order', async () => {
    const existing = {
      id: 'o1',
      businessId: 'b1',
      type: 'DELIVERY',
      status: 'READY',
      tableId: null,
    };
    const updated = {
      id: 'o1',
      businessId: 'b1',
      type: 'DELIVERY',
      status: 'DELIVERED',
      tableId: null,
      orderNumber: 1,
    };
    const prisma = fakePrisma(existing, updated);

    const result = await updateOrderStatus(prisma as never, fakeIo as never, {
      orderId: 'o1',
      businessId: 'b1',
      status: 'DELIVERED',
      forceDelivered: true,
      actorRole: 'ADMIN',
      actorUserId: 'u1',
    });

    expect(result.ok).toBe(true);
    expect(invoiceFromOrder.ensureInvoiceForPaidOrder).toHaveBeenCalledWith(
      prisma,
      'b1',
      'o1',
      'u1'
    );
  });

  it('does not touch invoicing for a non-DELIVERY order reaching a terminal status', async () => {
    const existing = {
      id: 'o2',
      businessId: 'b1',
      type: 'DINE_IN',
      status: 'READY',
      tableId: null,
    };
    const updated = {
      id: 'o2',
      businessId: 'b1',
      type: 'DINE_IN',
      status: 'COMPLETED',
      tableId: null,
      orderNumber: 2,
    };
    const prisma = fakePrisma(existing, updated);

    await updateOrderStatus(prisma as never, fakeIo as never, {
      orderId: 'o2',
      businessId: 'b1',
      status: 'COMPLETED',
    });

    expect(invoiceFromOrder.ensureInvoiceForPaidOrder).not.toHaveBeenCalled();
  });

  it('does not fire invoicing for a DELIVERY order moving through a non-DELIVERED status', async () => {
    const existing = {
      id: 'o3',
      businessId: 'b1',
      type: 'DELIVERY',
      status: 'CONFIRMED',
      tableId: null,
    };
    const updated = {
      id: 'o3',
      businessId: 'b1',
      type: 'DELIVERY',
      status: 'PREPARING',
      tableId: null,
      orderNumber: 3,
    };
    const prisma = fakePrisma(existing, updated);

    await updateOrderStatus(prisma as never, fakeIo as never, {
      orderId: 'o3',
      businessId: 'b1',
      status: 'PREPARING',
    });

    expect(invoiceFromOrder.ensureInvoiceForPaidOrder).not.toHaveBeenCalled();
  });

  it('still refuses DELIVERED on a DELIVERY order without forceDelivered (driver code path only)', async () => {
    const existing = {
      id: 'o4',
      businessId: 'b1',
      type: 'DELIVERY',
      status: 'OUT_FOR_DELIVERY',
      tableId: null,
    };
    const prisma = fakePrisma(existing, {});

    const result = await updateOrderStatus(prisma as never, fakeIo as never, {
      orderId: 'o4',
      businessId: 'b1',
      status: 'DELIVERED',
    });

    expect(result).toMatchObject({ ok: false, status: 403 });
    expect(invoiceFromOrder.ensureInvoiceForPaidOrder).not.toHaveBeenCalled();
  });
});
