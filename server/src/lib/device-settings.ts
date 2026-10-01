/** Jumelage devices, IP WAN boutique, onboarding POS/KDS — stocké dans Business.settings.devices */

import type { Request } from 'express';
import { randomInt, randomUUID } from 'crypto';
import { type BusinessSettingsJson } from './business-settings';
import { isSumupConfigured } from './sumup-config';
import { sumupWebhookUrl } from './sumup-online-config';

export function isSumupOnlineConfigured(): boolean {
  return isSumupConfigured() && sumupWebhookUrl() !== null;
}

export type DeviceSlot = 'pos-sunmi' | 'pos-tablet' | 'kds';

export const DEVICE_SLOT_LABELS: Record<DeviceSlot, string> = {
  'pos-sunmi': 'Caisse SUNMI',
  'pos-tablet': 'Tablette caisse',
  kds: 'Écran cuisine (KDS)',
};

/** Quota jumelage par slot — 2 imprimantes = config LAN séparée (Epson). */
export const DEVICE_SLOT_LIMITS: Record<DeviceSlot, number> = {
  'pos-sunmi': 1,
  'pos-tablet': 1,
  kds: 1,
};

export type DeviceAuditAction =
  'PAIR' | 'UNPAIR' | 'REPLACE' | 'WAN_CAPTURE' | 'INVENTORY' | 'EMERGENCY_BYPASS';

export type DeviceAuditEntry = {
  at: string;
  action: DeviceAuditAction;
  slot?: DeviceSlot;
  deviceId?: string;
  label?: string;
  ip?: string;
  userAgent?: string;
  byUserId?: string;
  note?: string;
};

export type PairedDevice = {
  id: string;
  slot: DeviceSlot;
  label: string;
  pairedAt: string;
  lastSeenAt?: string;
  userAgent?: string;
  /** IP publique au moment du jumelage */
  pairedFromIp?: string;
  /** Dernière IP publique vue (heartbeat / statut) */
  lastIp?: string;
};

export type PrinterConfig = {
  kitchenLanIp?: string;
  counterLanIp?: string;
};

export type SumupReaderConfig = {
  id: string;
  name: string;
  pairedAt: string;
};

export type PairingCodeEntry = {
  slot: DeviceSlot;
  label: string;
  expiresAt: string;
};

export type WanIpCapture = {
  ip: string;
  at: string;
  byUserId?: string;
};

/** Présence apps sans jumelage (totem / livreur) — heartbeat client. */
export type AppPresenceSession = {
  lastSeenAt: string;
  lastIp?: string;
  userAgent?: string;
  driverId?: string;
  driverName?: string;
};

export type AppPresence = {
  kiosk?: AppPresenceSession;
  /** Sessions livreur actives (par driverId ou anonyme). */
  livreur?: AppPresenceSession[];
};

export type DevicesSettings = {
  onboardingComplete?: boolean;
  allowedWanIps?: string[];
  pairedDevices?: PairedDevice[];
  printers?: PrinterConfig;
  sumupReader?: SumupReaderConfig;
  pairingCodes?: Record<string, PairingCodeEntry>;
  recipeCompletedAt?: string;
  lastWanIpCapture?: WanIpCapture;
  /** Journal jumelage / réseau (100 dernières entrées) */
  deviceAuditLog?: DeviceAuditEntry[];
  appPresence?: AppPresence;
};

export type DevicesAccessStatus = {
  onboardingComplete: boolean;
  ipAllowed: boolean;
  wanIpConfigured: boolean;
  clientIp: string | null;
  allowedWanIps: string[];
  gateSkipped: boolean;
  message?: string;
};

const PAIRING_TTL_MS = 15 * 60 * 1000;
const DEVICE_AUDIT_MAX = 100;

/** IP connues de crawlers / cloud — ne jamais whitelister comme IP boutique. */
const SUSPICIOUS_WAN_PREFIXES = [
  '66.249.', // Googlebot
  '66.102.', // Google
  '34.102.', // GCP crawl
  '34.118.', // GCP
  '35.191.', // GCP LB
];

export function isSuspiciousWanIp(ip: string): boolean {
  const base = ip.trim().split('/')[0] ?? '';
  return SUSPICIOUS_WAN_PREFIXES.some(prefix => base.startsWith(prefix));
}

export function countPairedInSlot(devices: DevicesSettings, slot: DeviceSlot): number {
  return (devices.pairedDevices ?? []).filter(d => d.slot === slot).length;
}

