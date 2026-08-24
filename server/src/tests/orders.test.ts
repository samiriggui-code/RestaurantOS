import request from 'supertest';
import express, { Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { mockDeep, mockReset } from 'jest-mock-extended';
import orderRoutes from '../routes/orders';
import { AuthRequest } from '../types';

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(),
}));

jest.mock('../lib/fiscal/auto-void', () => ({
  voidFiscalTicketForCancelledOrder: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../lib/fiscal/hook-paid-order', () => ({
  requireFiscalTicketForPaidOrder: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../lib/fiscal/guards', () => ({
  assertOrderFiscallyMutable: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../lib/fiscal/payment-validation', () => ({
  assertManualCardPaymentMeta: jest.fn(),
}));

jest.mock('../lib/invoice-from-order', () => ({
  ensureInvoiceForPaidOrder: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../lib/loyalty-order', () => ({
  ensureLoyaltyCreditForPaidOrder: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../lib/enqueue-order-prints', () => ({
  enqueueConfirmedOrderPrints: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../lib/stock-deduct-alerts', () => ({
  deductStockWithAlerts: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../lib/sumup-refund', () => ({
  refundSumupPaymentForOrder: jest.fn().mockResolvedValue({ ok: true }),
}));

jest.mock('../lib/order-stock', () => ({
  restoreStockForOrder: jest.fn().mockResolvedValue(undefined),
  deductStockForOrder: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../middleware/auth', () => ({
  authenticate: jest.fn((req: AuthRequest, _res: Response, next: NextFunction) => {
    req.user = { userId: 'user-1', businessId: 'biz-1', role: 'ADMIN', name: 'Admin' };
    next();
  }),
  optionalAuthenticate: jest.fn((req: AuthRequest, _res: Response, next: NextFunction) => {
    if (req.headers.authorization?.startsWith('Bearer ')) {
      req.user = { userId: 'user-1', businessId: 'biz-1', role: 'CASHIER', name: 'Caisse' };
    }
    next();
  }),
  requireRole: jest.fn((...roles: string[]) => {
    return (req: AuthRequest, res: Response, next: NextFunction): void => {
      if (!req.user || !roles.includes(req.user.role)) {
        res.status(403).json({ error: 'Insufficient permissions' });
        return;
      }
      next();
    };
  }),
}));

const prisma = mockDeep<PrismaClient>();
const mockIo = {
  to: jest.fn().mockReturnThis(),
  emit: jest.fn(),
  on: jest.fn(),
};

const app = express();
app.use(express.json());
app.set('prisma', prisma);
app.set('io', mockIo);
app.use('/api/orders', orderRoutes);

beforeEach(() => {
  mockReset(prisma);
  (PrismaClient as unknown as jest.Mock).mockImplementation(() => prisma);
  mockIo.to.mockClear();
  mockIo.emit.mockClear();
  (prisma.$transaction as jest.Mock).mockImplementation(
    async (fn: (tx: typeof prisma) => unknown) => fn(prisma)
  );
  (prisma.fiscalSequence.upsert as jest.Mock).mockResolvedValue({
    businessId: 'biz-1',
    nextOrderNo: 1002,
  });
  (prisma.fiscalSequence.update as jest.Mock).mockResolvedValue({});
});

