import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { readFile } from 'fs/promises';
import { authenticate, requireRole } from '../middleware/auth';
import { AuthRequest } from '../types';
import {
  closeFiscalDay,
  issueFiscalVoid,
  recordFiscalReprint,
  exportFiscalYearArchive,
  resolveArchiveAbsolutePath,
  buildDailyPreclosePreview,
  listOpenFiscalDays,
  acknowledgeDailyPreclose,
} from '../lib/fiscal';
import { fiscalDayKey, suggestFiscalCloseDayKey } from '../lib/fiscal/timezone';
import { getFiscalClosureStatus } from '../lib/fiscal/closure-status';
import { getFiscalConfigSummary } from '../lib/fiscal/fiscal-config';
import { currentMonthKey, listMonthlyBackups } from '../lib/backup-inventory';
import { verifyOrRepairFiscalChains } from '../lib/fiscal/ensure-chain';
import { renderFiscalJournalHtml } from '../lib/fiscal-journal-document-service';

const router = Router();

function serializeClosure<T extends { grandTotalCents: bigint }>(
  closure: T
): Omit<T, 'grandTotalCents'> & { grandTotalCents: string } {
  return {
    ...closure,
    grandTotalCents: closure.grandTotalCents.toString(),
  };
}

/**
 * GET /api/fiscal/print/journal — export HTML journal ISCA (logo + mentions légales)
 */
router.get(
  '/print/journal',
  authenticate,
  requireRole('ADMIN', 'MANAGER'),
  async (req: AuthRequest, res: Response) => {
    try {
      const prisma: PrismaClient = req.app.get('prisma');
      const ticketLimit = Math.min(parseInt(String(req.query.ticketLimit ?? '80'), 10) || 80, 200);
      const eventLimit = Math.min(parseInt(String(req.query.eventLimit ?? '120'), 10) || 120, 300);
      const html = await renderFiscalJournalHtml(
        prisma,
        req.user!.businessId,
        ticketLimit,
        eventLimit
      );
      res.type('text/html; charset=utf-8').send(html);
    } catch (error) {
      console.error('[fiscal/print/journal]', error);
      res.status(500).json({ error: 'Export journal impossible' });
    }
  }
);

/**
 * GET /api/fiscal/closure-status — rappel clôture Z (Europe/Paris)
 */
