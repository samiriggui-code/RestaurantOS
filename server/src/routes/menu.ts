import { Router, Response } from 'express';
import { Prisma, PrismaClient } from '@prisma/client';
import multer, { FileFilterCallback } from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticate, requireRole } from '../middleware/auth';
import { AuthRequest } from '../types';
import {
  INTERNAL_MENU_CATEGORY_FILTER,
  LAZ_PIZZA_CATALOG_EXPECTED,
  syncLazPizzaCatalog,
} from '../lib/sync-lazpizza-catalog';
import { syncPizzaSizeModifiers } from '../lib/sync-pizza-modifiers';
import { syncMenuFormules } from '../lib/sync-menu-formules';
import { logFiscalEvent } from '../lib/fiscal/events';

/** Contrainte FK violée (produit/catégorie encore référencé). Prisma mappe la violation
 * Postgres "23503" (foreign_key_violation) sur son propre code P2003, mais nos FK
 * `ON DELETE RESTRICT` déclenchent "23001" (restrict_violation) que Prisma ne reconnaît
 * pas — l'erreur remonte en PrismaClientUnknownRequestError avec le message Postgres brut. */
function isForeignKeyRestrictError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') return true;
  if (error instanceof Error && /foreign key constraint|restrict_violation/i.test(error.message))
    return true;
  return false;
}