describe('Order Routes', () => {
  const mockMenuItem = {
    id: 'item-1',
    categoryId: 'cat-1',
    name: 'Espresso',
    nameAr: 'إسبريسو',
    description: 'Rich coffee shot',
    descriptionAr: null,
    price: 12.0,
    discountPrice: null,
    image: null,
    barcode: null,
    isAvailable: true,
    isActive: true,
    prepTime: 5,
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockOrder = {
    id: 'order-1',
    businessId: 'biz-1',
    orderNumber: 1001,
    tableId: null,
    cashierId: 'user-1',
    customerName: 'John',
    customerPhone: '+966500000000',
    customerEmail: null,
    type: 'DINE_IN',
    status: 'CONFIRMED',
    paymentStatus: 'UNPAID',
    paymentMethod: null,
    sumupCheckoutId: null,
    subtotal: 24.0,
    tax: 3.6,
    serviceCharge: 2.4,
    discount: 0,
    total: 30.0,
    notes: null,
    isOnlineOrder: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockSettings = {
    id: 'biz-1',
    name: 'Test Cafe',
    taxRate: 15,
    serviceChargeRate: 10,
  };

  describe('POST /api/orders', () => {
    it('should create an order and return 201', async () => {
      (prisma.menuItem.findUnique as jest.Mock).mockResolvedValue(mockMenuItem);
      (prisma.business.findUnique as jest.Mock).mockResolvedValue(mockSettings);
      (prisma.order.create as jest.Mock).mockImplementation(
        ({ data, include: _include }: { data: Record<string, unknown>; include?: unknown }) =>
          Promise.resolve({
            ...mockOrder,
            id: 'new-order',
            orderNumber: 1002,
            type: data.type,
            items: [],
            table: null,
          })
      );

      const res = await request(app)
        .post('/api/orders')
        .send({
          businessId: 'biz-1',
          items: [{ menuItemId: 'item-1', quantity: 2 }],
          type: 'DINE_IN',
          customerName: 'John',
          customerPhone: '+966500000000',
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('orderNumber');
    });

    it('should return 400 when businessId is missing', async () => {
      const res = await request(app)
        .post('/api/orders')
        .send({ items: [{ menuItemId: 'item-1', quantity: 1 }] });

      expect(res.status).toBe(400);
    });

    it('should return 400 when item is not available', async () => {
      (prisma.menuItem.findUnique as jest.Mock).mockResolvedValue({
        ...mockMenuItem,
        isAvailable: false,
      });

      const res = await request(app)
        .post('/api/orders')
        .send({
          businessId: 'biz-1',
          items: [{ menuItemId: 'item-1', quantity: 1 }],
        });

      expect(res.status).toBe(400);
    });

    it('should update table status to OCCUPIED when tableId is provided', async () => {
      (prisma.menuItem.findUnique as jest.Mock).mockResolvedValue(mockMenuItem);
      (prisma.business.findUnique as jest.Mock).mockResolvedValue(mockSettings);
      (prisma.order.create as jest.Mock).mockResolvedValue({
        ...mockOrder,
        id: 'new-order',
        tableId: 'table-1',
        items: [],
        table: null,
      });
      (prisma.table.update as jest.Mock).mockResolvedValue({ id: 'table-1', status: 'OCCUPIED' });

      const res = await request(app)
        .post('/api/orders')
        .send({
          businessId: 'biz-1',
          tableId: 'table-1',
          items: [{ menuItemId: 'item-1', quantity: 2 }],
          type: 'DINE_IN',
        });

      expect(res.status).toBe(201);
      expect(prisma.table.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'table-1' },
          data: { status: 'OCCUPIED' },
        })
      );
    });

    it('should create counter order as CONFIRMED and emit order:new', async () => {
      (prisma.menuItem.findUnique as jest.Mock).mockResolvedValue(mockMenuItem);
      (prisma.business.findUnique as jest.Mock).mockResolvedValue(mockSettings);
      (prisma.order.create as jest.Mock).mockImplementation(
        ({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({
            ...mockOrder,
            id: 'counter-order',
            status: data.status,
            paymentStatus: data.paymentStatus,
            isOnlineOrder: data.isOnlineOrder,
            items: [],
            table: null,
          })
      );

      const res = await request(app)
        .post('/api/orders')
        .set('Authorization', 'Bearer staff-token')
        .send({
          items: [{ menuItemId: 'item-1', quantity: 1 }],
          type: 'TAKEAWAY',
          paymentMethod: 'CASH',
          paymentStatus: 'PAID',
          isOnlineOrder: false,
        });

      expect(res.status).toBe(201);
      expect(prisma.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'CONFIRMED',
            paymentStatus: 'PAID',
            isOnlineOrder: false,
          }),
        })
      );
      expect(mockIo.emit).toHaveBeenCalledWith(
        'order:new',
        expect.objectContaining({ id: 'counter-order' })
      );
    });
  });

  describe('GET /api/orders', () => {
    it('should return list of orders', async () => {
      (prisma.order.findMany as jest.Mock).mockResolvedValue([mockOrder]);

      const res = await request(app).get('/api/orders');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should filter orders by status', async () => {
      (prisma.order.findMany as jest.Mock).mockResolvedValue([mockOrder]);

      const res = await request(app).get('/api/orders?status=CONFIRMED');

      expect(res.status).toBe(200);
      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'CONFIRMED' }),
        })
      );
    });
  });

  describe('GET /api/orders/:id', () => {
    it('should return a single order', async () => {
      (prisma.order.findFirst as jest.Mock).mockResolvedValue(mockOrder);

      const res = await request(app).get('/api/orders/order-1');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('id', 'order-1');
    });

    it('should return 404 when order is not found', async () => {
      (prisma.order.findFirst as jest.Mock).mockResolvedValue(null);

      const res = await request(app).get('/api/orders/nonexistent');
      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/orders/:id/status', () => {
    it('should update order status', async () => {
      (prisma.order.findFirst as jest.Mock).mockResolvedValue({
        ...mockOrder,
        status: 'CONFIRMED',
      });
      (prisma.order.update as jest.Mock).mockResolvedValue({
        ...mockOrder,
        id: 'order-1',
        status: 'PREPARING',
        items: [],
        table: null,
      });

      const res = await request(app)
        .patch('/api/orders/order-1/status')
        .send({ status: 'PREPARING' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('PREPARING');
    });

    it('should free the table when status is DELIVERED with no remaining active orders', async () => {
      (prisma.order.findFirst as jest.Mock).mockResolvedValue({
        ...mockOrder,
        type: 'TAKEAWAY',
        status: 'READY',
        tableId: 'table-1',
      });
      (prisma.order.update as jest.Mock).mockResolvedValue({
        ...mockOrder,
        id: 'order-1',
        tableId: 'table-1',
        status: 'DELIVERED',
        items: [],
        table: null,
      });
      (prisma.order.count as jest.Mock).mockResolvedValue(0);
      (prisma.table.update as jest.Mock).mockResolvedValue({ id: 'table-1', status: 'AVAILABLE' });

      const res = await request(app)
        .patch('/api/orders/order-1/status')
        .send({ status: 'DELIVERED' });

      expect(res.status).toBe(200);
    });
  });

  describe('PATCH /api/orders/:orderId/items/:itemId/status', () => {
    it('should update an order item status', async () => {
      (prisma.orderItem.update as jest.Mock).mockResolvedValue({
        id: 'oi-1',
        status: 'PREPARING',
        menuItem: mockMenuItem,
      });
      (prisma.order.findUnique as jest.Mock).mockResolvedValue({
        ...mockOrder,
        items: [{ id: 'oi-1', status: 'PREPARING', menuItem: mockMenuItem }],
        table: null,
      });

      const res = await request(app)
        .patch('/api/orders/order-1/items/oi-1/status')
        .send({ status: 'PREPARING' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('PREPARING');
    });
  });

  describe('PATCH /api/orders/:id/payment', () => {
    it('should update payment status', async () => {
      (prisma.order.findFirst as jest.Mock).mockResolvedValue({
        ...mockOrder,
        items: [],
        table: null,
      });
      (prisma.order.update as jest.Mock).mockResolvedValue({
        ...mockOrder,
        paymentStatus: 'PAID',
        paymentMethod: 'CASH',
        items: [],
        table: null,
      });
      (prisma.order.count as jest.Mock).mockResolvedValue(0);
      (prisma.table.update as jest.Mock).mockResolvedValue({ id: 'table-1', status: 'AVAILABLE' });

      const res = await request(app)
        .patch('/api/orders/order-1/payment')
        .send({ paymentStatus: 'PAID', paymentMethod: 'CASH' });

      expect(res.status).toBe(200);
      expect(res.body.paymentStatus).toBe('PAID');
    });
  });

  describe('PATCH /api/orders/:id/cancel', () => {
    it('should cancel an order with reason', async () => {
      const existingOrder = {
        ...mockOrder,
        status: 'PREPARING',
        paymentStatus: 'PAID',
        items: [{ menuItemId: 'item-1', quantity: 1 }],
        table: null,
      };
      (prisma.order.findFirst as jest.Mock).mockResolvedValue(existingOrder);
      (prisma.$transaction as jest.Mock).mockImplementation(async fn =>
        fn({
          order: {
            update: jest.fn().mockResolvedValue({
              ...existingOrder,
              status: 'CANCELLED',
              cancelReason: 'OUT_OF_STOCK',
              items: [],
              table: null,
            }),
          },
          stockItem: { findMany: jest.fn().mockResolvedValue([]) },
          stockMovement: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn() },
          table: { update: jest.fn() },
        })
      );

      const res = await request(app)
        .patch('/api/orders/order-1/cancel')
        .send({ reason: 'OUT_OF_STOCK', source: 'KITCHEN' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('CANCELLED');
      expect(mockIo.emit).toHaveBeenCalledWith('order:cancelled', expect.any(Object));
      expect(mockIo.emit).toHaveBeenCalledWith('order:statusUpdate', expect.any(Object));
    });

    it('should reject cancel without reason', async () => {
      const res = await request(app).patch('/api/orders/order-1/cancel').send({});
      expect(res.status).toBe(400);
    });

    it('should free the table when cancelling a dine-in order with table', async () => {
      const tableUpdate = jest.fn().mockResolvedValue({ id: 'table-1', status: 'AVAILABLE' });
      const existingOrder = {
        ...mockOrder,
        tableId: 'table-1',
        status: 'CONFIRMED',
        items: [],
        table: { id: 'table-1', number: 5 },
      };
      (prisma.order.findFirst as jest.Mock).mockResolvedValue(existingOrder);
      (prisma.$transaction as jest.Mock).mockImplementation(async fn =>
        fn({
          order: {
            update: jest.fn().mockResolvedValue({
              ...existingOrder,
              status: 'CANCELLED',
              items: [],
              table: null,
            }),
          },
          stockItem: { findMany: jest.fn().mockResolvedValue([]) },
          stockMovement: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn() },
          table: { update: tableUpdate },
        })
      );

      const res = await request(app)
        .patch('/api/orders/order-1/cancel')
        .send({ reason: 'CLIENT_REFUSED' });

      expect(res.status).toBe(200);
      expect(tableUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'table-1' },
          data: { status: 'AVAILABLE' },
        })
      );
    });
  });

  describe('GET /api/orders/track/:orderNumber', () => {
    it('should return order details by order number', async () => {
      (prisma.order.findFirst as jest.Mock).mockResolvedValue(mockOrder);

      const res = await request(app).get('/api/orders/track/1001?businessId=biz-1');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('orderNumber', 1001);
    });

    it('should return 404 when order is not found', async () => {
      (prisma.order.findFirst as jest.Mock).mockResolvedValue(null);

      const res = await request(app).get('/api/orders/track/9999?businessId=biz-1');
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/orders/call-waiter', () => {
    it('should emit waiter:called event and return success', async () => {
      (prisma.table.findUnique as jest.Mock).mockResolvedValue({
        id: 'table-1',
        number: '5',
        businessId: 'biz-1',
      });

      const res = await request(app)
        .post('/api/orders/call-waiter')
        .send({ tableId: 'table-1', businessId: 'biz-1', message: 'Water please' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockIo.emit).toHaveBeenCalledWith(
        'waiter:called',
        expect.objectContaining({
          tableNumber: '5',
          message: 'Water please',
        })
      );
    });
  });

  describe('GET /api/orders/active', () => {
    it('should return active order for a table', async () => {
      (prisma.order.findFirst as jest.Mock).mockResolvedValue(mockOrder);

      const res = await request(app).get('/api/orders/active?tableId=table-1&businessId=biz-1');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('id', 'order-1');
    });

    it('should return 404 when tableId or businessId is missing (catches /:id first)', async () => {
      const res = await request(app).get('/api/orders/active');
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/orders/:id/items', () => {
    it('should add items to an existing order', async () => {
      (prisma.order.findUnique as jest.Mock).mockResolvedValueOnce({
        ...mockOrder,
        table: null,
      });
      (prisma.menuItem.findUnique as jest.Mock).mockResolvedValue(mockMenuItem);
      (prisma.business.findUnique as jest.Mock).mockResolvedValue(mockSettings);
      (prisma.order.update as jest.Mock).mockResolvedValue({
        ...mockOrder,
        items: [{ id: 'oi-2', menuItem: mockMenuItem }],
        table: null,
      });
      (prisma.table.update as jest.Mock).mockResolvedValue({ id: 'table-1', status: 'OCCUPIED' });

      const res = await request(app)
        .post('/api/orders/order-1/items')
        .send({ items: [{ menuItemId: 'item-1', quantity: 1 }] });

      expect(res.status).toBe(200);
    });

    it('should return 404 when order is not found', async () => {
      (prisma.order.findUnique as jest.Mock).mockResolvedValue(null);

      const res = await request(app)
        .post('/api/orders/nonexistent/items')
        .send({ items: [{ menuItemId: 'item-1', quantity: 1 }] });

      expect(res.status).toBe(404);
    });

    it('should return 400 when adding items to delivered order', async () => {
      (prisma.order.findUnique as jest.Mock).mockResolvedValue({
        ...mockOrder,
        status: 'DELIVERED',
        table: null,
      });

      const res = await request(app)
        .post('/api/orders/order-1/items')
        .send({ items: [{ menuItemId: 'item-1', quantity: 1 }] });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/orders/customer/:phone', () => {
    it('should return orders for a customer phone', async () => {
      (prisma.order.findMany as jest.Mock).mockResolvedValue([mockOrder]);

      const res = await request(app).get('/api/orders/customer/+966500000000?businessId=biz-1');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('POST /api/orders/:id/split', () => {
    it('should split order items into new orders', async () => {
      (prisma.order.findFirst as jest.Mock).mockResolvedValue({
        ...mockOrder,
        paymentStatus: 'UNPAID',
        items: [
          { id: 'oi-1', menuItemId: 'item-1', price: 12, quantity: 2, menuItem: mockMenuItem },
        ],
        table: { id: 'table-1', number: '5' },
      });
      (prisma.business.findUnique as jest.Mock).mockResolvedValue(mockSettings);
      (prisma.order.create as jest.Mock).mockImplementation(
        ({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({ id: 'split-order-1', ...data, items: [], table: null })
      );
      (prisma.orderItem.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
      (prisma.order.findUnique as jest.Mock).mockResolvedValue({
        ...mockOrder,
        id: 'split-order-1',
        items: [{ id: 'oi-1', menuItem: mockMenuItem }],
        table: null,
      });
      (prisma.order.update as jest.Mock).mockResolvedValue(mockOrder);

      const res = await request(app)
        .post('/api/orders/order-1/split')
        .send({ splits: [{ items: ['oi-1'] }] });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('original');
      expect(res.body).toHaveProperty('splits');
    });
  });
});