router.get(
  '/closure-status',
  authenticate,
  requireRole('ADMIN', 'MANAGER'),
  async (req: AuthRequest, res: Response) => {
    try {
      const prisma: PrismaClient = req.app.get('prisma');
      const status = await getFiscalClosureStatus(prisma, req.user!.businessId);
      res.json(status);
    } catch (error) {
      console.error('[fiscal/closure-status]', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * GET /api/fiscal/config — mise en service ISCA (date activation, version, mode formation)
 */
router.get(
  '/config',
  authenticate,
  requireRole('ADMIN', 'MANAGER'),
  async (req: AuthRequest, res: Response) => {
    try {
      const prisma: PrismaClient = req.app.get('prisma');
      const config = await getFiscalConfigSummary(prisma, req.user!.businessId);
      res.json(config);
    } catch (error) {
      console.error('[fiscal/config]', error);
      res.status(500).json({ error: 'Configuration fiscale indisponible' });
    }
  }
);

/**
 * GET /api/fiscal/backups?month=YYYY-MM — inventaire sauvegardes (MinIO S3 + copie locale)
 */
router.get(
  '/backups',
  authenticate,
  requireRole('ADMIN', 'MANAGER'),
  async (req: AuthRequest, res: Response) => {
    try {
      const month = String(req.query.month ?? currentMonthKey()).trim();
      const result = await listMonthlyBackups(month);
      res.json(result);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Inventaire sauvegardes indisponible';
      console.error('[fiscal/backups]', error);
      res
        .status(error instanceof Error && message.includes('month') ? 400 : 500)
        .json({ error: message });
    }
  }
);

/**
 * GET /api/fiscal/verify — contrôle intégrité chaînes ISCA
 */
router.get(
  '/verify',
  authenticate,
  requireRole('ADMIN', 'MANAGER'),
  async (req: AuthRequest, res: Response) => {
    try {
      const prisma: PrismaClient = req.app.get('prisma');
      const result = await verifyOrRepairFiscalChains(prisma, req.user!.businessId);
      res.json({ success: result.ok, ...result });
    } catch (error) {
      console.error('[fiscal/verify]', error);
      res.status(500).json({ error: 'Erreur vérification fiscale' });
    }
  }
);

/**
 * GET /api/fiscal/tickets — liste tickets (consultation)
 */
router.get(
  '/tickets',
  authenticate,
  requireRole('ADMIN', 'MANAGER'),
  async (req: AuthRequest, res: Response) => {
    try {
      const prisma: PrismaClient = req.app.get('prisma');
      const limit = Math.min(parseInt(String(req.query.limit ?? '50'), 10) || 50, 200);
      const tickets = await prisma.fiscalTicket.findMany({
        where: { businessId: req.user!.businessId },
        orderBy: { serialNumber: 'desc' },
        take: limit,
        select: {
          id: true,
          serialNumber: true,
          kind: true,
          issuedAt: true,
          totalCents: true,
          paymentMethod: true,
          orderId: true,
          recordHash: true,
          offlineRef: true,
          voidOfId: true,
        },
      });
      res.json({ tickets });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * GET /api/fiscal/events — journal JET
 */
router.get(
  '/events',
  authenticate,
  requireRole('ADMIN', 'MANAGER'),
  async (req: AuthRequest, res: Response) => {
    try {
      const prisma: PrismaClient = req.app.get('prisma');
      const limit = Math.min(parseInt(String(req.query.limit ?? '100'), 10) || 100, 500);
      const events = await prisma.fiscalEvent.findMany({
        where: { businessId: req.user!.businessId },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });
      res.json({ events });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * GET /api/fiscal/closures — clôtures Z / périodiques
 */
router.get(
  '/closures',
  authenticate,
  requireRole('ADMIN', 'MANAGER'),
  async (req: AuthRequest, res: Response) => {
    try {
      const prisma: PrismaClient = req.app.get('prisma');
      const limit = Math.min(parseInt(String(req.query.limit ?? '30'), 10) || 30, 100);
      const closures = await prisma.fiscalClosure.findMany({
        where: { businessId: req.user!.businessId },
        orderBy: { closedAt: 'desc' },
        take: limit,
      });
      res.json({ closures: closures.map(serializeClosure) });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * GET /api/fiscal/preclose/open-days — journées récentes (clôturées ou à clôturer)
 */
router.get(
  '/preclose/open-days',
  authenticate,
  requireRole('ADMIN', 'MANAGER'),
  async (req: AuthRequest, res: Response) => {
    try {
      const prisma: PrismaClient = req.app.get('prisma');
      const days = await listOpenFiscalDays(prisma, req.user!.businessId);
      res.json({
        suggestedDayKey: suggestFiscalCloseDayKey(),
        timezone: 'Europe/Paris',
        days,
      });
    } catch (error) {
      console.error('[fiscal/preclose/open-days]', error);
      res.status(500).json({ error: 'Impossible de lister les journées' });
    }
  }
);

/**
 * GET /api/fiscal/preclose/daily — rapport pré-clôture (contrôles + rapprochement)
 */
router.get(
  '/preclose/daily',
  authenticate,
  requireRole('ADMIN', 'MANAGER'),
  async (req: AuthRequest, res: Response) => {
    try {
      const prisma: PrismaClient = req.app.get('prisma');
      const dayKey = typeof req.query.dayKey === 'string' ? req.query.dayKey : undefined;
      const preview = await buildDailyPreclosePreview(prisma, req.user!.businessId, dayKey);
      res.json({ preview });
    } catch (error) {
      console.error('[fiscal/preclose/daily]', error);
      res.status(500).json({ error: 'Rapport pré-clôture impossible' });
    }
  }
);

/**
 * POST /api/fiscal/preclose/daily/acknowledge — valider la pré-clôture (4 h de validité)
 */
router.post(
  '/preclose/daily/acknowledge',
  authenticate,
  requireRole('ADMIN', 'MANAGER'),
  async (req: AuthRequest, res: Response) => {
    try {
      const prisma: PrismaClient = req.app.get('prisma');
      const { dayKey, managerNotes, cashCountedCents, confirmWarnings } = req.body as {
        dayKey?: string;
        managerNotes?: string;
        cashCountedCents?: number | null;
        confirmWarnings?: boolean;
      };
      if (!dayKey) return res.status(400).json({ error: 'dayKey requis (YYYY-MM-DD)' });
      const result = await acknowledgeDailyPreclose(
        prisma,
        req.user!.businessId,
        req.user!.userId,
        {
          dayKey,
          managerNotes,
          cashCountedCents,
          confirmWarnings: Boolean(confirmWarnings),
        }
      );
      res.json({ success: true, ...result });
    } catch (error) {
      console.error('[fiscal/preclose/acknowledge]', error);
      res
        .status(400)
        .json({ error: error instanceof Error ? error.message : 'Pré-clôture refusée' });
    }
  }
);

/**
 * POST /api/fiscal/closures/daily — clôture Z définitive (pré-clôture obligatoire)
 */
router.post(
  '/closures/daily',
  authenticate,
  requireRole('ADMIN', 'MANAGER'),
  async (req: AuthRequest, res: Response) => {
    try {
      const prisma: PrismaClient = req.app.get('prisma');
      const { dayKey, precloseId, date } = req.body as {
        dayKey?: string;
        precloseId?: string;
        date?: string;
      };
      const resolvedDayKey =
        dayKey ?? (date ? fiscalDayKey(new Date(date)) : suggestFiscalCloseDayKey());
      if (!precloseId) {
        return res.status(400).json({
          error: 'Pré-clôture obligatoire — validez le rapprochement avant la clôture Z.',
        });
      }
      const closure = await closeFiscalDay(prisma, req.user!.businessId, req.user!.userId, {
        dayKey: resolvedDayKey,
        precloseId,
      });
      res.json({ success: true, closure: serializeClosure(closure) });
    } catch (error) {
      console.error('[fiscal/closure]', error);
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Erreur clôture journalière',
      });
    }
  }
);

/**
 * POST /api/fiscal/void — avoir / annulation (ticket négatif)
 */
router.post(
  '/void',
  authenticate,
  requireRole('ADMIN', 'MANAGER'),
  async (req: AuthRequest, res: Response) => {
    try {
      const prisma: PrismaClient = req.app.get('prisma');
      const { ticketId, reason } = req.body as { ticketId?: string; reason?: string };
      if (!ticketId || !reason?.trim()) {
        return res.status(400).json({ error: 'ticketId et reason requis' });
      }
      const voidTicket = await issueFiscalVoid(prisma, {
        businessId: req.user!.businessId,
        voidOfTicketId: ticketId,
        operatorId: req.user!.userId,
        reason: reason.trim(),
      });
      res.json({ success: true, ticket: voidTicket });
    } catch (error) {
      console.error('[fiscal/void]', error);
      res.status(400).json({ error: error instanceof Error ? error.message : 'Erreur avoir' });
    }
  }
);

/**
 * POST /api/fiscal/reprint — journalise DUPLICATA (compteur via JET)
 */
router.post(
  '/reprint',
  authenticate,
  requireRole('ADMIN', 'MANAGER', 'CASHIER'),
  async (req: AuthRequest, res: Response) => {
    try {
      const prisma: PrismaClient = req.app.get('prisma');
      const { orderId } = req.body as { orderId?: string };
      if (!orderId) return res.status(400).json({ error: 'orderId requis' });
      const n = await recordFiscalReprint(prisma, req.user!.businessId, orderId, req.user!.userId);
      res.json({ success: true, reprintNumber: n, label: n > 0 ? `DUPLICATA n°${n}` : null });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * GET /api/fiscal/sequence — grand total perpétuel + prochain n°
 */
router.get(
  '/sequence',
  authenticate,
  requireRole('ADMIN', 'MANAGER'),
  async (req: AuthRequest, res: Response) => {
    try {
      const prisma: PrismaClient = req.app.get('prisma');
      const seq = await prisma.fiscalSequence.findUnique({
        where: { businessId: req.user!.businessId },
      });
      if (!seq) {
        const created = await prisma.fiscalSequence.create({
          data: {
            businessId: req.user!.businessId,
            softwareVersion: process.env.FISCAL_SOFTWARE_VERSION ?? '1.0.0',
          },
        });
        return res.json({
          sequence: {
            nextTicketNo: created.nextTicketNo,
            grandTotalCents: created.grandTotalCents.toString(),
            softwareVersion: created.softwareVersion,
            commissionedAt: created.commissionedAt,
          },
        });
      }
      res.json({
        sequence: {
          nextTicketNo: seq.nextTicketNo,
          grandTotalCents: seq.grandTotalCents.toString(),
          softwareVersion: seq.softwareVersion,
          commissionedAt: seq.commissionedAt,
        },
      });
    } catch (error) {
      console.error('[fiscal/sequence]', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * GET /api/fiscal/archives — archives annuelles exportées
 */
router.get(
  '/archives',
  authenticate,
  requireRole('ADMIN', 'MANAGER'),
  async (req: AuthRequest, res: Response) => {
    try {
      const prisma: PrismaClient = req.app.get('prisma');
      const archives = await prisma.fiscalArchive.findMany({
        where: { businessId: req.user!.businessId },
        orderBy: { fiscalYear: 'desc' },
      });
      res.json({ archives });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * POST /api/fiscal/archives/yearly — export figé d'un exercice
 */
router.post(
  '/archives/yearly',
  authenticate,
  requireRole('ADMIN', 'MANAGER'),
  async (req: AuthRequest, res: Response) => {
    try {
      const prisma: PrismaClient = req.app.get('prisma');
      const fiscalYear = parseInt(String(req.body?.fiscalYear ?? ''), 10);
      if (!Number.isInteger(fiscalYear)) {
        return res.status(400).json({ error: 'fiscalYear requis (ex: 2025)' });
      }
      const result = await exportFiscalYearArchive(
        prisma,
        req.user!.businessId,
        fiscalYear,
        req.user!.userId
      );
      res.json({ success: true, archive: result.archive });
    } catch (error) {
      const err = error as Error & { code?: string };
      if (err.code === 'ARCHIVE_EXISTS') {
        return res.status(409).json({ error: err.message });
      }
      console.error('[fiscal/archive]', error);
      res.status(400).json({ error: err.message || 'Export impossible' });
    }
  }
);

/**
 * GET /api/fiscal/archives/:year/download — téléchargement JSON figé
 */
router.get(
  '/archives/:year/download',
  authenticate,
  requireRole('ADMIN', 'MANAGER'),
  async (req: AuthRequest, res: Response) => {
    try {
      const prisma: PrismaClient = req.app.get('prisma');
      const fiscalYear = parseInt(req.params.year, 10);
      if (!Number.isInteger(fiscalYear)) {
        return res.status(400).json({ error: 'Année invalide' });
      }
      const archive = await prisma.fiscalArchive.findUnique({
        where: { businessId_fiscalYear: { businessId: req.user!.businessId, fiscalYear } },
      });
      if (!archive) return res.status(404).json({ error: 'Archive introuvable' });

      const absPath = resolveArchiveAbsolutePath(archive.storagePath);
      const content = await readFile(absPath, 'utf8');
      const filename = `fiscal-archive-${fiscalYear}.json`;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('X-Fiscal-Content-Hash', archive.contentHash);
      res.send(content);
    } catch (error) {
      console.error('[fiscal/archive/download]', error);
      res.status(500).json({ error: 'Téléchargement impossible' });
    }
  }
);

export default router;
