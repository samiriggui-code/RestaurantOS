import request from 'supertest';
import express, { Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { mockDeep, mockReset } from 'jest-mock-extended';
import loyaltyRoutes from '../routes/loyalty';
import { AuthRequest } from '../types';

let currentUser = { userId: 'user-1', businessId: 'biz-1', role: 'ADMIN', name: 'Admin' };

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(),
}));

jest.mock('../middleware/auth', () => ({
  authenticate: jest.fn((req: AuthRequest, _res: Response, next: NextFunction) => {
    req.user = currentUser;
    next();
  }),
}));

const prisma = mockDeep<PrismaClient>();

const app = express();
app.use(express.json());
app.set('prisma', prisma);
app.use('/api/loyalty', loyaltyRoutes);

beforeEach(() => {
  mockReset(prisma);
  (PrismaClient as unknown as jest.Mock).mockImplementation(() => prisma);
  currentUser = { userId: 'user-1', businessId: 'biz-1', role: 'ADMIN', name: 'Admin' };
  prisma.$transaction.mockImplementation(((ops: unknown) =>
    Array.isArray(ops) ? Promise.all(ops) : (ops as (tx: unknown) => unknown)(prisma)) as never);
});

describe('DELETE /api/loyalty/customers/:id', () => {
  it('rejects CASHIER — LOYALTY_WRITE is not enough, deletion needs LOYALTY_ADJUST', async () => {
    currentUser.role = 'CASHIER';
    const res = await request(app).delete('/api/loyalty/customers/cust-1');
    expect(res.status).toBe(403);
  });

  it('rejects WAITER', async () => {
    currentUser.role = 'WAITER';
    const res = await request(app).delete('/api/loyalty/customers/cust-1');
    expect(res.status).toBe(403);
  });

  it('404s when the customer does not belong to the caller business', async () => {
    prisma.loyaltyCustomer.findFirst.mockResolvedValue(null);
    const res = await request(app).delete('/api/loyalty/customers/cust-1');
    expect(res.status).toBe(404);
    expect(prisma.loyaltyCustomer.findFirst).toHaveBeenCalledWith({
      where: { id: 'cust-1', businessId: 'biz-1' },
    });
  });

  it('purges loyalty transactions then deletes the customer for ADMIN', async () => {
    prisma.loyaltyCustomer.findFirst.mockResolvedValue({
      id: 'cust-1',
      businessId: 'biz-1',
      programId: 'prog-1',
      phone: '0600000000',
      name: 'Test Client',
      totalPoints: 40,
      totalSpent: 1000,
      visitCount: 2,
      lastVisit: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    const res = await request(app).delete('/api/loyalty/customers/cust-1');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, id: 'cust-1' });
    expect(prisma.loyaltyTransaction.deleteMany).toHaveBeenCalledWith({
      where: { customerId: 'cust-1' },
    });
    expect(prisma.loyaltyCustomer.delete).toHaveBeenCalledWith({ where: { id: 'cust-1' } });
  });

  it('allows MANAGER as well as ADMIN', async () => {
    currentUser.role = 'MANAGER';
    prisma.loyaltyCustomer.findFirst.mockResolvedValue({
      id: 'cust-2',
      businessId: 'biz-1',
    } as never);

    const res = await request(app).delete('/api/loyalty/customers/cust-2');
    expect(res.status).toBe(200);
  });
});