export function isSlotAtCapacity(devices: DevicesSettings, slot: DeviceSlot): boolean {
  return countPairedInSlot(devices, slot) >= DEVICE_SLOT_LIMITS[slot];
}

export function canGeneratePairingCode(
  devices: DevicesSettings,
  slot: DeviceSlot
): { ok: true } | { ok: false; error: string } {
  if (isSlotAtCapacity(devices, slot)) {
    return {
      ok: false,
      error: `« ${DEVICE_SLOT_LABELS[slot]} » est déjà jumelé — dissociez l'appareil actuel avant de générer un code.`,
    };
  }
  return { ok: true };
}

export function getSlotCapacitySummary(devices: DevicesSettings): {
  slot: DeviceSlot;
  label: string;
  limit: number;
  used: number;
  available: number;
}[] {
  return (Object.keys(DEVICE_SLOT_LIMITS) as DeviceSlot[]).map(slot => ({
    slot,
    label: DEVICE_SLOT_LABELS[slot],
    limit: DEVICE_SLOT_LIMITS[slot],
    used: countPairedInSlot(devices, slot),
    available: Math.max(0, DEVICE_SLOT_LIMITS[slot] - countPairedInSlot(devices, slot)),
  }));
}

export function appendDeviceAudit(
  devices: DevicesSettings,
  entry: Omit<DeviceAuditEntry, 'at'> & { at?: string }
): DevicesSettings {
  const log = devices.deviceAuditLog ?? [];
  const next: DeviceAuditEntry = { ...entry, at: entry.at ?? new Date().toISOString() };
  return { ...devices, deviceAuditLog: [next, ...log].slice(0, DEVICE_AUDIT_MAX) };
}

export function buildDeviceInventory(devices: DevicesSettings): DeviceAuditEntry {
  const lines = (devices.pairedDevices ?? []).map(
    d =>
      `${DEVICE_SLOT_LABELS[d.slot]}: ${d.label} (${d.pairedFromIp ?? d.lastIp ?? 'IP inconnue'})`
  );
  return {
    at: new Date().toISOString(),
    action: 'INVENTORY',
    note: lines.length ? lines.join(' · ') : 'Aucun appareil jumelé',
  };
}

export function parseDevicesSettings(raw: unknown): DevicesSettings {
  if (!raw || typeof raw !== 'object') return {};
  return raw as DevicesSettings;
}

export function getDevicesFromSettings(settings: BusinessSettingsJson): DevicesSettings {
  return parseDevicesSettings(settings.devices);
}

export function mergeDevicesSettings(
  settings: BusinessSettingsJson,
  patch: Partial<DevicesSettings>
): BusinessSettingsJson {
  return {
    ...settings,
    devices: {
      ...getDevicesFromSettings(settings),
      ...patch,
    },
  };
}

export function getClientIp(req: Request): string | null {
  return getPublicClientIp(req);
}

/** IPv4 privée / loopback / lien local — à exclure pour l'IP WAN boutique. */
export function isPrivateOrReservedIp(ip: string): boolean {
  const trimmed = ip.trim().split('/')[0] ?? '';
  const n = ipv4ToInt(trimmed);
  if (n === null) return true;
  // 0.0.0.0/8, 10/8, 127/8, 169.254/16, 172.16/12, 192.168/16
  if ((n & 0xff000000) === 0x00000000) return true;
  if ((n & 0xff000000) === 0x0a000000) return true;
  if ((n & 0xff000000) === 0x7f000000) return true;
  if ((n & 0xffff0000) === 0xa9fe0000) return true;
  if ((n & 0xfff00000) === 0xac100000) return true;
  if ((n & 0xffff0000) === 0xc0a80000) return true;
  return false;
}

/**
 * IP publique du client — ignore les hops Docker/Traefik (172.16.x, 10.x…).
 * Chaîne X-Forwarded-For : le client d'origine est en général le 1er hop public.
 */
export function getPublicClientIp(req: Request): string | null {
  const candidates: string[] = [];

  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    candidates.push(
      ...forwarded
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
    );
  } else if (Array.isArray(forwarded)) {
    for (const entry of forwarded) {
      candidates.push(
        ...entry
          .split(',')
          .map(s => s.trim())
          .filter(Boolean)
      );
    }
  }

  for (const header of ['cf-connecting-ip', 'true-client-ip', 'x-real-ip'] as const) {
    const value = req.headers[header];
    if (typeof value === 'string' && value.trim()) candidates.push(value.trim());
  }

  if (req.ip) candidates.push(req.ip);

  for (const ip of candidates) {
    const base = ip.split('/')[0]?.trim() ?? '';
    if (base && !isPrivateOrReservedIp(base)) return base;
  }

  return candidates[0]?.split('/')[0]?.trim() ?? null;
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    const v = Number(p);
    if (!Number.isInteger(v) || v < 0 || v > 255) return null;
    n = (n << 8) + v;
  }
  return n >>> 0;
}

