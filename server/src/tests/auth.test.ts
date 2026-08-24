import request from 'supertest';
import express from 'express';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { mockDeep, mockReset } from 'jest-mock-extended';
import authRoutes from '../routes/auth';
import { generateToken, generateRefreshToken } from '../middleware/auth';

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(),
}));

const prisma = mockDeep<PrismaClient>();

const app = express();
app.use(express.json());
app.set('prisma', prisma);
app.use('/api/auth', authRoutes);

beforeEach(() => {
  mockReset(prisma);
  (PrismaClient as unknown as jest.Mock).mockImplementation(() => prisma);
});

describe('Auth Routes', () => {
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

  describe('POST /api/auth/login', () => {
    beforeEach(() => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
    });

    it('should return 200 with access token and user when credentials are valid', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@cafe.com', password: 'admin123' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('user');
      expect(res.body.user.email).toBe('admin@cafe.com');
    });

    it('should return 401 when password is wrong', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@cafe.com', password: 'wrongpassword' });

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('error');
    });

    it('should return 400 when no email or pin is provided', async () => {
      const res = await request(app).post('/api/auth/login').send({});

      expect(res.status).toBe(400);
    });

    it('should return 401 when user is inactive', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ ...mockUser, isActive: false });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@cafe.com', password: 'admin123' });

      expect(res.status).toBe(401);
    });

    it('should return 401 when user is not found', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nobody@cafe.com', password: 'admin123' });

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/auth/register', () => {
    beforeEach(() => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.business.create as jest.Mock).mockResolvedValue({
        id: 'biz-new',
        name: 'New Restaurant',
        nameAr: '',
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
      });
      (prisma.user.create as jest.Mock).mockImplementation(
        ({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({
            id: 'user-new',
            name: data.name,
            email: data.email,
            password: data.password,
            phone: data.phone,
            role: 'ADMIN',
            businessId: data.businessId,
            isActive: true,
            pin: null,
            shiftId: null,
            salaryPeriod: 'MONTHLY',
            salary: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
      );
    });

    it('should create user and business and return 201', async () => {
      const res = await request(app).post('/api/auth/register').send({
        name: 'New User',
        email: 'new@cafe.com',
        password: 'password123',
        phone: '+966500000001',
        businessName: 'New Cafe',
      });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('token');
      expect(res.body).toHaveProperty('user');
      expect(res.body).toHaveProperty('business');
    });

    it('should return 400 when email already exists', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const res = await request(app)
        .post('/api/auth/register')
        .send({ name: 'Duplicate', email: 'admin@cafe.com', password: 'password123' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Email already in use');
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('should return 200 with new tokens when refresh token is valid', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const refreshToken = generateRefreshToken({
        userId: 'user-1',
        businessId: 'biz-1',
        role: 'ADMIN',
        name: 'Admin User',
      });

      const res = await request(app).post('/api/auth/refresh').send({ refreshToken });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
    });

    it('should return 400 when no refresh token is provided', async () => {
      const res = await request(app).post('/api/auth/refresh').send({});
      expect(res.status).toBe(400);
    });

    it('should return 401 when refresh token is invalid', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid-token' });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return the authenticated user', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const token = generateToken({
        userId: 'user-1',
        businessId: 'biz-1',
        role: 'ADMIN',
        name: 'Admin User',
      });

      const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('email', 'admin@cafe.com');
    });

    it('should return 401 without a token', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
    });

    it('should return 404 when authenticated user is not found in database', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const token = generateToken({
        userId: 'nonexistent',
        businessId: 'biz-1',
        role: 'ADMIN',
        name: 'Ghost',
      });

      const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/auth/profile', () => {
    it('should update the user profile name and phone', async () => {
      (prisma.user.update as jest.Mock).mockResolvedValue({
        ...mockUser,
        name: 'Updated Name',
        phone: '+966599999999',
      });

      const token = generateToken({
        userId: 'user-1',
        businessId: 'biz-1',
        role: 'ADMIN',
        name: 'Admin User',
      });

      const res = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Updated Name', phone: '+966599999999' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Updated Name');
    });
  });

  describe('PUT /api/auth/change-password', () => {
    it('should change password when current password is correct', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.user.update as jest.Mock).mockResolvedValue(mockUser);

      const token = generateToken({
        userId: 'user-1',
        businessId: 'biz-1',
        role: 'ADMIN',
        name: 'Admin User',
      });

      const res = await request(app)
        .put('/api/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: 'admin123', newPassword: 'newpass123' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message');
    });

    it('should return 400 when current password is wrong', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const token = generateToken({
        userId: 'user-1',
        businessId: 'biz-1',
        role: 'ADMIN',
        name: 'Admin User',
      });

      const res = await request(app)
        .put('/api/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: 'wrong', newPassword: 'newpass123' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Current password is incorrect');
    });

    it('should return 404 when user is not found', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const token = generateToken({
        userId: 'ghost',
        businessId: 'biz-1',
        role: 'ADMIN',
        name: 'Ghost',
      });

      const res = await request(app)
        .put('/api/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: 'admin123', newPassword: 'newpass123' });

      expect(res.status).toBe(404);
    });
  });
});
