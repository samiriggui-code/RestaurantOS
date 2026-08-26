import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { authenticate, requireRole } from '../middleware/auth';
import { apiLimiter } from '../middleware/rateLimiter';
import { sanitizeInput, sanitizeHtml } from '../middleware/sanitize';
import { logAction } from '../middleware/auditLog';
import { AuthRequest } from '../types';
import { PrismaClient } from '@prisma/client';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import request from 'supertest';
import express from 'express';
import rateLimit from 'express-rate-limit';

describe('Auth Middleware', () => {
  describe('authenticate', () => {
    let app: express.Application;

    beforeAll(() => {
      app = express();
      app.get('/protected', authenticate, (req: AuthRequest, res) => {
        res.json({ user: req.user });
      });
    });

    it('should attach user to req when JWT is valid', async () => {
      const token = jwt.sign(
        { userId: 'user-1', businessId: 'biz-1', role: 'ADMIN', name: 'Test' },
        process.env.JWT_SECRET!,
        { expiresIn: '1d' }
      );

      const res = await request(app).get('/protected').set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.userId).toBe('user-1');
      expect(res.body.user.role).toBe('ADMIN');
    });

    it('should return 401 when no token provided', async () => {
      const res = await request(app).get('/protected');

      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: 'No token provided', code: 'NO_TOKEN' });
    });

    it('should return 401 when token is expired', async () => {
      const token = jwt.sign(
        { userId: 'user-1', businessId: 'biz-1', role: 'ADMIN', name: 'Test' },
        process.env.JWT_SECRET!,
        { expiresIn: '0s' }
      );

      const res = await request(app).get('/protected').set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
    });

    it('should return 401 when token is malformed', async () => {
      const res = await request(app)
        .get('/protected')
        .set('Authorization', 'Bearer malformed-token');

      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: 'Invalid token', code: 'INVALID_TOKEN' });
    });

    it('should return 401 when auth header does not start with Bearer', async () => {
      const res = await request(app).get('/protected').set('Authorization', 'Basic some-token');

      expect(res.status).toBe(401);
    });
  });

  describe('requireRole', () => {
    let mockReq: Partial<AuthRequest>;
    let mockRes: Partial<Response>;
    let mockNext: jest.Mock;

    beforeEach(() => {
      mockReq = { headers: {}, user: undefined };
      mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };
      mockNext = jest.fn();
    });

    it('should call next when user has required role', () => {
      mockReq.user = { userId: 'user-1', businessId: 'biz-1', role: 'ADMIN', name: 'Test' };

      const middleware = requireRole('ADMIN', 'MANAGER');
      middleware(mockReq as AuthRequest, mockRes as Response, mockNext as NextFunction);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should return 403 when user lacks role', () => {
      mockReq.user = { userId: 'user-1', businessId: 'biz-1', role: 'CASHIER', name: 'Test' };

      const middleware = requireRole('ADMIN', 'MANAGER');
      middleware(mockReq as AuthRequest, mockRes as Response, mockNext as NextFunction);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Insufficient permissions' });
    });

    it('should return 401 when no user on request', () => {
      const middleware = requireRole('ADMIN');
      middleware(mockReq as AuthRequest, mockRes as Response, mockNext as NextFunction);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Not authenticated' });
    });
  });
});

describe('Rate Limiters', () => {
  it('should set rate limit headers on responses', async () => {
    const app = express();
    app.get('/test', apiLimiter, (_req, res) => res.json({ ok: true }));

    const res = await request(app).get('/test');

    expect(res.status).toBe(200);
    expect(res.headers['ratelimit-limit']).toBeDefined();
    expect(res.headers['ratelimit-remaining']).toBeDefined();
  });

  it('should block after exceeding max requests', async () => {
    const testLimiter = rateLimit({
      windowMs: 60 * 1000,
      max: 2,
      message: { error: 'Too many requests, slow down.' },
      standardHeaders: true,
      legacyHeaders: false,
    });

    const app = express();
    app.get('/test', testLimiter, (_req, res) => res.json({ ok: true }));

    await request(app).get('/test').expect(200);
    await request(app).get('/test').expect(200);
    const res = await request(app).get('/test');
    expect(res.status).toBe(429);
    expect(res.body.error).toBe('Too many requests, slow down.');
  });
});