function ipMatchesCidr(ip: string, cidr: string): boolean {
  const trimmed = cidr.trim();
  if (!trimmed) return false;
  if (!trimmed.includes('/')) return ip === trimmed;
  const [base, bitsStr] = trimmed.split('/');
  const bits = Number(bitsStr);
  if (!base || !Number.isInteger(bits) || bits < 0 || bits > 32) return false;
  const ipInt = ipv4ToInt(ip);
  const baseInt = ipv4ToInt(base);
  if (ipInt === null || baseInt === null) return false;
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ipInt & mask) === (baseInt & mask);
}

export function isIpAllowed(clientIp: string | null, allowedWanIps: string[] | undefined): boolean {
  if (!allowedWanIps?.length) return true;
  if (!clientIp) return false;
  return allowedWanIps.some(entry => ipMatchesCidr(clientIp, entry));
}

export function shouldSkipDeviceGate(req?: Request): boolean {
  if (process.env.DEVICE_ONBOARDING_GATE === 'false') return true;
  if (process.env.NODE_ENV !== 'production') return true;
  if (!req) return false;
  const host = (req.headers.host ?? '').split(':')[0]?.toLowerCase();
  return host === 'localhost' || host === '127.0.0.1';
}

export function getDevicesAccessStatus(
  devices: DevicesSettings,
  clientIp: string | null,
  gateSkipped: boolean
): DevicesAccessStatus {
  const allowedWanIps = devices.allowedWanIps ?? [];
  const wanIpConfigured = allowedWanIps.length > 0;
  const onboardingComplete = devices.onboardingComplete === true;
  const ipAllowed = gateSkipped || isIpAllowed(clientIp, allowedWanIps);

  let message: string | undefined;
  if (!gateSkipped && !wanIpConfigured) {
    message =
      'IP boutique non enregistrée — le gérant doit le faire depuis le CRM (Appareils → Réseau).';
  } else if (!gateSkipped && wanIpConfigured && !ipAllowed) {
    message = 'Accès réservé au réseau du restaurant (IP WAN non autorisée).';
  }

  return {
    onboardingComplete,
    ipAllowed,
    wanIpConfigured,
    clientIp,
    allowedWanIps,
    gateSkipped,
    message,
  };
}

export function canAccessDeviceApps(status: DevicesAccessStatus): boolean {
  if (status.gateSkipped) return true;
  return status.wanIpConfigured && status.ipAllowed;
}

export function isDeviceRegistered(devices: DevicesSettings, deviceId: string): boolean {
  return (devices.pairedDevices ?? []).some(d => d.id === deviceId);
}

const DEVICE_TOUCH_INTERVAL_MS = 60_000;

export function touchPairedDevice(
  devices: DevicesSettings,
  deviceId: string,
  opts?: { userAgent?: string; clientIp?: string | null }
): DevicesSettings {
  const now = Date.now();
  let changed = false;
  const pairedDevices = (devices.pairedDevices ?? []).map(d => {
    if (d.id !== deviceId) return d;
    const lastSeenMs = d.lastSeenAt ? Date.parse(d.lastSeenAt) : 0;
    const nextIp = opts?.clientIp ?? d.lastIp;
    const nextUa = opts?.userAgent ?? d.userAgent;
    const ipChanged = Boolean(opts?.clientIp && opts.clientIp !== d.lastIp);
    const uaChanged = Boolean(opts?.userAgent && opts.userAgent !== d.userAgent);
    if (now - lastSeenMs < DEVICE_TOUCH_INTERVAL_MS && !ipChanged && !uaChanged) {
      return d;
    }
    changed = true;
    return {
      ...d,
      lastSeenAt: new Date().toISOString(),
      userAgent: nextUa,
      lastIp: nextIp,
    };
  });
  if (!changed) return devices;
  return { ...devices, pairedDevices };
}

const APP_PRESENCE_INTERVAL_MS = 45_000;
const LIVREUR_SESSION_MAX = 12;

