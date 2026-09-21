import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { Server as SocketIOServer } from 'socket.io';
import { authenticate } from '../middleware/auth';
import { logAction } from '../middleware/auditLog';
import { AuthRequest } from '../types';
import { PERMISSION, requirePermission } from '../lib/permissions';
import { parseBusinessSettings } from '../lib/business-settings';
import { getBusinessId } from '../lib/business';
import { isModuleEnabled } from '../lib/modules';
import {
  canGeneratePairingCode,
  canAccessDeviceApps,
  createPairingCodeEntry,
  DEVICE_SLOT_LABELS,
  getClientIp,
  getDevicesAccessStatus,
  getDevicesFromSettings,
  getSlotCapacitySummary,
  isSumupOnlineConfigured,
  isPrivateOrReservedIp,
  isSuspiciousWanIp,
  mergeDevicesSettings,
  pairDeviceWithCode,
  pruneExpiredPairingCodes,
  shouldSkipDeviceGate,
  ensureShopWanIpFromClient,
  stripPrivateWanIps,
  setShopWanIp,
  touchPairedDevice,
  unpairDeviceById,
  appendDeviceAudit,
  touchAppPresence,
  isPresenceFresh,
  APP_ONLINE_WINDOW_MS,
  type DeviceSlot,
  type DevicesSettings,
  type PrinterConfig,
} from '../lib/device-settings';
import { sendEscPosToLanPrinter } from '../lib/epson-socket';
import { syncTraefikShopIp } from '../lib/traefik-ip-sync';
import {
  createDiagnosticRequestId,
  waitDeviceDiagnosticResult,
  type DeviceDiagnosticCheck,
} from '../lib/device-diagnostics';
import { fetchDriversOnDuty } from '../lib/driver-access';

const router = Router();

const devicesRead = [authenticate, requirePermission(PERMISSION.DEVICES_READ)] as const;
const devicesWrite = [authenticate, requirePermission(PERMISSION.DEVICES_WRITE)] as const;
const devicesOnboarding = [authenticate, requirePermission(PERMISSION.DEVICES_ONBOARDING)] as const;
const devicesPrint = [authenticate, requirePermission(PERMISSION.DEVICES_PRINT)] as const;

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- retour = payload Prisma Business dont la forme dépend du `select` passé par l'appelant.
async function loadTenantBusiness(
  prisma: PrismaClient,
  select: { id?: true; settings?: true; name?: true } = { id: true, settings: true }
) {
  const businessId = getBusinessId();
  return prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, ...select },
  });
}

async function loadDevices(prisma: PrismaClient, businessId?: string): Promise<DevicesSettings> {
  const id = businessId?.trim() || getBusinessId();
  const business = await prisma.business.findUnique({
    where: { id },
    select: { settings: true },
  });
  return getDevicesFromSettings(parseBusinessSettings(business?.settings));
}

async function saveDevices(
  prisma: PrismaClient,
  businessId: string | undefined,
  devices: DevicesSettings
): Promise<DevicesSettings> {
  const id = businessId?.trim() || getBusinessId();
  const current = await prisma.business.findUnique({
    where: { id },
    select: { settings: true },
  });
  const merged = mergeDevicesSettings(parseBusinessSettings(current?.settings), devices);
  await prisma.business.update({
    where: { id },
    data: { settings: merged },
  });
  return merged.devices as DevicesSettings;
}

function safeSyncTraefikShopIp(allowedWanIps: string[] | undefined): void {
  try {
    syncTraefikShopIp(allowedWanIps ?? []);
  } catch (error) {
    console.warn('Traefik shop IP sync skipped:', error);
  }
}

