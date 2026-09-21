import { Router, Response } from 'express';
import { Prisma, PrismaClient } from '@prisma/client';
import QRCode from 'qrcode';
import { authenticate, requireRole } from '../middleware/auth';
import { AuthRequest } from '../types';
import { getPublicSiteUrl } from '../lib/public-site-url';

const router = Router();

/**
 * GET /api/tables
 * Get all active tables for the current business, ordered by number.
 * @returns {Table[]}
 */
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma');
    const tables = await prisma.table.findMany({
      where: { businessId: req.user!.businessId, isActive: true },
      orderBy: { number: 'asc' },
    });
    res.json(tables);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/tables
 * Create a new table and generate its QR code for self-ordering.
 * @body {number: string, capacity: number}
 * @returns 201 {Table} with QR code
 */
router.post(
  '/',
  authenticate,
  requireRole('ADMIN', 'MANAGER'),
  async (req: AuthRequest, res: Response) => {
    try {
      const prisma: PrismaClient = req.app.get('prisma');
      const { number, capacity } = req.body;
      const domain = getPublicSiteUrl();

      const table = await prisma.table.create({
        data: { number, capacity, businessId: req.user!.businessId },
      });

      const qrData = `${domain}/menu?table=${encodeURIComponent(table.number)}&tableId=${table.id}`;
      const qrCode = await QRCode.toDataURL(qrData);

      const updated = await prisma.table.update({
        where: { id: table.id },
        data: { qrCode },
      });

      res.status(201).json(updated);
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * PUT /api/tables/:id
 * Update a table's properties.
 * @body {number?, capacity?, status?}
 * @returns {Table}
 */
router.put(
  '/:id',
  authenticate,
  requireRole('ADMIN', 'MANAGER'),
  async (req: AuthRequest, res: Response) => {
    try {
      const prisma: PrismaClient = req.app.get('prisma');
      const existing = await prisma.table.findFirst({
        where: { id: req.params.id, businessId: req.user!.businessId },
      });
      if (!existing) return res.status(404).json({ error: 'Table not found' });

      // Whitelist explicite — jamais businessId/id depuis req.body.
      const { number, capacity, status } = req.body as Prisma.TableUpdateInput;
      const table = await prisma.table.update({
        where: { id: existing.id },
        data: { number, capacity, status },
      });
      res.json(table);
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * DELETE /api/tables/:id
 * Soft-delete a table (sets isActive to false).
 * @returns {message: string}
 */
router.delete(
  '/:id',
  authenticate,
  requireRole('ADMIN', 'MANAGER'),
  async (req: AuthRequest, res: Response) => {
    try {
      const prisma: PrismaClient = req.app.get('prisma');
      const existing = await prisma.table.findFirst({
        where: { id: req.params.id, businessId: req.user!.businessId },
      });
      if (!existing) return res.status(404).json({ error: 'Table not found' });
      await prisma.table.update({
        where: { id: existing.id },
        data: { isActive: false },
      });
      res.json({ message: 'Table removed' });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * PATCH /api/tables/:id/status
 * Update a table's status (AVAILABLE, OCCUPIED, RESERVED, MAINTENANCE).
 * @body {status: TableStatus}
 * @returns {Table}
 */
router.patch('/:id/status', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma');
    const existing = await prisma.table.findFirst({
      where: { id: req.params.id, businessId: req.user!.businessId },
    });
    if (!existing) return res.status(404).json({ error: 'Table not found' });
    const { status } = req.body;
    const table = await prisma.table.update({
      where: { id: existing.id },
      data: { status },
    });
    res.json(table);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/tables/:id/regenerate-qr
 * Regenerate the QR code for a table.
 * @returns {Table} with updated QR code
 * @throws 404 if table not found
 */
router.post(
  '/:id/regenerate-qr',
  authenticate,
  requireRole('ADMIN', 'MANAGER'),
  async (req: AuthRequest, res: Response) => {
    try {
      const prisma: PrismaClient = req.app.get('prisma');
      const domain = getPublicSiteUrl();
      const table = await prisma.table.findFirst({
        where: { id: req.params.id, businessId: req.user!.businessId },
      });
      if (!table) return res.status(404).json({ error: 'Table not found' });

      const qrData = `${domain}/menu?table=${encodeURIComponent(table.number)}&tableId=${table.id}`;
      const qrCode = await QRCode.toDataURL(qrData);

      const updated = await prisma.table.update({
        where: { id: table.id },
        data: { qrCode },
      });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

export default router;