export function touchAppPresence(
  devices: DevicesSettings,
  app: 'kiosk' | 'livreur',
  opts?: {
    clientIp?: string | null;
    userAgent?: string;
    driverId?: string;
    driverName?: string;
  }
): DevicesSettings {
  const nowIso = new Date().toISOString();
  const now = Date.now();
  const presence = { ...(devices.appPresence ?? {}) };

  if (app === 'kiosk') {
    const prev = presence.kiosk;
    const lastMs = prev?.lastSeenAt ? Date.parse(prev.lastSeenAt) : 0;
    if (now - lastMs < APP_PRESENCE_INTERVAL_MS && prev) {
      return devices;
    }
    presence.kiosk = {
      lastSeenAt: nowIso,
      lastIp: opts?.clientIp ?? prev?.lastIp,
      userAgent: opts?.userAgent ?? prev?.userAgent,
    };
    return { ...devices, appPresence: presence };
  }

  const sessions = [...(presence.livreur ?? [])];
  const key = opts?.driverId?.trim() || '_anon';
  const idx = sessions.findIndex(s => (s.driverId?.trim() || '_anon') === key);
  const prev = idx >= 0 ? sessions[idx] : undefined;
  const lastMs = prev?.lastSeenAt ? Date.parse(prev.lastSeenAt) : 0;
  const next: AppPresenceSession = {
    lastSeenAt: nowIso,
    lastIp: opts?.clientIp ?? prev?.lastIp,
    userAgent: opts?.userAgent ?? prev?.userAgent,
    driverId: opts?.driverId ?? prev?.driverId,
    driverName: opts?.driverName ?? prev?.driverName,
  };
  if (idx >= 0) {
    if (now - lastMs < APP_PRESENCE_INTERVAL_MS) return devices;
    sessions[idx] = next;
  } else {
    sessions.unshift(next);
  }
  presence.livreur = sessions
    .sort((a, b) => Date.parse(b.lastSeenAt) - Date.parse(a.lastSeenAt))
    .slice(0, LIVREUR_SESSION_MAX);
  return { ...devices, appPresence: presence };
}

/** Présence considérée « en ligne » si vue récemment. */
export const APP_ONLINE_WINDOW_MS = 3 * 60_000;

export function isPresenceFresh(
  lastSeenAt: string | null | undefined,
  windowMs = APP_ONLINE_WINDOW_MS
): boolean {
  if (!lastSeenAt) return false;
  const ms = Date.parse(lastSeenAt);
  if (!Number.isFinite(ms)) return false;
  return Date.now() - ms <= windowMs;
}

export function generatePairingCode(): string {
  return String(randomInt(100000, 999999));
}

export function createPairingCodeEntry(
  slot: DeviceSlot,
  label: string
): {
  code: string;
  entry: PairingCodeEntry;
} {
  const code = generatePairingCode();
  return {
    code,
    entry: {
      slot,
      label,
      expiresAt: new Date(Date.now() + PAIRING_TTL_MS).toISOString(),
    },
  };
}

export function pruneExpiredPairingCodes(
  codes: Record<string, PairingCodeEntry> | undefined
): Record<string, PairingCodeEntry> {
  if (!codes) return {};
  const now = Date.now();
  const next: Record<string, PairingCodeEntry> = {};
  for (const [code, entry] of Object.entries(codes)) {
    if (new Date(entry.expiresAt).getTime() > now) next[code] = entry;
  }
  return next;
}

export function pairDeviceWithCode(
  devices: DevicesSettings,
  code: string,
  opts?: { userAgent?: string; clientIp?: string | null }
): { devices: DevicesSettings; device: PairedDevice } | { error: string } {
  const normalized = code.replace(/\D/g, '').slice(0, 6);
  if (normalized.length !== 6) return { error: 'Code à 6 chiffres requis' };

  const entry = devices.pairingCodes?.[normalized];
  if (!entry) {
    return {
      error:
        'Code invalide ou expiré — générez un nouveau code dans le CRM (Appareils → onglet correspondant).',
    };
  }
  if (new Date(entry.expiresAt).getTime() <= Date.now()) {
    return { error: 'Code expiré — générez-en un nouveau dans le CRM (valide 15 min).' };
  }

  if (isSlotAtCapacity(devices, entry.slot)) {
    return {
      error: `« ${DEVICE_SLOT_LABELS[entry.slot]} » est déjà jumelé — dissociez l'appareil dans le CRM avant de jumeler le remplaçant.`,
    };
  }

  const clientIp = opts?.clientIp?.trim() || undefined;
  const paired: PairedDevice = {
    id: randomUUID(),
    slot: entry.slot,
    label: entry.label,
    pairedAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
    userAgent: opts?.userAgent,
    pairedFromIp: clientIp,
    lastIp: clientIp,
  };

  const pairingCodes = { ...devices.pairingCodes };
  delete pairingCodes[normalized];

  const pairedDevices = [...(devices.pairedDevices ?? []), paired];

  let next: DevicesSettings = {
    ...devices,
    pairingCodes: pruneExpiredPairingCodes(pairingCodes),
    pairedDevices,
  };
  next = appendDeviceAudit(next, {
    action: 'PAIR',
    slot: paired.slot,
    deviceId: paired.id,
    label: paired.label,
    ip: clientIp,
    userAgent: opts?.userAgent,
    note: `Jumelage ${DEVICE_SLOT_LABELS[paired.slot]}`,
  });
  next = appendDeviceAudit(next, buildDeviceInventory(next));

  return { devices: next, device: paired };
}

