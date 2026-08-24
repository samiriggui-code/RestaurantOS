import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { Server as SocketIOServer } from 'socket.io';
import { AuthRequest } from '../types';
import { getBusinessId } from '../lib/business';
import { isDriverAccessAuthorized, resolveDriverUserId } from '../lib/driver-access';
import {
  acceptDelivery,
  confirmDeliveryHandover,
  reportDeliveryIssue,
  updateDriverLocation,
} from '../lib/driver-actions';

const router = Router();

type DriverReq = AuthRequest & { driverUserId?: string | null };

async function attachDriverSession(req: DriverReq, res: Response): Promise<boolean> {
  const prisma: PrismaClient = req.app.get('prisma');
  const businessId = getBusinessId();
  const ok = await isDriverAccessAuthorized(req, prisma, businessId);
  if (!ok) {
    res.status(401).json({ error: 'Accès livreur requis (PIN ou session staff)' });
    return false;
  }
  req.driverUserId = await resolveDriverUserId(req, prisma, businessId);
  return true;
}

/**
 * POST /api/driver/orders/:id/accept
 * Prise en charge stricte (identité obligatoire).
 */
router.post('/orders/:id/accept', async (req: AuthRequest, res: Response) => {
  try {
    const dreq = req as DriverReq;
    if (!(await attachDriverSession(dreq, res))) return;
    const prisma: PrismaClient = req.app.get('prisma');
    const io: SocketIOServer = req.app.get('io');
    if (!dreq.driverUserId) {
      return res.status(401).json({ error: 'Identité livreur requise' });
    }

    const result = await acceptDelivery(prisma, io, {
      orderId: req.params.id,
      businessId: getBusinessId(),
      driverUserId: dreq.driverUserId,
    });
    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }
    return res.json({ success: true, order: result.order });
  } catch (error) {
    console.error('[driver/accept]', error);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * POST /api/driver/orders/:id/location
 * @body { lat, lng }
 */
router.post('/orders/:id/location', async (req: AuthRequest, res: Response) => {
  try {
    const dreq = req as DriverReq;
    if (!(await attachDriverSession(dreq, res))) return;
    const prisma: PrismaClient = req.app.get('prisma');
    const io: SocketIOServer = req.app.get('io');
    const { lat, lng } = req.body as { lat?: number; lng?: number };

    const result = await updateDriverLocation(prisma, io, {
      businessId: getBusinessId(),
      orderId: req.params.id,
      driverUserId: dreq.driverUserId ?? null,
      lat: Number(lat),
      lng: Number(lng),
      requireIdentity: true,
    });
    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }
    return res.json({ success: true, order: result.order });
  } catch (error) {
    console.error('[driver/location]', error);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * POST /api/driver/orders/:id/confirm
 * @body { code }
 */
router.post('/orders/:id/confirm', async (req: AuthRequest, res: Response) => {
  try {
    const dreq = req as DriverReq;
    if (!(await attachDriverSession(dreq, res))) return;
    const prisma: PrismaClient = req.app.get('prisma');
    const io: SocketIOServer = req.app.get('io');
    const { code } = req.body as { code?: string };

    const result = await confirmDeliveryHandover(prisma, io, {
      businessId: getBusinessId(),
      orderId: req.params.id,
      driverUserId: dreq.driverUserId ?? null,
      code: code ?? '',
      requireIdentity: true,
    });
    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }
    return res.json({ success: true, order: result.order });
  } catch (error) {
    console.error('[driver/confirm]', error);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * POST /api/driver/orders/:id/issue
 * @body { reason, note? }
 */
router.post('/orders/:id/issue', async (req: AuthRequest, res: Response) => {
  try {
    const dreq = req as DriverReq;
    if (!(await attachDriverSession(dreq, res))) return;
    const prisma: PrismaClient = req.app.get('prisma');
    const io: SocketIOServer = req.app.get('io');
    const { reason, note } = req.body as { reason?: string; note?: string };

    const result = await reportDeliveryIssue(prisma, io, {
      businessId: getBusinessId(),
      orderId: req.params.id,
      driverUserId: dreq.driverUserId ?? null,
      reason: reason ?? '',
      note,
      requireIdentity: true,
    });
    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }
    return res.json({ success: true, order: result.order });
  } catch (error) {
    console.error('[driver/issue]', error);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