/** GET /api/devices/public/access-status — garde réseau POS/KDS (sans auth) */
router.get('/public/access-status', async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma');
    const business = await loadTenantBusiness(prisma);
    if (!business) return res.status(404).json({ error: 'Business not found' });

    let devices = getDevicesFromSettings(parseBusinessSettings(business.settings));
    const clientIp = getClientIp(req);
    const gateSkipped = shouldSkipDeviceGate(req);

    const prepared = ensureShopWanIpFromClient(devices, clientIp, gateSkipped);
    if (prepared !== devices) {
      devices = await saveDevices(prisma, business.id, prepared);
      safeSyncTraefikShopIp(devices.allowedWanIps);
    }

    const status = getDevicesAccessStatus(devices, clientIp, gateSkipped);

    res.json({
      ...status,
      allowed: canAccessDeviceApps(status),
    });
  } catch (error) {
    console.error('Device access status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** GET /api/devices/public/device-status — vérifie le jumelage local (sans auth) */
router.get('/public/device-status', async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma');
    const business = await loadTenantBusiness(prisma, { settings: true });
    if (!business) return res.status(404).json({ error: 'Business not found' });

    const deviceId = String(req.query.deviceId ?? '').trim();
    if (!deviceId) return res.status(400).json({ error: 'deviceId requis' });

    const devices = getDevicesFromSettings(parseBusinessSettings(business.settings));
    const clientIp = getClientIp(req);
    const gateSkipped = shouldSkipDeviceGate(req);
    const access = getDevicesAccessStatus(devices, clientIp, gateSkipped);
    const paired = (devices.pairedDevices ?? []).find(d => d.id === deviceId);
    if (paired) {
      const touched = touchPairedDevice(devices, deviceId, {
        userAgent: req.headers['user-agent'],
        clientIp,
      });
      if (touched !== devices) {
        try {
          await saveDevices(prisma, business.id, touched);
        } catch (saveError) {
          console.warn('Device heartbeat save failed (non-blocking):', saveError);
        }
      }
    }

    res.json({
      valid: Boolean(paired) && (access.gateSkipped || access.ipAllowed),
      deviceId,
      slot: paired?.slot ?? null,
      ipAllowed: access.ipAllowed,
      clientIp: access.clientIp,
    });
  } catch (error) {
    console.error('Device status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/devices/public/emergency-bypass
 * Accès temporaire POS/KDS (PIN ADMIN/MANAGER) si jumelage / IP bloqués.
 */
router.post('/public/emergency-bypass', async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma');
    const business = await loadTenantBusiness(prisma);
    if (!business) return res.status(404).json({ error: 'Business not found' });

    const pin = String((req.body as { pin?: string }).pin ?? '').trim();
    if (!pin) return res.status(400).json({ error: 'PIN requis' });

    const user = await prisma.user.findFirst({
      where: { businessId: business.id, pin, isActive: true },
      select: { id: true, name: true, role: true },
    });
    if (!user || (user.role !== 'ADMIN' && user.role !== 'MANAGER')) {
      return res.status(403).json({ error: 'PIN gérant / admin requis' });
    }

    const clientIp = getClientIp(req);
    await saveDevices(
      prisma,
      business.id,
      appendDeviceAudit(getDevicesFromSettings(parseBusinessSettings(business.settings)), {
        action: 'EMERGENCY_BYPASS',
        byUserId: user.id,
        ip: clientIp ?? undefined,
        userAgent: req.headers['user-agent'],
        note: `Accès temporaire ${user.role} ${user.name}`,
      })
    );

    const expiresInSec = 4 * 3600;
    res.json({
      ok: true,
      expiresInSec,
      expiresAt: new Date(Date.now() + expiresInSec * 1000).toISOString(),
      by: { id: user.id, name: user.name, role: user.role },
    });
  } catch (error) {
    console.error('Emergency device bypass error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** POST /api/devices/public/pair — jumeler depuis l'appareil (sans auth staff, IP boutique requise) */
router.post('/public/pair', async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma');
    const business = await loadTenantBusiness(prisma);
    if (!business) return res.status(404).json({ error: 'Business not found' });

    const { code, expectedSlot } = req.body as { code?: string; expectedSlot?: DeviceSlot };
    const normalized = String(code ?? '')
      .replace(/\D/g, '')
      .slice(0, 6);
    if (normalized.length !== 6) return res.status(400).json({ error: 'code requis (6 chiffres)' });
    if (expectedSlot && !['pos-sunmi', 'pos-tablet', 'kds'].includes(expectedSlot)) {
      return res.status(400).json({ error: 'expectedSlot invalide' });
    }

    let devices = getDevicesFromSettings(parseBusinessSettings(business.settings));
    const clientIp = getClientIp(req);
    const gateSkipped = shouldSkipDeviceGate(req);

    const prepared = ensureShopWanIpFromClient(devices, clientIp, gateSkipped);
    if (prepared !== devices) {
      devices = await saveDevices(prisma, business.id, prepared);
      safeSyncTraefikShopIp(devices.allowedWanIps);
    }

    const access = getDevicesAccessStatus(devices, clientIp, gateSkipped);

    if (!gateSkipped && !access.ipAllowed) {
      return res.status(403).json({ error: 'Accès réservé au réseau du restaurant.' });
    }

    const pending = devices.pairingCodes?.[normalized];
    if (pending && expectedSlot && pending.slot !== expectedSlot) {
      return res.status(400).json({
        error: `Ce code est pour « ${DEVICE_SLOT_LABELS[pending.slot]} », pas pour « ${DEVICE_SLOT_LABELS[expectedSlot]} ».`,
      });
    }

    const userAgent = req.headers['user-agent'];
    const result = pairDeviceWithCode(devices, normalized, { userAgent, clientIp });
    if ('error' in result) return res.status(400).json({ error: result.error });

    if (expectedSlot && result.device.slot !== expectedSlot) {
      return res.status(400).json({ error: 'Code incompatible avec cet écran.' });
    }

    const saved = await saveDevices(prisma, business.id, {
      ...result.devices,
      onboardingComplete: true,
    });
    safeSyncTraefikShopIp(saved.allowedWanIps);

    res.json({ device: result.device });
  } catch (error) {
    console.error('Public device pair error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** GET /api/devices/public/printers — IP LAN Epson (KDS/POS sur le réseau shop) */
router.get('/public/printers', async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma');
    const business = await loadTenantBusiness(prisma, { settings: true });
    if (!business) return res.status(404).json({ error: 'Business not found' });
    const devices = getDevicesFromSettings(parseBusinessSettings(business.settings));
    res.json({
      printers: {
        kitchenLanIp: devices.printers?.kitchenLanIp ?? null,
        counterLanIp: devices.printers?.counterLanIp ?? null,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** POST /api/devices/public/app-heartbeat — présence totem / livreur (sans jumelage) */
router.post('/public/app-heartbeat', async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma');
    const business = await loadTenantBusiness(prisma);
    if (!business) return res.status(404).json({ error: 'Business not found' });

    const body = req.body as {
      app?: string;
      driverId?: string;
      driverName?: string;
    };
    const app = body.app === 'kiosk' || body.app === 'livreur' ? body.app : null;
    if (!app) return res.status(400).json({ error: 'app=kiosk|livreur requis' });

    const clientIp = getClientIp(req);
    let devices = getDevicesFromSettings(parseBusinessSettings(business.settings));
    devices = await saveDevices(
      prisma,
      business.id,
      touchAppPresence(devices, app, {
        clientIp,
        userAgent: req.headers['user-agent'],
        driverId: typeof body.driverId === 'string' ? body.driverId.trim() : undefined,
        driverName: typeof body.driverName === 'string' ? body.driverName.trim() : undefined,
      })
    );

    const lastSeenAt =
      app === 'kiosk'
        ? (devices.appPresence?.kiosk?.lastSeenAt ?? null)
        : (devices.appPresence?.livreur?.[0]?.lastSeenAt ?? null);

    res.json({ ok: true, app, lastSeenAt });
  } catch (error) {
    console.error('App heartbeat error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/devices/fleet — vue parc CRM (POS · KDS · livreur · totem)
 */
router.get('/fleet', ...devicesRead, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma');
    const io: SocketIOServer = req.app.get('io');
    const businessId = req.user!.businessId;
    const devices = await loadDevices(prisma, businessId);
    const paired = devices.pairedDevices ?? [];

    type FleetSurface = {
      id: string;
      label: string;
      kind: 'paired';
      status: 'online' | 'offline' | 'unpaired' | 'idle';
      detail: string;
      lastSeenAt: string | null;
      deviceId: string | null;
      labelDevice: string | null;
      lastIp: string | null;
    };

    const pairedSurface = async (slot: DeviceSlot): Promise<FleetSurface> => {
      const device = paired.find(d => d.slot === slot) ?? null;
      let socketOnline = false;
      if (device) {
        const sockets = await io.in(`device:${device.id}`).fetchSockets();
        socketOnline = sockets.length > 0;
      }
      const lastSeenAt = device?.lastSeenAt ?? null;
      const recent = isPresenceFresh(lastSeenAt);
      const status: 'online' | 'offline' | 'unpaired' | 'idle' = !device
        ? 'unpaired'
        : socketOnline
          ? 'online'
          : recent
            ? 'idle'
            : 'offline';
      return {
        id: slot as string,
        label: DEVICE_SLOT_LABELS[slot],
        kind: 'paired' as const,
        status,
        detail: !device
          ? 'Non jumelé'
          : socketOnline
            ? `Connecté · ${device.label}`
            : recent
              ? `Vu récemment · ${device.label}`
              : lastSeenAt
                ? `Hors ligne · vu ${new Date(lastSeenAt).toLocaleString('fr-FR')}`
                : `Jumelé · ${device.label}`,
        lastSeenAt,
        deviceId: device?.id ?? null,
        labelDevice: device?.label ?? null,
        lastIp: device?.lastIp ?? device?.pairedFromIp ?? null,
      };
    };

    // Version une-tablette : POS et totem n'existent pas → pas de cartes « hors ligne » fantômes.
    const posEnabled = isModuleEnabled('pos');
    const kioskEnabled = isModuleEnabled('kiosk');
    const [posSunmi, posTablet, kds] = await Promise.all([
      posEnabled ? pairedSurface('pos-sunmi') : null,
      posEnabled ? pairedSurface('pos-tablet') : null,
      pairedSurface('kds'),
    ]);

    const driversOnDuty = await fetchDriversOnDuty(prisma, businessId);
    const livreurSessions = (devices.appPresence?.livreur ?? []).filter(s =>
      isPresenceFresh(s.lastSeenAt)
    );
    const livreurOnline = livreurSessions.length > 0;
    const livreurLast =
      devices.appPresence?.livreur?.[0]?.lastSeenAt ?? livreurSessions[0]?.lastSeenAt ?? null;
    const livreurNames = [
      ...new Set([
        ...livreurSessions.map(s => s.driverName).filter(Boolean),
        ...driversOnDuty.map(d => d.name),
      ]),
    ] as string[];

    const kioskPresence = devices.appPresence?.kiosk;
    const kioskOnline = isPresenceFresh(kioskPresence?.lastSeenAt);
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const kioskOrdersToday = kioskEnabled
      ? await prisma.order.count({
          where: {
            businessId,
            channel: 'KIOSK',
            createdAt: { gte: startOfDay },
            status: { not: 'CANCELLED' },
          },
        })
      : 0;
    const lastKioskOrder = kioskEnabled
      ? await prisma.order.findFirst({
          where: { businessId, channel: 'KIOSK' },
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true, orderNumber: true },
        })
      : null;

    res.json({
      surfaces: [
        ...(posSunmi ? [posSunmi] : []),
        ...(posTablet ? [posTablet] : []),
        kds,
        {
          id: 'livreur',
          label: 'App livreur',
          kind: 'app',
          status: livreurOnline ? 'online' : driversOnDuty.length > 0 ? 'idle' : 'offline',
          detail: livreurOnline
            ? `En ligne · ${livreurSessions.length} session(s)`
            : driversOnDuty.length > 0
              ? `Planifiés : ${driversOnDuty.map(d => d.name).join(', ')}`
              : 'Aucune session active',
          lastSeenAt: livreurLast,
          driversOnDuty: driversOnDuty.map(d => ({ id: d.id, name: d.name })),
          activeNames: livreurNames,
        },
        ...(kioskEnabled
          ? [
              {
                id: 'kiosk',
                label: 'Totem kiosque',
                kind: 'app',
                status: kioskOnline ? 'online' : kioskOrdersToday > 0 ? 'idle' : 'offline',
                detail: kioskOnline
                  ? 'Écran actif'
                  : kioskOrdersToday > 0
                    ? `${kioskOrdersToday} commande(s) aujourd’hui`
                    : lastKioskOrder
                      ? `Dernière #${lastKioskOrder.orderNumber} · ${new Date(lastKioskOrder.createdAt).toLocaleString('fr-FR')}`
                      : 'Aucune activité',
                lastSeenAt:
                  kioskPresence?.lastSeenAt ?? lastKioskOrder?.createdAt?.toISOString() ?? null,
                ordersToday: kioskOrdersToday,
                lastIp: kioskPresence?.lastIp ?? null,
              },
            ]
          : []),
      ],
      onlineWindowMs: APP_ONLINE_WINDOW_MS,
      at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Devices fleet error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** GET /api/devices — état onboarding (admin) */
router.get('/', ...devicesRead, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma');
    let devices = await loadDevices(prisma, req.user!.businessId);
    const sanitized = stripPrivateWanIps(devices);
    if (sanitized !== devices) {
      devices = await saveDevices(prisma, req.user!.businessId, sanitized);
      syncTraefikShopIp(devices.allowedWanIps ?? []);
    }
    const clientIp = getClientIp(req);
    const gateSkipped = shouldSkipDeviceGate(req);
    const access = getDevicesAccessStatus(devices, clientIp, gateSkipped);

    const business = await prisma.business.findUnique({
      where: { id: req.user!.businessId },
      select: { name: true },
    });

    res.json({
      devices: {
        ...devices,
        pairingCodes: pruneExpiredPairingCodes(devices.pairingCodes),
      },
      access,
      sumupOnlineConfigured: isSumupOnlineConfigured(),
      slotCapacity: getSlotCapacitySummary(devices),
      storeInventory: [
        {
          businessId: req.user!.businessId,
          businessName: business?.name ?? 'Magasin',
          wanIp: devices.allowedWanIps?.[0] ?? null,
          pairedCount: devices.pairedDevices?.length ?? 0,
          slots: getSlotCapacitySummary(devices),
          printers: devices.printers ?? {},
        },
      ],
    });
  } catch (error) {
    console.error('Devices GET error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** POST /api/devices/pairing-code — génère un code 6 chiffres */
router.post(
  '/pairing-code',
  ...devicesWrite,
  logAction('CREATE', 'DEVICE_PAIRING'),
  async (req: AuthRequest, res: Response) => {
    try {
      const prisma: PrismaClient = req.app.get('prisma');
      const { slot, label } = req.body as { slot?: DeviceSlot; label?: string };
      if (!slot || !['pos-sunmi', 'pos-tablet', 'kds'].includes(slot)) {
        return res.status(400).json({ error: 'slot invalide' });
      }

      const devices = await loadDevices(prisma, req.user!.businessId);
      const slotCheck = canGeneratePairingCode(devices, slot);
      if (!slotCheck.ok) return res.status(409).json({ error: slotCheck.error });

      const { code, entry } = createPairingCodeEntry(slot, label?.trim() || slot);
      const pairingCodes = pruneExpiredPairingCodes({
        ...devices.pairingCodes,
        [code]: entry,
      });

      await saveDevices(prisma, req.user!.businessId, { ...devices, pairingCodes });

      res.json({
        code,
        slot,
        label: entry.label,
        expiresAt: entry.expiresAt,
      });
    } catch (error) {
      console.error('Pairing code error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/** POST /api/devices/pair — jumeler depuis l'appareil (staff auth) */
router.post(
  '/pair',
  ...devicesWrite,
  logAction('UPDATE', 'DEVICE_PAIR'),
  async (req: AuthRequest, res: Response) => {
    try {
      const prisma: PrismaClient = req.app.get('prisma');
      const { code } = req.body as { code?: string };
      if (!code?.trim()) return res.status(400).json({ error: 'code requis' });

      const devices = await loadDevices(prisma, req.user!.businessId);
      const userAgent = req.headers['user-agent'];
      const clientIp = getClientIp(req);
      const result = pairDeviceWithCode(devices, code, { userAgent, clientIp });

      if ('error' in result) return res.status(400).json({ error: result.error });

      const saved = await saveDevices(prisma, req.user!.businessId, result.devices);
      res.json({ device: result.device, devices: saved });
    } catch (error) {
      console.error('Device pair error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/** POST /api/devices/capture-wan-ip — IP publique du réseau actuel */
router.post(
  '/capture-wan-ip',
  ...devicesWrite,
  logAction('UPDATE', 'DEVICE_WAN_IP'),
  async (req: AuthRequest, res: Response) => {
    try {
      const prisma: PrismaClient = req.app.get('prisma');
      const clientIp = getClientIp(req);
      if (!clientIp) return res.status(400).json({ error: 'IP client introuvable' });
      if (isPrivateOrReservedIp(clientIp)) {
        return res.status(400).json({
          error:
            'IP privée détectée (réseau Docker/VPS). Ouvrez le CRM depuis le Wi‑Fi boutique sur votre PC, pas depuis le serveur. Si le problème persiste, contactez le support.',
          detectedIp: clientIp,
        });
      }
      if (isSuspiciousWanIp(clientIp)) {
        return res.status(400).json({
          error:
            'IP suspecte (bot / cloud) — ouvrez le CRM depuis le Wi‑Fi du restaurant, pas via un proxy ou un moteur de recherche.',
          detectedIp: clientIp,
        });
      }

      const devices = await loadDevices(prisma, req.user!.businessId);
      const withoutPrivate = (devices.allowedWanIps ?? []).filter(
        entry => !isPrivateOrReservedIp(entry.split('/')[0] ?? entry)
      );
      let updated = setShopWanIp({ ...devices, allowedWanIps: withoutPrivate }, clientIp);
      updated = appendDeviceAudit(updated, {
        action: 'WAN_CAPTURE',
        ip: clientIp,
        byUserId: req.user!.userId,
        note: `IP boutique enregistrée (${clientIp})`,
      });
      const withCapture: DevicesSettings = {
        ...updated,
        lastWanIpCapture: {
          ip: clientIp,
          at: new Date().toISOString(),
          byUserId: req.user!.userId,
        },
      };
      const saved = await saveDevices(prisma, req.user!.businessId, withCapture);
      const traefik = syncTraefikShopIp(saved.allowedWanIps ?? []);

      res.json({
        capturedIp: clientIp,
        allowedWanIps: saved.allowedWanIps ?? [],
        lastWanIpCapture: saved.lastWanIpCapture,
        traefik,
      });
    } catch (error) {
      console.error('Capture WAN IP error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/** PUT /api/devices/printers — IP LAN Epson */
router.put(
  '/printers',
  ...devicesWrite,
  logAction('UPDATE', 'DEVICE_PRINTERS'),
  async (req: AuthRequest, res: Response) => {
    try {
      const prisma: PrismaClient = req.app.get('prisma');
      const printers = req.body as PrinterConfig;
      const devices = await loadDevices(prisma, req.user!.businessId);
      const saved = await saveDevices(prisma, req.user!.businessId, {
        ...devices,
        printers: {
          kitchenLanIp: printers.kitchenLanIp?.trim() || undefined,
          counterLanIp: printers.counterLanIp?.trim() || undefined,
        },
      });
      res.json({ printers: saved.printers });
    } catch (error) {
      console.error('Printers update error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/** GET /api/devices/paired/:id/online — terminal connecté au socket temps réel */
router.get('/paired/:id/online', ...devicesRead, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma');
    const io: SocketIOServer = req.app.get('io');
    const devices = await loadDevices(prisma, req.user!.businessId);
    const paired = (devices.pairedDevices ?? []).find(d => d.id === req.params.id);
    if (!paired) return res.status(404).json({ error: 'Appareil introuvable' });

    const sockets = await io.in(`device:${paired.id}`).fetchSockets();
    res.json({
      online: sockets.length > 0,
      connections: sockets.length,
      lastSeenAt: paired.lastSeenAt ?? null,
    });
  } catch (error) {
    console.error('Device online check error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** POST /api/devices/paired/:id/run-diagnostic — envoie un test au terminal jumelé */
router.post(
  '/paired/:id/run-diagnostic',
  ...devicesWrite,
  async (req: AuthRequest, res: Response) => {
    try {
      const prisma: PrismaClient = req.app.get('prisma');
      const io: SocketIOServer = req.app.get('io');
      const check = req.body?.check as DeviceDiagnosticCheck;
      if (check !== 'printKitchen' && check !== 'printReceipt') {
        return res.status(400).json({ error: 'check invalide (printKitchen | printReceipt)' });
      }

      const devices = await loadDevices(prisma, req.user!.businessId);
      const paired = (devices.pairedDevices ?? []).find(d => d.id === req.params.id);
      if (!paired) return res.status(404).json({ error: 'Appareil introuvable' });

      const roomSockets = await io.in(`device:${paired.id}`).fetchSockets();
      if (roomSockets.length > 0) {
        const requestId = createDiagnosticRequestId();
        const wait = waitDeviceDiagnosticResult(requestId, 15000);
        io.to(`device:${paired.id}`).emit('device:diagnosticRequest', { requestId, check });
        try {
          const result = await wait;
          return res.json({
            ...result,
            source: 'terminal',
            message: result.ok
              ? 'Test exécuté sur le terminal — vérifiez le ticket sorti'
              : (result.error ?? 'Échec sur le terminal'),
          });
        } catch {
          return res.status(504).json({
            ok: false,
            offline: false,
            error: 'Le terminal n’a pas répondu (timeout 15 s)',
            source: 'terminal',
          });
        }
      }

      const content = `=== TEST ${check === 'printKitchen' ? 'CUISINE' : 'CAISSE'} ===\n${new Date().toLocaleString('fr-FR')}\nLa Z Pizza — diagnostic CRM\n\nOK`;
      const lanIp =
        check === 'printReceipt'
          ? devices.printers?.counterLanIp?.trim()
          : devices.printers?.kitchenLanIp?.trim();

      if (lanIp) {
        const printed = await sendEscPosToLanPrinter(lanIp, content, {
          bold: check === 'printKitchen',
        });
        if (printed.ok) {
          return res.json({
            ok: true,
            source: 'epson-lan',
            method: 'epson-lan',
            detail: `${lanIp}:9100`,
            message: `Impression Epson (${lanIp}) — vérifiez le ticket sorti`,
          });
        }
        return res.status(502).json({
          ok: false,
          source: 'epson-lan',
          error: printed.error ?? 'Impression Epson échouée',
          offline: true,
        });
      }

      return res.status(503).json({
        ok: false,
        offline: true,
        source: 'none',
        error:
          'Terminal hors ligne — ouvrez l’app POS/KDS sur l’appareil jumelé, ou configurez une IP Epson (onglet Réseau).',
      });
    } catch (error) {
      console.error('Run diagnostic error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/** POST /api/devices/print-lan — test impression Epson (API sur LAN shop ou dev local) */
router.post('/print-lan', ...devicesPrint, async (req: AuthRequest, res: Response) => {
  try {
    const prisma: PrismaClient = req.app.get('prisma');
    const { ip, content, bold, type } = req.body as {
      ip?: string;
      content?: string;
      bold?: boolean;
      type?: 'KITCHEN' | 'RECEIPT' | 'BAG_LABEL';
    };

    const devices = await loadDevices(prisma, req.user!.businessId);
    const resolvedIp =
      ip?.trim() ||
      (type === 'RECEIPT' ? devices.printers?.counterLanIp : devices.printers?.kitchenLanIp);

    if (!resolvedIp) {
      return res.status(400).json({ error: 'IP imprimante non configurée' });
    }
    if (!content?.trim()) {
      return res.status(400).json({ error: 'contenu vide' });
    }

    const result = await sendEscPosToLanPrinter(resolvedIp, content, {
      bold: bold ?? type === 'KITCHEN',
    });
    if (!result.ok) return res.status(502).json({ error: result.error });
    res.json({ ok: true, ip: resolvedIp });
  } catch (error) {
    console.error('Print LAN error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** POST /api/devices/complete-recipe */
router.post(
  '/complete-recipe',
  ...devicesWrite,
  logAction('UPDATE', 'DEVICE_RECIPE'),
  async (req: AuthRequest, res: Response) => {
    try {
      const prisma: PrismaClient = req.app.get('prisma');
      const devices = await loadDevices(prisma, req.user!.businessId);
      const saved = await saveDevices(prisma, req.user!.businessId, {
        ...devices,
        recipeCompletedAt: new Date().toISOString(),
      });
      res.json({ recipeCompletedAt: saved.recipeCompletedAt });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/** POST /api/devices/complete-onboarding — débloque POS/KDS */
router.post(
  '/complete-onboarding',
  ...devicesOnboarding,
  logAction('UPDATE', 'DEVICE_ONBOARDING'),
  async (req: AuthRequest, res: Response) => {
    try {
      const prisma: PrismaClient = req.app.get('prisma');
      const devices = await loadDevices(prisma, req.user!.businessId);

      if (!devices.allowedWanIps?.length && process.env.NODE_ENV === 'production') {
        return res.status(400).json({
          error: 'Enregistrez d’abord l’IP WAN du restaurant (« Utiliser l’IP de ce réseau »).',
        });
      }
      if (!devices.pairedDevices?.length) {
        return res.status(400).json({
          error: 'Associez au moins un appareil (SUNMI, tablette ou KDS) avant la mise en service.',
        });
      }

      const saved = await saveDevices(prisma, req.user!.businessId, {
        ...devices,
        onboardingComplete: true,
      });
      res.json({ onboardingComplete: saved.onboardingComplete });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/** POST /api/devices/reset-onboarding — labo → client */
router.post(
  '/reset-onboarding',
  ...devicesOnboarding,
  logAction('UPDATE', 'DEVICE_RESET'),
  async (req: AuthRequest, res: Response) => {
    try {
      const prisma: PrismaClient = req.app.get('prisma');
      const saved = await saveDevices(prisma, req.user!.businessId, {
        onboardingComplete: false,
        pairingCodes: {},
        recipeCompletedAt: undefined,
      });
      res.json({ devices: saved });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/** DELETE /api/devices/paired/:id — dissocier */
router.delete(
  '/paired/:id',
  ...devicesWrite,
  logAction('DELETE', 'DEVICE_PAIR'),
  async (req: AuthRequest, res: Response) => {
    try {
      const prisma: PrismaClient = req.app.get('prisma');
      const devices = await loadDevices(prisma, req.user!.businessId);
      const { devices: next, removed } = unpairDeviceById(devices, req.params.id, req.user!.userId);
      if (!removed) return res.status(404).json({ error: 'Appareil introuvable' });
      const saved = await saveDevices(prisma, req.user!.businessId, next);
      res.json({ pairedDevices: saved.pairedDevices ?? [], removed });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

export default router;