export function unpairDeviceById(
  devices: DevicesSettings,
  deviceId: string,
  byUserId?: string
): { devices: DevicesSettings; removed: PairedDevice | null } {
  const removed = (devices.pairedDevices ?? []).find(d => d.id === deviceId) ?? null;
  const pairedDevices = (devices.pairedDevices ?? []).filter(d => d.id !== deviceId);
  let next: DevicesSettings = { ...devices, pairedDevices };
  if (removed) {
    next = appendDeviceAudit(next, {
      action: 'UNPAIR',
      slot: removed.slot,
      deviceId: removed.id,
      label: removed.label,
      ip: removed.lastIp ?? removed.pairedFromIp,
      byUserId,
      note: `Dissociation ${DEVICE_SLOT_LABELS[removed.slot]}`,
    });
    next = appendDeviceAudit(next, buildDeviceInventory(next));
  }
  return { devices: next, removed };
}

export function normalizeWanIp(ip: string): string {
  const trimmed = ip.trim();
  if (trimmed.includes('/')) return trimmed;
  return `${trimmed}/32`;
}

export function stripPrivateWanIps(devices: DevicesSettings): DevicesSettings {
  const allowedWanIps = (devices.allowedWanIps ?? []).filter(entry => {
    const base = entry.split('/')[0] ?? entry;
    return !isPrivateOrReservedIp(base) && !isSuspiciousWanIp(base);
  });
  // Une seule IP boutique en prod
  const single = allowedWanIps.length > 1 ? [allowedWanIps[0]!] : allowedWanIps;
  if (
    single.length === (devices.allowedWanIps?.length ?? 0) &&
    single.every((ip, i) => ip === devices.allowedWanIps?.[i])
  ) {
    return devices;
  }
  return { ...devices, allowedWanIps: single };
}

/** Remplace l'IP WAN boutique par une seule entrée (pas d'accumulation). */
export function setShopWanIp(devices: DevicesSettings, ip: string): DevicesSettings {
  const base = ip.trim().split('/')[0] ?? '';
  if (!base || isPrivateOrReservedIp(base) || isSuspiciousWanIp(base)) return devices;
  const entry = normalizeWanIp(base);
  const current = devices.allowedWanIps ?? [];
  if (current.length === 1 && current[0] === entry) return devices;
  return { ...devices, allowedWanIps: [entry] };
}

export function addWanIp(devices: DevicesSettings, ip: string): DevicesSettings {
  return setShopWanIp(devices, ip);
}

function clientIpAlreadyAllowed(devices: DevicesSettings, clientIp: string): boolean {
  const entry = normalizeWanIp(clientIp);
  return (devices.allowedWanIps ?? []).includes(entry);
}

/**
 * Enregistre l'IP publique du client (1er jumelage ou capture CRM).
 * Une seule IP boutique — ignore bots et IP privées.
 */
export function ensureShopWanIpFromClient(
  devices: DevicesSettings,
  clientIp: string | null,
  gateSkipped: boolean
): DevicesSettings {
  const next = stripPrivateWanIps(devices);
  if (gateSkipped) return next;
  if (!clientIp || isPrivateOrReservedIp(clientIp) || isSuspiciousWanIp(clientIp)) return next;

  const needsIp = !next.allowedWanIps?.length;
  const autoWan = process.env.DEVICE_AUTO_WAN_IP === 'true';
  const alreadyAllowed = clientIpAlreadyAllowed(next, clientIp);

  if (needsIp || (autoWan && !alreadyAllowed)) {
    return setShopWanIp(next, clientIp);
  }
  return next;
}
