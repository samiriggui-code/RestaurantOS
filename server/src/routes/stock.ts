import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { Server as SocketIOServer } from 'socket.io';
import { authenticate } from '../middleware/auth';
import { AuthRequest } from '../types';
import { emitAdminLive } from '../lib/admin-live-events';
import { PERMISSION, requirePermission } from '../lib/permissions';
import { parseRecipeLines } from '../lib/stock-recipe-lines';

const router = Router();

const stockRead = [authenticate, requirePermission(PERMISSION.STOCK_READ)] as const;
const stockWrite = [authenticate, requirePermission(PERMISSION.STOCK_WRITE)] as const;

router.get('/', ...stockRead, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma');
    const items = await prisma.stockItem.findMany({
      where: { businessId: req.user!.businessId },
      orderBy: { name: 'asc' },
      include: { movements: { take: 5, orderBy: { createdAt: 'desc' } } },
    });
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** GET /api/stock/recipe-items — produits menu + nombre de lignes BOM */
router.get('/recipe-items', ...stockRead, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma');
    const items = await prisma.menuItem.findMany({
      where: {
        category: { businessId: req.user!.businessId },
        slug: { not: '__snapshot__' },
      },
      select: {
        id: true,
        name: true,
        isActive: true,
        category: { select: { name: true } },
        _count: { select: { recipes: true } },
      },
      orderBy: [{ category: { sortOrder: 'asc' } }, { sortOrder: 'asc' }],
    });
    res.json(
      items.map(i => ({
        id: i.id,
        name: i.name,
        category: i.category.name,
        isActive: i.isActive,
        recipeLines: i._count.recipes,
      }))
    );
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** GET /api/stock/recipes/:menuItemId — BOM d'une pizza / produit */
router.get('/recipes/:menuItemId', ...stockRead, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma');
    const recipes = await prisma.menuItemRecipe.findMany({
      where: {
        menuItemId: req.params.menuItemId,
        menuItem: { category: { businessId: req.user!.businessId } },
      },
      include: { stockItem: true },
    });
    res.json(recipes);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** PUT /api/stock/recipes/:menuItemId — remplace la recette complète */
router.put('/recipes/:menuItemId', ...stockWrite, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma');
    const menuItemId = req.params.menuItemId;
    const parsed = parseRecipeLines(req.body?.lines);
    if (!parsed.ok) return res.status(400).json({ error: parsed.error });

    const menuItem = await prisma.menuItem.findFirst({
      where: { id: menuItemId, category: { businessId: req.user!.businessId } },
    });
    if (!menuItem) return res.status(404).json({ error: 'Produit introuvable' });

    if (parsed.lines.length > 0) {
      const owned = await prisma.stockItem.count({
        where: {
          businessId: req.user!.businessId,
          id: { in: parsed.lines.map(l => l.stockItemId) },
        },
      });
      if (owned !== parsed.lines.length) {
        return res.status(400).json({ error: 'Un ou plusieurs articles stock sont invalides' });
      }
    }

    await prisma.$transaction(async tx => {
      await tx.menuItemRecipe.deleteMany({ where: { menuItemId } });
      for (const line of parsed.lines) {
        await tx.menuItemRecipe.create({
          data: { menuItemId, stockItemId: line.stockItemId, quantity: line.quantity },
        });
      }
    });

    const recipes = await prisma.menuItemRecipe.findMany({
      where: { menuItemId },
      include: { stockItem: true },
    });
    res.json(recipes);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** POST /api/stock/recipes/sync-defaults — BOM pizzas + boissons (idempotent) */
router.post('/recipes/sync-defaults', ...stockWrite, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma');
    const { syncDefaultPizzeriaRecipes } = await import('../lib/seed-pizzeria-recipes');
    const result = await syncDefaultPizzeriaRecipes(prisma, req.user!.businessId);
    res.json({ ok: true, ...result });
  } catch (error) {
    console.error('Sync default recipes error:', error);
    res.status(500).json({ error: 'Synchronisation recettes impossible' });
  }
});

router.post('/', ...stockWrite, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma');
    const { name, unit, quantity, reorderAt, costCents, menuItemId, category } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Nom obligatoire' });

    const item = await prisma.stockItem.create({
      data: {
        businessId: req.user!.businessId,
        name: name.trim(),
        category: category?.trim() || 'Divers',
        unit: unit?.trim() || 'unité',
        quantity: Number(quantity) || 0,
        reorderAt: reorderAt != null ? Number(reorderAt) : null,
        costCents: Number(costCents) || 0,
        menuItemId: menuItemId || null,
      },
    });
    const io: SocketIOServer = req.app.get('io');
    emitAdminLive(io, req.user!.businessId, {
      domain: 'stock',
      action: 'create',
      label: 'Stock',
      detail: item.name,
    });
    res.status(201).json(item);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** POST /api/stock/:id/move — entrée/sortie/ajustement */
router.post('/:id/move', ...stockWrite, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma');
    const { type, quantity, note } = req.body as { type: string; quantity: number; note?: string };
    if (!['IN', 'OUT', 'ADJUST', 'WASTE'].includes(type)) {
      return res.status(400).json({ error: 'type must be IN, OUT, ADJUST or WASTE' });
    }
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      return res.status(400).json({ error: 'quantity invalid' });
    }

    const existing = await prisma.stockItem.findFirst({
      where: { id: req.params.id, businessId: req.user!.businessId },
    });
    if (!existing) return res.status(404).json({ error: 'Article introuvable' });

    let newQty = existing.quantity;
    if (type === 'IN') newQty += qty;
    else if (type === 'OUT' || type === 'WASTE') newQty -= qty;
    else if (type === 'ADJUST') newQty = qty;

    if (newQty < 0) return res.status(400).json({ error: 'Stock insuffisant' });

    const item = await prisma.$transaction(async tx => {
      const updated = await tx.stockItem.update({
        where: { id: existing.id },
        data: { quantity: newQty },
      });
      await tx.stockMovement.create({
        data: {
          stockItemId: existing.id,
          type,
          quantity: qty,
          note: note?.trim() || null,
        },
      });
      return updated;
    });

    const io: SocketIOServer = req.app.get('io');
    emitAdminLive(io, req.user!.businessId, {
      domain: 'stock',
      action: 'move',
      label: 'Mouvement stock',
      detail: `${existing.name} (${type})`,
    });
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', ...stockWrite, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma');
    const existing = await prisma.stockItem.findFirst({
      where: { id: req.params.id, businessId: req.user!.businessId },
    });
    if (!existing) return res.status(404).json({ error: 'Article introuvable' });

    const body = req.body as Record<string, unknown>;
    const data: Record<string, unknown> = {};
    if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim();
    if (typeof body.category === 'string') data.category = body.category.trim() || 'Divers';
    if (typeof body.unit === 'string' && body.unit.trim()) data.unit = body.unit.trim();
    if (body.reorderAt === null) data.reorderAt = null;
    else if (body.reorderAt != null && Number.isFinite(Number(body.reorderAt))) {
      data.reorderAt = Number(body.reorderAt);
    }
    if (body.costCents != null && Number.isFinite(Number(body.costCents))) {
      data.costCents = Number(body.costCents);
    }
    if (typeof body.isActive === 'boolean') data.isActive = body.isActive;
    if (body.menuItemId === null) data.menuItemId = null;
    else if (typeof body.menuItemId === 'string') data.menuItemId = body.menuItemId;

    const item = await prisma.stockItem.update({
      where: { id: existing.id },
      data,
    });
    const io: SocketIOServer = req.app.get('io');
    emitAdminLive(io, req.user!.businessId, {
      domain: 'stock',
      action: 'update',
      label: 'Stock',
      detail: item.name,
    });
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', ...stockWrite, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma');
    const existing = await prisma.stockItem.findFirst({
      where: { id: req.params.id, businessId: req.user!.businessId },
    });
    if (!existing) return res.status(404).json({ error: 'Article introuvable' });
    await prisma.stockItem.delete({ where: { id: existing.id } });
    const io: SocketIOServer = req.app.get('io');
    emitAdminLive(io, req.user!.businessId, {
      domain: 'stock',
      action: 'delete',
      label: 'Stock',
      detail: existing.name,
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
