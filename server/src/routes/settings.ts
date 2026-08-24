import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth';
import { logAction } from '../middleware/auditLog';
import { AuthRequest } from '../types';
import { PERMISSION, requirePermission } from '../lib/permissions';
import { parseBusinessSettings, type BusinessSettingsJson } from '../lib/business-settings';
import { logFiscalEvent } from '../lib/fiscal/events';
import { getIntegrationsStatus } from '../lib/marketplace-integrations';
import { isSumupOnlineConfigured } from '../lib/device-settings';
import { sumupWebhookUrl } from '../lib/sumup-online-config';

const router = Router();

const settingsRead = [authenticate, requirePermission(PERMISSION.SETTINGS_READ)] as const;
const settingsWrite = [authenticate, requirePermission(PERMISSION.SETTINGS_WRITE)] as const;

router.get('/', ...settingsRead, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma');
    const settings = await prisma.business.findUnique({
      where: { id: req.user!.businessId },
    });
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Public: Get first available business (for demo)
router.get('/public', async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma');
    const business = await prisma.business.findFirst();
    if (!business) return res.status(404).json({ error: 'No business found' });
    res.json({
      id: business.id,
      name: business.name,
      nameAr: business.nameAr,
      logo: business.logo,
      currency: business.currency,
    });
  } catch (error) {
    console.error('Public settings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Public: Get business info by ID
router.get('/public/:id', async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma');
    const business = await prisma.business.findUnique({
      where: { id: req.params.id },
      select: { id: true, name: true, nameAr: true, logo: true, currency: true },
    });
    if (!business) return res.status(404).json({ error: 'Business not found' });
    res.json(business);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put(
  '/',
  ...settingsWrite,
  logAction('UPDATE', 'BUSINESS'),
  async (req: AuthRequest, res: Response) => {
    try {
      const prisma: PrismaClient = req.app.get('prisma');
      const { settings: settingsPatch, ...rest } = req.body as {
        settings?: BusinessSettingsJson;
        [key: string]: unknown;
      };

      let data = rest;
      if (settingsPatch) {
        const current = await prisma.business.findUnique({
          where: { id: req.user!.businessId },
          select: { settings: true },
        });
        const prevSettings = parseBusinessSettings(current?.settings);
        const merged = {
          ...prevSettings,
          ...settingsPatch,
        };
        if (
          settingsPatch.fiscalTrainingMode !== undefined &&
          settingsPatch.fiscalTrainingMode !== prevSettings.fiscalTrainingMode
        ) {
          void logFiscalEvent(prisma, {
            businessId: req.user!.businessId,
            eventType: settingsPatch.fiscalTrainingMode ? 'TRAINING_MODE_ON' : 'TRAINING_MODE_OFF',
            operatorId: req.user!.userId,
            payload: {
              previous: prevSettings.fiscalTrainingMode ?? false,
              next: settingsPatch.fiscalTrainingMode,
            },
          }).catch(err => console.error('[fiscal] training mode JET:', err));
        }
        if (
          settingsPatch.fiscalActivationDate !== undefined &&
          settingsPatch.fiscalActivationDate !== prevSettings.fiscalActivationDate &&
          settingsPatch.fiscalActivationDate
        ) {
          void logFiscalEvent(prisma, {
            businessId: req.user!.businessId,
            eventType: 'FISCAL_ACTIVATION',
            operatorId: req.user!.userId,
            payload: {
              activationDayKey: settingsPatch.fiscalActivationDate,
              previous: prevSettings.fiscalActivationDate ?? null,
            },
          }).catch(err => console.error('[fiscal] activation JET:', err));
          await prisma.fiscalSequence.upsert({
            where: { businessId: req.user!.businessId },
            create: {
              businessId: req.user!.businessId,
              commissionedAt: new Date(`${settingsPatch.fiscalActivationDate}T12:00:00.000Z`),
            },
            update: {
              commissionedAt: new Date(`${settingsPatch.fiscalActivationDate}T12:00:00.000Z`),
            },
          });
        }
        data = { ...rest, settings: merged };
      }

      const settings = await prisma.business.update({
        where: { id: req.user!.businessId },
        data,
      });
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/** GET /api/settings/schedule — horaires + fermetures (admin) */
router.get('/schedule', ...settingsRead, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma');
    const business = await prisma.business.findUnique({
      where: { id: req.user!.businessId },
      select: { settings: true },
    });
    const settings = parseBusinessSettings(business?.settings);
    const timeSlots = await prisma.timeSlot.findMany({
      where: { businessId: req.user!.businessId },
      orderBy: { dayOfWeek: 'asc' },
    });
    res.json({
      hours: settings.hours ?? { open: 18, close: 22, daysOpen: 7 },
      exceptionalClosures: settings.exceptionalClosures ?? [],
      slotCapacity: settings.slotCapacity ?? 10,
      timeSlots,
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** PUT /api/settings/schedule — horaires + fermetures + créneaux BDD (admin) */
router.put(
  '/schedule',
  ...settingsWrite,
  logAction('UPDATE', 'SCHEDULE'),
  async (req: AuthRequest, res: Response) => {
    try {
      const prisma: PrismaClient = req.app.get('prisma');
      const businessId = req.user!.businessId;
      const { hours, exceptionalClosures, slotCapacity, timeSlots } =
        req.body as BusinessSettingsJson & {
          timeSlots?: Array<{
            id?: string;
            dayOfWeek: number;
            startTime: string;
            endTime: string;
            capacity: number;
            isActive?: boolean;
          }>;
        };

      const current = await prisma.business.findUnique({
        where: { id: businessId },
        select: { settings: true },
      });
      const merged = {
        ...parseBusinessSettings(current?.settings),
        hours,
        exceptionalClosures,
        slotCapacity,
      };

      await prisma.business.update({
        where: { id: businessId },
        data: { settings: merged },
      });

      if (Array.isArray(timeSlots)) {
        const existing = await prisma.timeSlot.findMany({ where: { businessId } });
        const keepIds = new Set<string>();

        for (const slot of timeSlots) {
          if (slot.id && existing.some(e => e.id === slot.id)) {
            await prisma.timeSlot.update({
              where: { id: slot.id },
              data: {
                dayOfWeek: slot.dayOfWeek,
                startTime: slot.startTime,
                endTime: slot.endTime,
                capacity: slot.capacity,
                isActive: slot.isActive ?? true,
              },
            });
            keepIds.add(slot.id);
          } else {
            const created = await prisma.timeSlot.create({
              data: {
                businessId,
                dayOfWeek: slot.dayOfWeek,
                startTime: slot.startTime,
                endTime: slot.endTime,
                capacity: slot.capacity,
                isActive: slot.isActive ?? true,
              },
            });
            keepIds.add(created.id);
          }
        }

        const toDelete = existing.filter(e => !keepIds.has(e.id)).map(e => e.id);
        if (toDelete.length) {
          await prisma.timeSlot.deleteMany({ where: { id: { in: toDelete }, businessId } });
        }
      }

      const updatedSlots = await prisma.timeSlot.findMany({
        where: { businessId },
        orderBy: { dayOfWeek: 'asc' },
      });

      res.json({
        hours: merged.hours,
        exceptionalClosures: merged.exceptionalClosures ?? [],
        slotCapacity: merged.slotCapacity ?? 10,
        timeSlots: updatedSlots,
      });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/** GET /api/settings/integrations — statut marketplaces + SumUp en ligne (admin intégrations) */
router.get('/integrations', ...settingsRead, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma');
    const status = await getIntegrationsStatus(prisma, req.user!.businessId);
    res.json({
      ...status,
      sumupOnlineConfigured: isSumupOnlineConfigured(),
      sumupWebhookUrl: sumupWebhookUrl(),
    });
  } catch (error) {
    console.error('[settings/integrations]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
