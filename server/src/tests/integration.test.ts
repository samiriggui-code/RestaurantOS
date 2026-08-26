import request from 'supertest';
import express from 'express';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { mockDeep, mockReset } from 'jest-mock-extended';
import authRoutes from '../routes/auth';
import { apiLimiter, authLimiter } from '../middleware/rateLimiter';

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(),
}));

const prisma = mockDeep<PrismaClient>();

function createApp(isProduction = false): express.Application {
  const app = express();
  app.use(express.json());
  app.set('prisma', prisma);

  if (isProduction) {
    process.env.NODE_ENV = 'production';
  }

  app.use('/api/', apiLimiter);
  app.use('/api/auth/login', authLimiter);
  app.use('/api/auth', authRoutes);

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
  });

  app.use('/api/*', (_req, res) => {
    res.status(404).json({ error: 'Route not found' });
  });

  app.use(
    (
      err: { status?: number; message?: string },
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      const isProd = process.env.NODE_ENV === 'production';
      res.status(err.status || 500).json({
        error: isProd ? 'Internal server error' : err.message,
      });
    }
  );

  return app;
}

beforeEach(() => {
  mockReset(prisma);
  (PrismaClient as unknown as jest.Mock).mockImplementation(() => prisma);
  process.env.NODE_ENV = 'test';
});

afterAll(() => {
  delete process.env.NODE_ENV;
});

const runIntegration = process.env.INTEGRATION_TEST === 'true';
const conditionalDescribe = runIntegration ? describe : describe.skip;

conditionalDescribe('Integration Tests', () => {
  const mockUser = {
    id: 'user-1',
    email: 'admin@cafe.com',
    password: bcrypt.hashSync('admin123', 10),
    name: 'Admin User',
    role: 'ADMIN',
    phone: '+966500000000',
    isActive: true,
    businessId: 'biz-1',
    pin: null,
    shiftId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    business: {
      id: 'biz-1',
      name: 'Test Cafe',
      nameAr: 'مقهى اختبار',
      logo: null,
      taxRate: 15,
      serviceChargeRate: 10,
      currency: 'SAR',
      wifiDuration: 120,
      wifiVoucherEnabled: true,
      autoPrintOrders: false,
      kitchenDisplayEnabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };

  describe('Auth Flow', () => {
    it('should login, get a token, and access a protected route', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const app = createApp();

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@cafe.com', password: 'admin123' });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body).toHaveProperty('accessToken');
      const token = loginRes.body.accessToken;

      const meRes = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);

      expect(meRes.status).toBe(200);
      expect(meRes.body).toHaveProperty('email', 'admin@cafe.com');
    });
  });

  describe('404 Handler', () => {
    it('should return 404 for unknown API routes', async () => {
      const app = createApp();

      const res = await request(app).get('/api/nonexistent-route');

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error', 'Route not found');
    });
  });

  describe('Error Handler', () => {
    it('should return error message in non-production mode', async () => {
      const app = createApp(false);
      app.get('/api/trigger-error', () => {
        throw new Error('Test error details');
      });

      const res = await request(app).get('/api/trigger-error');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Test error details');
    });

    it('should hide stack traces in production mode', async () => {
      const app = createApp(true);
      app.get('/api/trigger-error', () => {
        throw new Error('Sensitive details');
      });

      const res = await request(app).get('/api/trigger-error');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Internal server error');
      expect(res.body.error).not.toContain('Sensitive details');

      process.env.NODE_ENV = 'test';
    });
  });
});
