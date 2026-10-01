import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, requireRole } from '../middleware/auth';
import { AuthRequest } from '../types';
import { computeDeliveryQuote } from '../lib/delivery-quote';
import { fetchDriversOnDuty } from '../lib/driver-access';
import { fetchDeliveryHistory, type DeliveryHistoryPeriod } from '../lib/delivery-history';

const router = Router();

/**
 * GET /api/delivery/drivers-on-duty — livreurs planifiés / actifs (cuisine, admin)
 */
router.get('/drivers-on-duty', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma');
    const drivers = await fetchDriversOnDuty(prisma, req.user!.businessId);
    res.json({ success: true, drivers });
  } catch (error) {
    console.error('Delivery drivers-on-duty:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/delivery/history?period=day|week|month|year|all&driverName=&search=
 */
router.get(
  '/history',
  authenticate,
  requireRole('ADMIN', 'MANAGER'),
  async (req: AuthRequest, res: Response) => {
    try {
      const prisma: PrismaClient = req.app.get('prisma');
      const period = (String(req.query.period ?? 'month') as DeliveryHistoryPeriod) || 'month';
      const valid: DeliveryHistoryPeriod[] = ['day', 'week', 'month', 'year', 'all'];
      const resolved = valid.includes(period) ? period : 'month';
      const result = await fetchDeliveryHistory(prisma, req.user!.businessId, {
        period: resolved,
        driverName: String(req.query.driverName ?? ''),
        search: String(req.query.search ?? ''),
      });
      res.json({ success: true, ...result });
    } catch (error) {
      console.error('Delivery history:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * GET /api/delivery/zones
 */
router.get('/zones', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma');
    const zones = await prisma.deliveryZone.findMany({
      where: { businessId: req.user!.businessId },
      orderBy: [{ sortOrder: 'asc' }, { city: 'asc' }],
    });
    res.json(zones);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/delivery/zones
 */
router.post(
  '/zones',
  authenticate,
  requireRole('ADMIN', 'MANAGER'),
  async (req: AuthRequest, res: Response) => {
    try {
      const prisma: PrismaClient = req.app.get('prisma');
      const { postalCode, city, feeCents, minOrderCents, isActive, sortOrder } = req.body;

      if (!postalCode?.trim() || !city?.trim()) {
        return res.status(400).json({ error: 'Code postal et commune obligatoires' });
      }

      const zone = await prisma.deliveryZone.create({
        data: {
          businessId: req.user!.businessId,
          postalCode: String(postalCode).trim(),
          city: String(city).trim(),
          feeCents: Number(feeCents) || 0,
          minOrderCents: Number(minOrderCents) || 0,
          isActive: isActive !== false,
          sortOrder: Number(sortOrder) || 0,
        },
      });
      res.status(201).json(zone);
    } catch (error) {
      console.error('Create delivery zone:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * PUT /api/delivery/zones/:id
 */
router.put(
  '/zones/:id',
  authenticate,
  requireRole('ADMIN', 'MANAGER'),
  async (req: AuthRequest, res: Response) => {
    try {
      const prisma: PrismaClient = req.app.get('prisma');
      const existing = await prisma.deliveryZone.findFirst({
        where: { id: req.params.id, businessId: req.user!.businessId },
      });
      if (!existing) return res.status(404).json({ error: 'Zone introuvable' });

      const { postalCode, city, feeCents, minOrderCents, isActive, sortOrder } = req.body;
      const zone = await prisma.deliveryZone.update({
        where: { id: existing.id },
        data: {
          ...(postalCode !== undefined ? { postalCode: String(postalCode).trim() } : {}),
          ...(city !== undefined ? { city: String(city).trim() } : {}),
          ...(feeCents !== undefined ? { feeCents: Number(feeCents) } : {}),
          ...(minOrderCents !== undefined ? { minOrderCents: Number(minOrderCents) } : {}),
          ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
          ...(sortOrder !== undefined ? { sortOrder: Number(sortOrder) } : {}),
        },
      });
      res.json(zone);
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * DELETE /api/delivery/zones/:id
 */
router.delete(
  '/zones/:id',
  authenticate,
  requireRole('ADMIN', 'MANAGER'),
  async (req: AuthRequest, res: Response) => {
    try {
      const prisma: PrismaClient = req.app.get('prisma');
      const existing = await prisma.deliveryZone.findFirst({
        where: { id: req.params.id, businessId: req.user!.businessId },
      });
      if (!existing) return res.status(404).json({ error: 'Zone introuvable' });
      await prisma.deliveryZone.delete({ where: { id: existing.id } });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * GET /api/delivery/quote/test?postalCode=&city=&subtotal=
 * Test devis (admin).
 */
router.get('/quote/test', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma');
    const postalCode = String(req.query.postalCode ?? '');
    const city = String(req.query.city ?? '');
    const subtotal = parseFloat(String(req.query.subtotal ?? '0')) || 0;
    const quote = await computeDeliveryQuote(
      prisma,
      req.user!.businessId,
      postalCode,
      city,
      subtotal
    );
    res.json({ success: true, ...quote });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
