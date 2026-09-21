import request from 'supertest';
import express, { Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { mockDeep, mockReset } from 'jest-mock-extended';
import menuRoutes from '../routes/menu';
import { AuthRequest } from '../types';

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(),
}));

jest.mock('../middleware/auth', () => ({
  authenticate: jest.fn((req: AuthRequest, _res: Response, next: NextFunction) => {
    req.user = { userId: 'user-1', businessId: 'biz-1', role: 'ADMIN', name: 'Admin' };
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
  generateToken: jest.fn(() => 'mock-token'),
  generateRefreshToken: jest.fn(() => 'mock-refresh-token'),
  verifyRefreshToken: jest.fn(() => ({ userId: 'user-1', businessId: 'biz-1', role: 'ADMIN' })),
}));

const prisma = mockDeep<PrismaClient>();

const app = express();
app.use(express.json());
app.set('prisma', prisma);
app.use('/api/menu', menuRoutes);

beforeEach(() => {
  mockReset(prisma);
  (PrismaClient as unknown as jest.Mock).mockImplementation(() => prisma);
});

describe('Menu Routes', () => {
  const mockCategories = [
    {
      id: 'cat-1',
      businessId: 'biz-1',
      name: 'Coffee',
      nameAr: 'قهوة',
      description: null,
      sortOrder: 0,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      items: [
        {
          id: 'item-1',
          categoryId: 'cat-1',
          name: 'Espresso',
          nameAr: 'إسبريسو',
          description: 'Rich coffee shot',
          descriptionAr: 'قهوة غنية',
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
          modifiers: [],
        },
      ],
    },
  ];

  describe('GET /api/menu/categories', () => {
    it('should return list of categories with items', async () => {
      (prisma.menuCategory.findMany as jest.Mock).mockResolvedValue(mockCategories);

      const res = await request(app).get('/api/menu/categories?businessId=biz-1');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].items).toHaveLength(1);
    });

    it('should return 400 when businessId is missing', async () => {
      const res = await request(app).get('/api/menu/categories');
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/menu/categories', () => {
    it('should create a category when user is admin', async () => {
      (prisma.menuCategory.create as jest.Mock).mockResolvedValue({
        id: 'cat-new',
        businessId: 'biz-1',
        name: 'Pastry',
        nameAr: 'معجنات',
        description: null,
        sortOrder: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await request(app)
        .post('/api/menu/categories')
        .send({ name: 'Pastry', nameAr: 'معجنات', sortOrder: 1 });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.name).toBe('Pastry');
    });
  });

  describe('PUT /api/menu/categories/:id', () => {
    it('should update a category', async () => {
      (prisma.menuCategory.findFirst as jest.Mock).mockResolvedValue({
        id: 'cat-1',
        businessId: 'biz-1',
      });
      (prisma.menuCategory.update as jest.Mock).mockResolvedValue({
        id: 'cat-1',
        name: 'Updated Coffee',
        sortOrder: 0,
      });

      const res = await request(app)
        .put('/api/menu/categories/cat-1')
        .send({ name: 'Updated Coffee' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Updated Coffee');
    });

    it('returns 404 for a category from another business', async () => {
      (prisma.menuCategory.findFirst as jest.Mock).mockResolvedValue(null);

      const res = await request(app)
        .put('/api/menu/categories/cat-other-biz')
        .send({ name: 'Hijacked' });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/menu/categories/:id', () => {
    it('should delete a category', async () => {
      (prisma.menuCategory.findFirst as jest.Mock).mockResolvedValue({
        id: 'cat-1',
        businessId: 'biz-1',
      });
      (prisma.menuCategory.delete as jest.Mock).mockResolvedValue({ id: 'cat-1' });

      const res = await request(app).delete('/api/menu/categories/cat-1');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message');
    });

    it('returns 404 for a category from another business', async () => {
      (prisma.menuCategory.findFirst as jest.Mock).mockResolvedValue(null);

      const res = await request(app).delete('/api/menu/categories/cat-other-biz');

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/menu/items', () => {
    it('should create a menu item', async () => {
      (prisma.menuCategory.findFirst as jest.Mock).mockResolvedValue({
        id: 'cat-1',
        businessId: 'biz-1',
      });
      (prisma.menuItem.create as jest.Mock).mockImplementation(
        ({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({
            id: 'item-new',
            categoryId: 'cat-1',
            businessId: 'biz-1',
            name: data.name,
            nameAr: data.nameAr,
            description: null,
            descriptionAr: null,
            price: data.price,
            discountPrice: null,
            image: null,
            barcode: null,
            isAvailable: true,
            isActive: true,
            prepTime: 10,
            sortOrder: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
      );

      const res = await request(app)
        .post('/api/menu/items')
        .send({ name: 'Latte', nameAr: 'لاتيه', price: 18, categoryId: 'cat-1' });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.name).toBe('Latte');
    });

    it('returns 400 when categoryId belongs to another business', async () => {
      (prisma.menuCategory.findFirst as jest.Mock).mockResolvedValue(null);

      const res = await request(app)
        .post('/api/menu/items')
        .send({ name: 'Latte', price: 18, categoryId: 'cat-other-biz' });

      expect(res.status).toBe(400);
    });
  });

  describe('PUT /api/menu/items/:id', () => {
    it('should update a menu item', async () => {
      (prisma.menuItem.findFirst as jest.Mock).mockResolvedValue({
        id: 'item-1',
        name: 'Espresso',
        price: 12,
      });
      (prisma.menuItem.update as jest.Mock).mockResolvedValue({
        id: 'item-1',
        name: 'Double Espresso',
        price: 15,
      });

      const res = await request(app)
        .put('/api/menu/items/item-1')
        .send({ name: 'Double Espresso', price: 15 });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Double Espresso');
    });

    it('returns 404 when the item does not exist', async () => {
      (prisma.menuItem.findFirst as jest.Mock).mockResolvedValue(null);

      const res = await request(app).put('/api/menu/items/missing').send({ name: 'Nope' });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/menu/items/:id', () => {
    it('should delete a menu item', async () => {
      (prisma.menuItem.findFirst as jest.Mock).mockResolvedValue({ id: 'item-1' });
      (prisma.menuItem.delete as jest.Mock).mockResolvedValue({ id: 'item-1' });

      const res = await request(app).delete('/api/menu/items/item-1');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message');
    });

    it('returns 404 for an item from another business', async () => {
      (prisma.menuItem.findFirst as jest.Mock).mockResolvedValue(null);

      const res = await request(app).delete('/api/menu/items/item-other-biz');

      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/menu/items/:id/toggle', () => {
    it('should toggle item availability', async () => {
      (prisma.menuItem.findFirst as jest.Mock).mockResolvedValue({
        id: 'item-1',
        name: 'Espresso',
        isAvailable: true,
      });
      (prisma.menuItem.update as jest.Mock).mockResolvedValue({
        id: 'item-1',
        name: 'Espresso',
        isAvailable: false,
      });

      const res = await request(app).patch('/api/menu/items/item-1/toggle');

      expect(res.status).toBe(200);
      expect(res.body.isAvailable).toBe(false);
    });

    it('should return 404 when item not found', async () => {
      (prisma.menuItem.findFirst as jest.Mock).mockResolvedValue(null);

      const res = await request(app).patch('/api/menu/items/nonexistent/toggle');

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/menu/items/:id/modifiers', () => {
    it('should create a modifier for a menu item', async () => {
      (prisma.menuItem.findFirst as jest.Mock).mockResolvedValue({ id: 'item-1' });
      (prisma.menuModifier.create as jest.Mock).mockResolvedValue({
        id: 'mod-1',
        menuItemId: 'item-1',
        name: 'Size',
        nameAr: 'الحجم',
        type: 'SINGLE',
        required: true,
        min: 1,
        max: 1,
        options: [
          {
            id: 'opt-1',
            modifierId: 'mod-1',
            name: 'Small',
            nameAr: 'صغير',
            price: 0,
            sortOrder: 0,
          },
          {
            id: 'opt-2',
            modifierId: 'mod-1',
            name: 'Large',
            nameAr: 'كبير',
            price: 3,
            sortOrder: 1,
          },
        ],
      });

      const res = await request(app).post('/api/menu/items/item-1/modifiers').send({
        name: 'Size',
        nameAr: 'الحجم',
        type: 'SINGLE',
        required: true,
        min: 1,
        max: 1,
      });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
    });
  });

  describe('PUT /api/menu/modifiers/:id', () => {
    it('should update a modifier', async () => {
      (prisma.menuModifier.findFirst as jest.Mock).mockResolvedValue({ id: 'mod-1' });
      (prisma.menuModifier.update as jest.Mock).mockResolvedValue({
        id: 'mod-1',
        name: 'Size Updated',
        options: [],
      });

      const res = await request(app)
        .put('/api/menu/modifiers/mod-1')
        .send({ name: 'Size Updated' });

      expect(res.status).toBe(200);
    });

    it('returns 404 for a modifier from another business', async () => {
      (prisma.menuModifier.findFirst as jest.Mock).mockResolvedValue(null);

      const res = await request(app)
        .put('/api/menu/modifiers/mod-other-biz')
        .send({ name: 'Hijacked' });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/menu/modifiers/:id', () => {
    it('should delete a modifier', async () => {
      (prisma.menuModifier.findFirst as jest.Mock).mockResolvedValue({ id: 'mod-1' });
      (prisma.menuModifier.delete as jest.Mock).mockResolvedValue({ id: 'mod-1' });

      const res = await request(app).delete('/api/menu/modifiers/mod-1');

      expect(res.status).toBe(200);
    });

    it('returns 404 for a modifier from another business', async () => {
      (prisma.menuModifier.findFirst as jest.Mock).mockResolvedValue(null);

      const res = await request(app).delete('/api/menu/modifiers/mod-other-biz');

      expect(res.status).toBe(404);
    });
  });
});
