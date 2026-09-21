import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import type { OrderChannel } from './order-channel';
import {
  parseBusinessSettings,
  type BusinessSettingsJson,
  type MarketplaceIntegrationState,
} from './business-settings';
import { getBusinessId } from './business';
import { maskSecretHint } from './sumup-config';

export type MarketplaceProvider = 'deliveroo' | 'ubereats';

const PROVIDER_CHANNEL: Record<MarketplaceProvider, OrderChannel> = {
  deliveroo: 'DELIVEROO',
  ubereats: 'UBER_EATS',
};

const PROVIDER_ENV_SECRET: Record<MarketplaceProvider, string> = {
  deliveroo: 'DELIVEROO_WEBHOOK_SECRET',
  ubereats: 'UBER_EATS_WEBHOOK_SECRET',
};

export function marketplaceChannel(provider: MarketplaceProvider): OrderChannel {
  return PROVIDER_CHANNEL[provider];
}

function integrationKey(provider: MarketplaceProvider): 'deliveroo' | 'ubereats' {
  return provider;
}

export function getMarketplaceIntegrationState(
  settings: BusinessSettingsJson,
  provider: MarketplaceProvider
): MarketplaceIntegrationState {
  return settings.integrations?.[integrationKey(provider)] ?? {};
}

/** Secret BDD prioritaire, sinon .env legacy. */
export function resolveMarketplaceWebhookSecret(
  settings: BusinessSettingsJson,
  provider: MarketplaceProvider
): string | null {
  const fromDb = getMarketplaceIntegrationState(settings, provider).webhookSecret?.trim();
  if (fromDb) return fromDb;
  const envKey = PROVIDER_ENV_SECRET[provider];
  const fromEnv = process.env[envKey]?.trim();
  return fromEnv || null;
}

/** @deprecated préférer resolveMarketplaceWebhookSecret(settings) — repli env seul */
export function marketplaceWebhookSecret(provider: MarketplaceProvider): string | null {
  const key = PROVIDER_ENV_SECRET[provider];
  const value = process.env[key]?.trim();
  return value || null;
}

export function isMarketplaceWebhookConfigured(
  settings: BusinessSettingsJson,
  provider: MarketplaceProvider
): boolean {
  return Boolean(resolveMarketplaceWebhookSecret(settings, provider));
}

export async function loadBusinessSettings(
  prisma: PrismaClient,
  businessId: string
): Promise<BusinessSettingsJson> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { settings: true },
  });
  return parseBusinessSettings(business?.settings);
}

export async function touchMarketplaceIntegration(
  prisma: PrismaClient,
  businessId: string,
  provider: MarketplaceProvider,
  patch: Partial<MarketplaceIntegrationState>
): Promise<MarketplaceIntegrationState> {
  const settings = await loadBusinessSettings(prisma, businessId);
  const key = integrationKey(provider);
  const prev = settings.integrations?.[key] ?? {};
  const next: MarketplaceIntegrationState = {
    ...prev,
    ...patch,
    enabled: patch.enabled ?? prev.enabled ?? true,
    orderCount: patch.orderCount ?? prev.orderCount ?? 0,
  };
  const integrations = { ...settings.integrations, [key]: next };
  await prisma.business.update({
    where: { id: businessId },
    data: { settings: { ...settings, integrations } as object },
  });
  return next;
}

export async function saveMarketplaceWebhookSecret(
  prisma: PrismaClient,
  businessId: string,
  provider: MarketplaceProvider,
  secret: string | null
): Promise<{ configured: boolean; secretHint: string | null; source: 'settings' | 'env' | null }> {
  const settings = await loadBusinessSettings(prisma, businessId);
  const key = integrationKey(provider);
  const prev = settings.integrations?.[key] ?? {};
  const trimmed = secret?.trim() || '';
  const next: MarketplaceIntegrationState = {
    ...prev,
    enabled: trimmed ? true : (prev.enabled ?? false),
  };
  if (trimmed) next.webhookSecret = trimmed;
  else delete next.webhookSecret;

  await prisma.business.update({
    where: { id: businessId },
    data: {
      settings: {
        ...settings,
        integrations: { ...settings.integrations, [key]: next },
      } as object,
    },
  });

  const refreshed = await loadBusinessSettings(prisma, businessId);
  const resolved = resolveMarketplaceWebhookSecret(refreshed, provider);
  const fromDb = Boolean(getMarketplaceIntegrationState(refreshed, provider).webhookSecret?.trim());
  return {
    configured: Boolean(resolved),
    secretHint: maskSecretHint(resolved),
    source: fromDb ? 'settings' : resolved ? 'env' : null,
  };
}

export function generateMarketplaceWebhookSecret(): string {
  return randomBytes(24).toString('base64url');
}

export type IntegrationStatusRow = {
  id: MarketplaceProvider;
  configured: boolean;
  enabled: boolean;
  lastWebhookAt: string | null;
  lastOrderAt: string | null;
  lastError: string | null;
  orderCount: number;
  secretHint: string | null;
  source: 'settings' | 'env' | null;
};

export async function getIntegrationsStatus(
  prisma: PrismaClient,
  businessId: string
): Promise<{ businessId: string; marketplaces: IntegrationStatusRow[] }> {
  const settings = await loadBusinessSettings(prisma, businessId);

  const providers: MarketplaceProvider[] = ['deliveroo', 'ubereats'];
  const marketplaces: IntegrationStatusRow[] = providers.map(id => {
    const state = getMarketplaceIntegrationState(settings, id);
    const secret = resolveMarketplaceWebhookSecret(settings, id);
    const configured = Boolean(secret);
    const fromDb = Boolean(state.webhookSecret?.trim());
    return {
      id,
      configured,
      enabled: state.enabled ?? configured,
      lastWebhookAt: state.lastWebhookAt ?? null,
      lastOrderAt: state.lastOrderAt ?? null,
      lastError: state.lastError ?? null,
      orderCount: state.orderCount ?? 0,
      secretHint: maskSecretHint(secret),
      source: fromDb ? 'settings' : secret ? 'env' : null,
    };
  });

  return {
    businessId: businessId || getBusinessId(),
    marketplaces,
  };
}

/** Vérifie Bearer token ou HMAC SHA-256 (header X-Webhook-Signature). */
export function verifyMarketplaceWebhookAuth(
  provider: MarketplaceProvider,
  rawBody: string,
  headers: Record<string, string | string[] | undefined>,
  secretOverride?: string | null
): { ok: boolean; error?: string } {
  const secret = secretOverride !== undefined ? secretOverride : marketplaceWebhookSecret(provider);
  if (!secret) {
    return { ok: false, error: 'webhook_secret_not_configured' };
  }

  const auth = String(headers.authorization ?? '');
  if (auth.startsWith('Bearer ') && auth.slice(7) === secret) {
    return { ok: true };
  }

  const signature = String(
    headers['x-webhook-signature'] ?? headers['x-deliveroo-signature'] ?? ''
  );
  if (!signature) {
    return { ok: false, error: 'missing_signature' };
  }

  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  const provided = signature.replace(/^sha256=/i, '');
  try {
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(provided, 'utf8');
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return { ok: false, error: 'invalid_signature' };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: 'invalid_signature' };
  }
}
