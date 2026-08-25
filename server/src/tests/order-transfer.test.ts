import { transferOrder } from '../lib/order-transfer';

function baseOrder(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'o1',
    businessId: 'b1',
    orderNumber: 100,
    type: 'DINE_IN',
    status: 'CONFIRMED',
    paymentStatus: 'UNPAID',
    tableId: 'table-old',
    ...overrides,
  };
}

describe('order-transfer', () => {
  it('rejects when neither tableId nor cashierId is provided', async () => {
    const prisma = { order: { findFirst: jest.fn() } };
    const result = await transferOrder(prisma as never, undefined, {
      orderId: 'o1',
      businessId: 'b1',
    });
    expect(result).toEqual({ ok: false, status: 400, error: 'tableId ou cashierId requis' });
  });

  it('404s when the order is not found', async () => {
    const prisma = { order: { findFirst: jest.fn().mockResolvedValue(null) } };
    const result = await transferOrder(prisma as never, undefined, {
      orderId: 'o1',
      businessId: 'b1',
      tableId: 'table-new',
    });
    expect(result).toEqual({ ok: false, status: 404, error: 'Commande introuvable' });
  });

  it('rejects a paid order', async () => {
    const prisma = {
      order: { findFirst: jest.fn().mockResolvedValue(baseOrder({ paymentStatus: 'PAID' })) },
    };
    const result = await transferOrder(prisma as never, undefined, {
      orderId: 'o1',
      businessId: 'b1',
      tableId: 'table-new',
    });
    expect(result).toEqual({
      ok: false,
      status: 400,
      error: 'Impossible de transférer une commande déjà payée',
    });
  });

  it('rejects a terminal order (e.g. CANCELLED)', async () => {
    const prisma = {
      order: { findFirst: jest.fn().mockResolvedValue(baseOrder({ status: 'CANCELLED' })) },
    };
    const result = await transferOrder(prisma as never, undefined, {
      orderId: 'o1',
      businessId: 'b1',
      tableId: 'table-new',
    });
    expect(result).toEqual({
      ok: false,
      status: 400,
      error: 'Commande déjà clôturée ou annulée',
    });
  });

  it('404s when the target table is not found', async () => {
    const prisma = {
      order: { findFirst: jest.fn().mockResolvedValue(baseOrder()) },
      table: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const result = await transferOrder(prisma as never, undefined, {
      orderId: 'o1',
      businessId: 'b1',
      tableId: 'table-new',
    });
    expect(result).toEqual({ ok: false, status: 404, error: 'Table cible introuvable' });
  });

  it('moves the order, occupies the new table, and frees the old table if no other active order remains', async () => {
    const order = baseOrder();
    const txTableUpdate = jest.fn();
    const txOrderCount = jest.fn().mockResolvedValue(0);
    const updatedOrder = { ...order, tableId: 'table-new' };

    const tx = {
      order: {
        update: jest.fn().mockResolvedValue(updatedOrder),
        count: txOrderCount,
      },
      table: { update: txTableUpdate },
    };

    const prisma = {
      order: { findFirst: jest.fn().mockResolvedValue(order) },
      table: { findFirst: jest.fn().mockResolvedValue({ id: 'table-new' }) },
      $transaction: jest.fn().mockImplementation(async (cb: (tx: unknown) => unknown) => cb(tx)),
    };
    const io = { to: jest.fn().mockReturnValue({ emit: jest.fn() }) };

    const result = await transferOrder(prisma as never, io as never, {
      orderId: 'o1',
      businessId: 'b1',
      tableId: 'table-new',
    });

    expect(result.ok).toBe(true);
    expect(txTableUpdate).toHaveBeenNthCalledWith(1, {
      where: { id: 'table-new' },
      data: { status: 'OCCUPIED' },
    });
    expect(txOrderCount).toHaveBeenCalledWith({
      where: {
        tableId: 'table-old',
        businessId: 'b1',
        status: { notIn: ['COMPLETED', 'DELIVERED', 'CANCELLED'] },
      },
    });
    expect(txTableUpdate).toHaveBeenNthCalledWith(2, {
      where: { id: 'table-old' },
      data: { status: 'AVAILABLE' },
    });
  });

  it('does not free the old table if another active order still occupies it', async () => {
    const order = baseOrder();
    const txTableUpdate = jest.fn();
    const tx = {
      order: {
        update: jest.fn().mockResolvedValue({ ...order, tableId: 'table-new' }),
        count: jest.fn().mockResolvedValue(1),
      },
      table: { update: txTableUpdate },
    };
    const prisma = {
      order: { findFirst: jest.fn().mockResolvedValue(order) },
      table: { findFirst: jest.fn().mockResolvedValue({ id: 'table-new' }) },
      $transaction: jest.fn().mockImplementation(async (cb: (tx: unknown) => unknown) => cb(tx)),
    };

    const result = await transferOrder(prisma as never, undefined, {
      orderId: 'o1',
      businessId: 'b1',
      tableId: 'table-new',
    });

    expect(result.ok).toBe(true);
    // Only the "occupy new table" call — never called to free the old one.
    expect(txTableUpdate).toHaveBeenCalledTimes(1);
    expect(txTableUpdate).toHaveBeenCalledWith({
      where: { id: 'table-new' },
      data: { status: 'OCCUPIED' },
    });
  });

  it('reassigns cashierId without touching the table', async () => {
    const order = baseOrder();
    const txTableUpdate = jest.fn();
    const tx = {
      order: { update: jest.fn().mockResolvedValue({ ...order, cashierId: 'user-2' }) },
      table: { update: txTableUpdate },
    };
    const prisma = {
      order: { findFirst: jest.fn().mockResolvedValue(order) },
      user: { findFirst: jest.fn().mockResolvedValue({ id: 'user-2' }) },
      $transaction: jest.fn().mockImplementation(async (cb: (tx: unknown) => unknown) => cb(tx)),
    };

    const result = await transferOrder(prisma as never, undefined, {
      orderId: 'o1',
      businessId: 'b1',
      cashierId: 'user-2',
    });

    expect(result.ok).toBe(true);
    expect(tx.order.update).toHaveBeenCalledWith({
      where: { id: 'o1' },
      data: { cashierId: 'user-2' },
      include: { items: { include: { menuItem: true } }, table: true },
    });
    expect(txTableUpdate).not.toHaveBeenCalled();
  });
});
