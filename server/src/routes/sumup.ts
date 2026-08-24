import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, requireRole } from '../middleware/auth';
import { logAction } from '../middleware/auditLog';
import { AuthRequest } from '../types';
import { parseBusinessSettings } from '../lib/business-settings';
import {
  getDevicesFromSettings,
  mergeDevicesSettings,
  type DevicesSettings,
} from '../lib/device-settings';
import {
  pairSumupReader,
  getSumupReaderStatus,
  createSumupReaderCheckout,
  getSumupReaderCheckoutStatus,
  terminateSumupReaderCheckout,
  SumupApiError,
} from '../lib/sumup';

const router = Router();

async function loadDevices(prisma: PrismaClient, businessId: string): Promise<DevicesSettings> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { settings: true },
  });
  return getDevicesFromSettings(parseBusinessSettings(business?.settings));
}

async function saveDevices(
  prisma: PrismaClient,
  businessId: string,
  devices: DevicesSettings
): Promise<DevicesSettings> {
  const current = await prisma.business.findUnique({
    where: { id: businessId },
    select: { settings: true },
  });
  const merged = mergeDevicesSettings(parseBusinessSettings(current?.settings), devices);
  await prisma.business.update({ where: { id: businessId }, data: { settings: merged } });
  return merged.devices as DevicesSettings;
}

function sumupErrorResponse(res: Response, error: unknown): Response {
  if (error instanceof SumupApiError) {
    return res.status(error.status >= 400 && error.status < 500 ? error.status : 502).json({
      error: error.message,
    });
  }
  console.error('SumUp error:', error);
  return res.status(500).json({ error: 'Internal server error' });
}

/** POST /api/payments/sumup/pair — appairer un lecteur Solo (code affiché sur le device) */
router.post(
  '/pair',
  authenticate,
  requireRole('ADMIN', 'MANAGER'),
  logAction('CREATE', 'SUMUP_READER_PAIR'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { pairingCode, name } = req.body as { pairingCode?: string; name?: string };
      if (!pairingCode?.trim()) return res.status(400).json({ error: 'pairingCode requis' });

      const label = name?.trim() || 'Lecteur comptoir';
      const reader = await pairSumupReader(pairingCode.trim(), label);

      const prisma: PrismaClient = req.app.get('prisma');
      const devices = await loadDevices(prisma, req.user!.businessId);
      const saved = await saveDevices(prisma, req.user!.businessId, {
        ...devices,
        sumupReader: { id: reader.id, name: reader.name, pairedAt: new Date().toISOString() },
      });

      res.json({ sumupReader: saved.sumupReader });
    } catch (error) {
      sumupErrorResponse(res, error);
    }
  }
);

/** DELETE /api/payments/sumup/reader — dissocier le lecteur */
router.delete(
  '/reader',
  authenticate,
  requireRole('ADMIN', 'MANAGER'),
  logAction('DELETE', 'SUMUP_READER_PAIR'),
  async (req: AuthRequest, res: Response) => {
    try {
      const prisma: PrismaClient = req.app.get('prisma');
      const devices = await loadDevices(prisma, req.user!.businessId);
      const saved = await saveDevices(prisma, req.user!.businessId, {
        ...devices,
        sumupReader: undefined,
      });
      res.json({ sumupReader: saved.sumupReader ?? null });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/** GET /api/payments/sumup/reader/status — état du lecteur appairé */
router.get('/reader/status', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma');
    const devices = await loadDevices(prisma, req.user!.businessId);
    const reader = devices.sumupReader;
    if (!reader) return res.json({ configured: false });

    const status = await getSumupReaderStatus(reader.id);
    res.json({ configured: true, reader, status });
  } catch (error) {
    sumupErrorResponse(res, error);
  }
});

/** POST /api/payments/sumup/checkout — démarre un paiement carte sur le lecteur */
router.post(
  '/checkout',
  authenticate,
  requireRole('ADMIN', 'MANAGER', 'CASHIER'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { amountCents, reference } = req.body as { amountCents?: number; reference?: string };
      if (!Number.isInteger(amountCents) || (amountCents as number) <= 0) {
        return res.status(400).json({ error: 'amountCents invalide' });
      }
      if (!reference?.trim()) return res.status(400).json({ error: 'reference requise' });

      const prisma: PrismaClient = req.app.get('prisma');
      const devices = await loadDevices(prisma, req.user!.businessId);
      const reader = devices.sumupReader;
      if (!reader) return res.status(400).json({ error: 'Aucun lecteur SumUp appairé' });

      const { checkoutId } = await createSumupReaderCheckout(
        reader.id,
        amountCents as number,
        reference.trim()
      );
      res.json({ checkoutId, readerId: reader.id });
    } catch (error) {
      sumupErrorResponse(res, error);
    }
  }
);

/** GET /api/payments/sumup/checkout/:checkoutId — statut (poll) */
router.get('/checkout/:checkoutId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma');
    const devices = await loadDevices(prisma, req.user!.businessId);
    const reader = devices.sumupReader;
    if (!reader) return res.status(400).json({ error: 'Aucun lecteur SumUp appairé' });

    const status = await getSumupReaderCheckoutStatus(reader.id, req.params.checkoutId);
    res.json(status);
  } catch (error) {
    sumupErrorResponse(res, error);
  }
});

/** POST /api/payments/sumup/checkout/:checkoutId/cancel — annule la transaction en cours */
router.post(
  '/checkout/:checkoutId/cancel',
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const prisma: PrismaClient = req.app.get('prisma');
      const devices = await loadDevices(prisma, req.user!.businessId);
      const reader = devices.sumupReader;
      if (!reader) return res.status(400).json({ error: 'Aucun lecteur SumUp appairé' });

      await terminateSumupReaderCheckout(reader.id);
      res.json({ ok: true });
    } catch (error) {
      sumupErrorResponse(res, error);
    }
  }
);

export default router;
