import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, requireRole } from '../middleware/auth';
import { AuthRequest } from '../types';
import {
  syncPennylaneSupplierInvoices,
  listCachedSupplierInvoices,
} from '../lib/pennylane/pennylane-expense-sync';
import { PennylaneNotConfiguredError } from '../lib/pennylane/pennylane-sync';

const router = Router();

function pennylaneErrorResponse(res: Response, error: unknown): Response {
  if (error instanceof PennylaneNotConfiguredError) {
    return res.status(400).json({ error: error.message });
  }
  console.error('Pennylane error:', error);
  return res.status(502).json({ error: 'Erreur Pennylane' });
}

/**
 * POST /api/pennylane/supplier-invoices/sync — tire l'historique des factures
 * fournisseurs Pennylane et les upsert dans le cache local (chantier 3, indépendant
 * de la facturation B2C sur ventes SumUp — sens de lecture inverse).
 */
router.post(
  '/supplier-invoices/sync',
  authenticate,
  requireRole('ADMIN', 'MANAGER'),
  async (req: AuthRequest, res: Response) => {
    try {
      const prisma: PrismaClient = req.app.get('prisma');
      const result = await syncPennylaneSupplierInvoices(prisma, req.user!.businessId);
      res.json(result);
    } catch (error) {
      pennylaneErrorResponse(res, error);
    }
  }
);

/** GET /api/pennylane/supplier-invoices — cache local. ?paid=unpaid (défaut)|paid|all */
router.get('/supplier-invoices', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma');
    const { paid, limit } = req.query as { paid?: 'paid' | 'unpaid' | 'all'; limit?: string };
    const invoices = await listCachedSupplierInvoices(prisma, req.user!.businessId, {
      paid,
      limit: limit ? Number(limit) : undefined,
    });
    res.json({ invoices });
  } catch (error) {
    pennylaneErrorResponse(res, error);
  }
});

export default router;