const storage = multer.diskStorage({
  destination: (
    _req: Express.Request,
    _file: Express.Multer.File,
    cb: (error: Error | null, destination: string) => void
  ) => {
    const uploadsDir = process.env.UPLOAD_DIR || path.join(__dirname, '..', '..', 'uploads');
    cb(null, uploadsDir);
  },
  filename: (
    _req: Express.Request,
    file: Express.Multer.File,
    cb: (error: Error | null, filename: string) => void
  ) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `menu-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req: Express.Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only images allowed (jpg, jpeg, png, webp, gif)'));
    }
  },
});

const router = Router();

/**
 * GET /api/menu/categories
 * Get all active categories with their menu items (public).
 * @query {businessId: string}
 * @returns {MenuCategory[]}
 * @throws 400 if businessId missing
 */
router.get('/categories', async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma');
    const businessId = req.query.businessId as string;
    if (!businessId) return res.status(400).json({ error: 'businessId required' });

    const categories = await prisma.menuCategory.findMany({
      where: { businessId, isActive: true, ...INTERNAL_MENU_CATEGORY_FILTER },
      orderBy: { sortOrder: 'asc' },
      include: {
        items: {
          where: { isActive: true, isAvailable: true },
          orderBy: { sortOrder: 'asc' },
          include: {
            modifiers: {
              include: { options: { orderBy: { sortOrder: 'asc' } } },
            },
          },
        },
      },
    });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/menu/categories/manage
 * Toutes les catégories + produits pour le CRM (y compris indisponibles / inactifs).
 */
router.get(
  '/categories/manage',
  authenticate,
  requireRole('ADMIN', 'MANAGER'),
  async (req: AuthRequest, res: Response) => {
    try {
      const prisma: PrismaClient = req.app.get('prisma');
      const businessId = req.user!.businessId;

      const categories = await prisma.menuCategory.findMany({
        where: { businessId, ...INTERNAL_MENU_CATEGORY_FILTER },
        orderBy: { sortOrder: 'asc' },
        include: {
          items: {
            where: { slug: { not: '__snapshot__' } },
            orderBy: { sortOrder: 'asc' },
            include: {
              modifiers: {
                include: { options: { orderBy: { sortOrder: 'asc' } } },
              },
            },
          },
        },
      });

      const itemCount = categories.reduce(
        (n, cat) => n + cat.items.filter(i => i.isActive).length,
        0
      );
      res.json({
        categories,
        stats: {
          categories: categories.length,
          items: itemCount,
          expectedCategories: LAZ_PIZZA_CATALOG_EXPECTED.categories,
          expectedItems: LAZ_PIZZA_CATALOG_EXPECTED.items,
        },
      });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * POST /api/menu/sync-catalog
 * Importe le catalogue flyer (menu-catalog.ts) dans la base.
 */
router.post(
  '/sync-catalog',
  authenticate,
  requireRole('ADMIN', 'MANAGER'),
  async (req: AuthRequest, res: Response) => {
    try {
      const prisma: PrismaClient = req.app.get('prisma');
      const result = await syncLazPizzaCatalog(prisma, req.user!.businessId);
      const modifiers = await syncPizzaSizeModifiers(prisma, req.user!.businessId);
      const formules = await syncMenuFormules(prisma, req.user!.businessId);
      res.json({ success: true, ...result, pizzaModifiers: modifiers, menuFormules: formules });
    } catch (error) {
      console.error('[menu/sync-catalog]', error);
      res.status(500).json({ error: 'Import catalogue impossible' });
    }
  }
);

/**
 * POST /api/menu/categories
 * Create a new menu category.
 * @body {name, nameAr, description?, sortOrder?}
 * @returns 201 {MenuCategory}
 */
router.post(
  '/categories',
  authenticate,
  requireRole('ADMIN', 'MANAGER'),
  async (req: AuthRequest, res: Response) => {
    try {
      const prisma: PrismaClient = req.app.get('prisma');
      const { name, nameAr, description, sortOrder } = req.body;
      const category = await prisma.menuCategory.create({
        data: { name, nameAr, description, sortOrder, businessId: req.user!.businessId },
      });
      res.status(201).json(category);
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * PUT /api/menu/categories/:id
 * Update a menu category by ID.
 * @body {name?, nameAr?, description?, sortOrder?}
 * @returns {MenuCategory}
 */
router.put(
  '/categories/:id',
  authenticate,
  requireRole('ADMIN', 'MANAGER'),
  async (req: AuthRequest, res: Response) => {
    try {
      const prisma: PrismaClient = req.app.get('prisma');
      const cat = await prisma.menuCategory.findFirst({
        where: { id: req.params.id, businessId: req.user!.businessId },
      });
      if (!cat) return res.status(404).json({ error: 'Category not found' });
      // On ne prend que les champs modifiables — jamais businessId depuis req.body.
      const { name, nameAr, description, sortOrder } = req.body as Prisma.MenuCategoryUpdateInput;
      const category = await prisma.menuCategory.update({
        where: { id: cat.id },
        data: { name, nameAr, description, sortOrder },
      });
      res.json(category);
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * DELETE /api/menu/categories/:id
 * Delete a menu category by ID.
 * @returns {message: string}
 */
router.delete(
  '/categories/:id',
  authenticate,
  requireRole('ADMIN', 'MANAGER'),
  async (req: AuthRequest, res: Response) => {
    try {
      const prisma: PrismaClient = req.app.get('prisma');
      const cat = await prisma.menuCategory.findFirst({
        where: { id: req.params.id, businessId: req.user!.businessId },
      });
      if (!cat) return res.status(404).json({ error: 'Category not found' });
      await prisma.menuCategory.delete({ where: { id: cat.id } });
      res.json({ message: 'Category deleted' });
    } catch (error) {
      if (isForeignKeyRestrictError(error)) {
        return res.status(409).json({
          error:
            'Cette catégorie contient encore des produits. Supprimez-les ou déplacez-les vers une autre catégorie avant de la supprimer.',
        });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * POST /api/menu/items
 * Create a new menu item.
 * @body {name, nameAr, description?, descriptionAr?, price, categoryId, ...}
 * @returns 201 {MenuItem}
 */
router.post(
  '/items',
  authenticate,
  requireRole('ADMIN', 'MANAGER'),
  async (req: AuthRequest, res: Response) => {
    try {
      const prisma: PrismaClient = req.app.get('prisma');
      const body = req.body as Record<string, unknown>;
      if (body.vatRateBps !== undefined) {
        const bps = Number(body.vatRateBps);
        if (!Number.isInteger(bps) || bps < 0 || bps > 10000) {
          return res.status(400).json({ error: 'vatRateBps invalide (0–10000 basis points)' });
        }
        body.vatRateBps = bps;
      }
      // La catégorie doit appartenir à l'entreprise de l'appelant, sinon un ADMIN/MANAGER
      // d'une autre entreprise pourrait y rattacher un produit (IDOR cross-tenant).
      const category = await prisma.menuCategory.findFirst({
        where: { id: req.body.categoryId, businessId: req.user!.businessId },
      });
      if (!category) return res.status(400).json({ error: 'Catégorie introuvable' });
      const item = await prisma.menuItem.create({
        data: { ...body, categoryId: category.id } as Prisma.MenuItemUncheckedCreateInput,
      });
      res.status(201).json(item);
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * PUT /api/menu/items/:id
 * Update a menu item by ID.
 * @body {name?, nameAr?, price?, categoryId?, ...}
 * @returns {MenuItem}
 */
router.put(
  '/items/:id',
  authenticate,
  requireRole('ADMIN', 'MANAGER'),
  async (req: AuthRequest, res: Response) => {
    try {
      const prisma: PrismaClient = req.app.get('prisma');
      const existing = await prisma.menuItem.findFirst({
        where: { id: req.params.id, category: { businessId: req.user!.businessId } },
      });
      if (!existing) return res.status(404).json({ error: 'Item not found' });

      const data = { ...req.body } as Record<string, unknown>;
      if (data.vatRateBps !== undefined) {
        const bps = Number(data.vatRateBps);
        if (!Number.isInteger(bps) || bps < 0 || bps > 10000) {
          return res.status(400).json({ error: 'vatRateBps invalide (0–10000 basis points)' });
        }
        data.vatRateBps = bps;
      }
      if (data.categoryId !== undefined) {
        // Empêche de rattacher le produit à une catégorie d'une autre entreprise.
        const targetCategory = await prisma.menuCategory.findFirst({
          where: { id: data.categoryId as string, businessId: req.user!.businessId },
        });
        if (!targetCategory) return res.status(400).json({ error: 'Catégorie introuvable' });
      }
      const item = await prisma.menuItem.update({
        where: { id: existing.id },
        data,
      });

      const newPrice = data.price !== undefined ? Number(data.price) : existing.price;
      if (Number.isFinite(newPrice) && newPrice !== existing.price) {
        void logFiscalEvent(prisma, {
          businessId: req.user!.businessId,
          eventType: 'PRICE_CHANGE',
          operatorId: req.user!.userId,
          entityType: 'MenuItem',
          entityId: item.id,
          payload: {
            name: item.name,
            previousPriceCents: existing.price,
            newPriceCents: newPrice,
          },
        }).catch(err => console.error('[fiscal] PRICE_CHANGE:', err));
      }

      res.json(item);
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * DELETE /api/menu/items/:id
 * Delete a menu item by ID.
 * @returns {message: string}
 */
router.delete(
  '/items/:id',
  authenticate,
  requireRole('ADMIN', 'MANAGER'),
  async (req: AuthRequest, res: Response) => {
    try {
      const prisma: PrismaClient = req.app.get('prisma');
      const item = await prisma.menuItem.findFirst({
        where: { id: req.params.id, category: { businessId: req.user!.businessId } },
      });
      if (!item) return res.status(404).json({ error: 'Item not found' });
      await prisma.menuItem.delete({ where: { id: item.id } });
      res.json({ message: 'Item deleted' });
    } catch (error) {
      if (isForeignKeyRestrictError(error)) {
        return res.status(409).json({
          error:
            "Ce produit a déjà été commandé et ne peut pas être supprimé (historique des commandes). Utilisez « Masquer » pour le retirer du site sans perdre l'historique.",
        });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * PATCH /api/menu/items/:id/toggle
 * Toggle the availability of a menu item.
 * @returns {MenuItem} with updated isAvailable flag
 */
router.patch(
  '/items/:id/toggle',
  authenticate,
  requireRole('ADMIN', 'MANAGER'),
  async (req: AuthRequest, res: Response) => {
    try {
      const prisma: PrismaClient = req.app.get('prisma');
      const item = await prisma.menuItem.findFirst({
        where: { id: req.params.id, category: { businessId: req.user!.businessId } },
      });
      if (!item) return res.status(404).json({ error: 'Item not found' });
      const updated = await prisma.menuItem.update({
        where: { id: item.id },
        data: { isAvailable: !item.isAvailable },
      });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/** PATCH /api/menu/items/:id/visibility — afficher / masquer du catalogue public */
router.patch(
  '/items/:id/visibility',
  authenticate,
  requireRole('ADMIN', 'MANAGER'),
  async (req: AuthRequest, res: Response) => {
    try {
      const prisma: PrismaClient = req.app.get('prisma');
      const item = await prisma.menuItem.findFirst({
        where: { id: req.params.id, category: { businessId: req.user!.businessId } },
      });
      if (!item) return res.status(404).json({ error: 'Item not found' });
      const updated = await prisma.menuItem.update({
        where: { id: item.id },
        data: { isActive: !item.isActive },
      });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/** PATCH /api/menu/categories/:id/toggle — activer / désactiver une catégorie */
router.patch(
  '/categories/:id/toggle',
  authenticate,
  requireRole('ADMIN', 'MANAGER'),
  async (req: AuthRequest, res: Response) => {
    try {
      const prisma: PrismaClient = req.app.get('prisma');
      const cat = await prisma.menuCategory.findFirst({
        where: { id: req.params.id, businessId: req.user!.businessId },
      });
      if (!cat) return res.status(404).json({ error: 'Category not found' });
      const updated = await prisma.menuCategory.update({
        where: { id: cat.id },
        data: { isActive: !cat.isActive },
      });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/** PATCH /api/menu/categories/:id/bulk-items — activer/désactiver tous les articles */
router.patch(
  '/categories/:id/bulk-items',
  authenticate,
  requireRole('ADMIN', 'MANAGER'),
  async (req: AuthRequest, res: Response) => {
    try {
      const prisma: PrismaClient = req.app.get('prisma');
      const { isActive, isAvailable } = req.body as { isActive?: boolean; isAvailable?: boolean };
      const cat = await prisma.menuCategory.findFirst({
        where: { id: req.params.id, businessId: req.user!.businessId },
      });
      if (!cat) return res.status(404).json({ error: 'Category not found' });
      const data: { isActive?: boolean; isAvailable?: boolean } = {};
      if (typeof isActive === 'boolean') data.isActive = isActive;
      if (typeof isAvailable === 'boolean') data.isAvailable = isAvailable;
      if (Object.keys(data).length === 0) {
        return res.status(400).json({ error: 'isActive or isAvailable required' });
      }
      await prisma.menuItem.updateMany({ where: { categoryId: cat.id }, data });
      const items = await prisma.menuItem.findMany({ where: { categoryId: cat.id } });
      res.json({ count: items.length, items });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * POST /api/menu/items/:id/image
 * Upload a menu item image (max 5MB, jpg/jpeg/png/webp/gif).
 * @multipart {image: File}
 * @returns {MenuItem} with updated image URL
 * @throws 400 if no file or invalid file type
 */
router.post(
  '/items/:id/image',
  authenticate,
  requireRole('ADMIN', 'MANAGER'),
  (req: AuthRequest, res: Response) => {
    upload.single('image')(req, res, async (err: Error | string | undefined) => {
      if (err) {
        const message = typeof err === 'string' ? err : err.message;
        return res.status(400).json({ error: message });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'No image file provided' });
      }

      try {
        const prisma: PrismaClient = req.app.get('prisma');
        const existing = await prisma.menuItem.findFirst({
          where: { id: req.params.id, category: { businessId: req.user!.businessId } },
        });
        if (!existing) {
          fs.unlink(req.file.path, () => {});
          return res.status(404).json({ error: 'Item not found' });
        }
        const imageUrl = `/api/uploads/${req.file.filename}`;
        const item = await prisma.menuItem.update({
          where: { id: existing.id },
          data: { image: imageUrl },
        });
        res.json(item);
      } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
      }
    });
  }
);

/**
 * POST /api/menu/items/:id/modifiers
 * Add a modifier group to a menu item.
 * @body {name, nameAr, type, required, min, max, options}
 * @returns 201 {MenuModifier}
 */
router.post(
  '/items/:id/modifiers',
  authenticate,
  requireRole('ADMIN', 'MANAGER'),
  async (req: AuthRequest, res: Response) => {
    try {
      const prisma: PrismaClient = req.app.get('prisma');
      const item = await prisma.menuItem.findFirst({
        where: { id: req.params.id, category: { businessId: req.user!.businessId } },
      });
      if (!item) return res.status(404).json({ error: 'Item not found' });
      const modifier = await prisma.menuModifier.create({
        data: { ...req.body, menuItemId: item.id },
        include: { options: true },
      });
      res.status(201).json(modifier);
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * PUT /api/menu/modifiers/:id
 * Update a modifier group.
 * @body {name?, nameAr?, type?, required?, min?, max?}
 * @returns {MenuModifier}
 */
router.put(
  '/modifiers/:id',
  authenticate,
  requireRole('ADMIN', 'MANAGER'),
  async (req: AuthRequest, res: Response) => {
    try {
      const prisma: PrismaClient = req.app.get('prisma');
      const existing = await prisma.menuModifier.findFirst({
        where: { id: req.params.id, menuItem: { category: { businessId: req.user!.businessId } } },
      });
      if (!existing) return res.status(404).json({ error: 'Modifier not found' });
      // menuItemId n'est jamais modifiable ici — pas de rattachement cross-tenant.
      const body = { ...(req.body as Record<string, unknown>) };
      delete body.menuItemId;
      const modifier = await prisma.menuModifier.update({
        where: { id: existing.id },
        data: body,
        include: { options: true },
      });
      res.json(modifier);
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * DELETE /api/menu/modifiers/:id
 * Delete a modifier group.
 * @returns {message: string}
 */
router.delete(
  '/modifiers/:id',
  authenticate,
  requireRole('ADMIN', 'MANAGER'),
  async (req: AuthRequest, res: Response) => {
    try {
      const prisma: PrismaClient = req.app.get('prisma');
      const existing = await prisma.menuModifier.findFirst({
        where: { id: req.params.id, menuItem: { category: { businessId: req.user!.businessId } } },
      });
      if (!existing) return res.status(404).json({ error: 'Modifier not found' });
      await prisma.menuModifier.delete({ where: { id: existing.id } });
      res.json({ message: 'Modifier deleted' });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

export default router;