describe('Sanitize Middleware', () => {
  describe('sanitizeInput (deprecated — ne plus monter globalement)', () => {
    it('should escape HTML in req.body strings', () => {
      const req = {
        body: { name: '<script>alert("xss")</script>' },
        query: {},
        params: {},
      } as unknown as AuthRequest;
      const next = jest.fn();
      sanitizeInput(req, {} as unknown as Response, next);
      expect(req.body.name).not.toContain('<script>');
      expect(next).toHaveBeenCalled();
    });

    it('should escape HTML in req.query strings', () => {
      const req = {
        body: {},
        query: { q: '<img onerror="alert(1)" src=x>' },
        params: {},
      } as unknown as AuthRequest;
      const next = jest.fn();
      sanitizeInput(req, {} as unknown as Response, next);
      expect(req.query.q).not.toContain('<img');
      expect(next).toHaveBeenCalled();
    });

    it('should escape HTML in req.params strings', () => {
      const req = {
        body: {},
        query: {},
        params: { id: '<script>alert(1)</script>' },
      } as unknown as AuthRequest;
      const next = jest.fn();
      sanitizeInput(req, {} as unknown as Response, next);
      expect(req.params.id).not.toContain('<script>');
      expect(next).toHaveBeenCalled();
    });

    it('should recursively sanitize nested objects', () => {
      const req = {
        body: { user: { name: '<b>bold</b>', bio: '<script>evil()</script>' } },
        query: {},
        params: {},
      } as unknown as AuthRequest;
      const next = jest.fn();
      sanitizeInput(req, {} as unknown as Response, next);
      expect(req.body.user.name).not.toContain('<b>');
      expect(req.body.user.bio).not.toContain('<script>');
    });

    it('should not modify non-string values', () => {
      const req = {
        body: { count: 42, active: true, price: 19.99 },
        query: {},
        params: {},
      } as unknown as AuthRequest;
      const next = jest.fn();
      sanitizeInput(req, {} as unknown as Response, next);
      expect(req.body.count).toBe(42);
      expect(req.body.active).toBe(true);
      expect(req.body.price).toBe(19.99);
    });

    it('should handle null/undefined gracefully', () => {
      const req = { body: null, query: {}, params: {} } as unknown as AuthRequest;
      const next = jest.fn();
      expect(() => sanitizeInput(req, {} as unknown as Response, next)).not.toThrow();
      expect(next).toHaveBeenCalled();
    });

    it('should handle body being an array', () => {
      const req = {
        body: [{ name: '<script>alert(1)</script>' }],
        query: {},
        params: {},
      } as unknown as AuthRequest;
      const next = jest.fn();
      expect(() => sanitizeInput(req, {} as unknown as Response, next)).not.toThrow();
      expect(next).toHaveBeenCalled();
    });
  });

  describe('sanitizeHtml', () => {
    it('should escape &, <, >, ", and \' characters', () => {
      const result = sanitizeHtml('<script>alert("xss")</script>');
      expect(result).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    });

    it('should escape ampersands first to avoid double-escaping', () => {
      const result = sanitizeHtml('AT&T');
      expect(result).toBe('AT&amp;T');
    });
  });
});

describe('AuditLog Middleware', () => {
  let prisma: DeepMockProxy<PrismaClient>;
  let app: express.Application;

  beforeEach(() => {
    prisma = mockDeep<PrismaClient>();
    app = express();
    app.use(express.json());
    app.set('prisma', prisma);

    app.post('/test-create', logAction('CREATE', 'ORDER'), (req: AuthRequest, res) => {
      res.status(201).json({ success: true, id: 'order-1' });
    });

    app.put('/test-update', logAction('UPDATE', 'ORDER'), (req: AuthRequest, res) => {
      res.json({ success: true });
    });

    app.delete('/test-delete', logAction('DELETE', 'ORDER'), (req: AuthRequest, res) => {
      res.json({ success: true });
    });

    app.post('/test-sensitive', logAction('CREATE', 'USER'), (req: AuthRequest, res) => {
      res.status(201).json({ success: true });
    });

    app.post('/test-bad', logAction('CREATE', 'TEST'), (req: AuthRequest, res) => {
      res.status(400).json({ error: 'bad request' });
    });
  });

  it('should log CREATE action to AuditLog table', async () => {
    (prisma.auditLog.create as jest.Mock).mockResolvedValue({ id: 'log-1' });

    await request(app).post('/test-create').send({ name: 'test item' });

    expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'CREATE',
          entity: 'ORDER',
        }),
      })
    );
  });

  it('should log UPDATE action to AuditLog table', async () => {
    (prisma.auditLog.create as jest.Mock).mockResolvedValue({ id: 'log-1' });

    await request(app).put('/test-update').send({ name: 'updated' });

    expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'UPDATE',
          entity: 'ORDER',
        }),
      })
    );
  });

  it('should log DELETE action to AuditLog table', async () => {
    (prisma.auditLog.create as jest.Mock).mockResolvedValue({ id: 'log-1' });

    await request(app).delete('/test-delete').send();

    expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'DELETE',
          entity: 'ORDER',
        }),
      })
    );
  });

  it('should sanitize sensitive fields from audit log details', async () => {
    (prisma.auditLog.create as jest.Mock).mockResolvedValue({ id: 'log-1' });

    await request(app)
      .post('/test-sensitive')
      .send({ name: 'user', password: 'secret123', token: 'abc', email: 'test@test.com' });

    const callArg = (prisma.auditLog.create as jest.Mock).mock.calls[0][0];
    const details = JSON.parse(callArg.data.details);
    expect(details.body.password).toBeUndefined();
    expect(details.body.token).toBeUndefined();
    expect(details.body.name).toBe('user');
    expect(details.body.email).toBe('test@test.com');
  });

  it('should capture response status code', async () => {
    (prisma.auditLog.create as jest.Mock).mockResolvedValue({ id: 'log-1' });

    await request(app).post('/test-bad').send({});

    const callArg = (prisma.auditLog.create as jest.Mock).mock.calls[0][0];
    const details = JSON.parse(callArg.data.details);
    expect(details.statusCode).toBe(400);
  });
});
