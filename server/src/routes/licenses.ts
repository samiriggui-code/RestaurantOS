import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { authenticate, requireRole } from '../middleware/auth';
import { AuthRequest } from '../types';

const router = Router();

function generateLicenseKey(): string {
  const segments: string[] = [];
  for (let i = 0; i < 4; i++) {
    segments.push(crypto.randomBytes(4).toString('hex').toUpperCase());
  }
  return segments.join('-');
}

// Get license info (public - no auth needed for verification)
router.post('/verify', async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma');
    const { key, businessId } = req.body;
    const where: Record<string, unknown> = { key };
    if (businessId) where.businessId = businessId;

    const license = await prisma.license.findFirst({ where });
    if (!license) return res.status(404).json({ valid: false, error: 'License not found' });
    if (!license.isActive)
      return res.status(403).json({ valid: false, error: 'License is deactivated' });
    if (new Date() > license.validUntil)
      return res.status(410).json({ valid: false, error: 'License expired' });

    res.json({
      valid: true,
      plan: license.plan,
      maxUsers: license.maxUsers,
      maxBranches: license.maxBranches,
      validUntil: license.validUntil,
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current license
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma');
    const license = await prisma.license.findUnique({
      where: { businessId: req.user!.businessId },
    });
    if (!license) return res.status(404).json({ error: 'No license found' });
    res.json(license);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Generate license (admin only)
router.post('/', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma');
    const { businessId, plan, maxUsers, maxBranches, validDays } = req.body;
    if (!businessId) return res.status(400).json({ error: 'businessId required' });

    const existing = await prisma.license.findUnique({ where: { businessId } });
    if (existing) return res.status(400).json({ error: 'Business already has a license' });

    const key = generateLicenseKey();
    const validFrom = new Date();
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + (validDays || 365));

    const license = await prisma.license.create({
      data: {
        key,
        businessId,
        plan: plan || 'STANDARD',
        maxUsers: maxUsers || 10,
        maxBranches: maxBranches || 1,
        validFrom,
        validUntil,
      },
    });
    res.status(201).json(license);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma');
    const license = await prisma.license.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json(license);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
