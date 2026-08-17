import { createHmac, timingSafeEqual } from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import type { OrderChannel } from './order-channel'
import {
  parseBusinessSettings,
  type BusinessSettingsJson,
  type MarketplaceIntegrationState,
} from './business-settings'
import { getBusinessId } from './business'

export type MarketplaceProvider = 'deliveroo' | 'ubereats'

const PROVIDER_CHANNEL: Record<MarketplaceProvider, OrderChannel> = {
  deliveroo: 'DELIVEROO',
  ubereats: 'UBER_EATS',
}

const PROVIDER_ENV_SECRET: Record<MarketplaceProvider, string> = {
  deliveroo: 'DELIVEROO_WEBHOOK_SECRET',
  ubereats: 'UBER_EATS_WEBHOOK_SECRET',
}

export function marketplaceChannel(provider: MarketplaceProvider): OrderChannel {
  return PROVIDER_CHANNEL[provider]
}

export function marketplaceWebhookSecret(provider: MarketplaceProvider): string | null {
  const key = PROVIDER_ENV_SECRET[provider]
  const value = process.env[key]?.trim()
  return value || null
}

export function isMarketplaceWebhookConfigured(provider: MarketplaceProvider): boolean {
  return Boolean(marketplaceWebhookSecret(provider))
}

function integrationKey(provider: MarketplaceProvider): 'deliveroo' | 'ubereats' {
  return provider
}

export function getMarketplaceIntegrationState(
  settings: BusinessSettingsJson,
  provider: MarketplaceProvider,
): MarketplaceIntegrationState {
  return settings.integrations?.[integrationKey(provider)] ?? {}
}

export async function touchMarketplaceIntegration(
  prisma: PrismaClient,
  businessId: string,
  provider: MarketplaceProvider,
  patch: Partial<MarketplaceIntegrationState>,
) {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { settings: true },
  })
  const settings = parseBusinessSettings(business?.settings)
  const key = integrationKey(provider)
  const prev = settings.integrations?.[key] ?? {}
  const next: MarketplaceIntegrationState = {
    ...prev,
    ...patch,
    enabled: patch.enabled ?? prev.enabled ?? true,
    orderCount: patch.orderCount ?? prev.orderCount ?? 0,
  }
  const integrations = { ...settings.integrations, [key]: next }
  await prisma.business.update({
    where: { id: businessId },
    data: { settings: { ...settings, integrations } as object },
  })
  return next
}

export type IntegrationStatusRow = {
  id: MarketplaceProvider
  configured: boolean
  enabled: boolean
  lastWebhookAt: string | null
  lastOrderAt: string | null
  lastError: string | null
  orderCount: number
}

export async function getIntegrationsStatus(prisma: PrismaClient, businessId: string) {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { settings: true },
  })
  const settings = parseBusinessSettings(business?.settings)

  const providers: MarketplaceProvider[] = ['deliveroo', 'ubereats']
  const marketplaces: IntegrationStatusRow[] = providers.map((id) => {
    const state = getMarketplaceIntegrationState(settings, id)
    const configured = isMarketplaceWebhookConfigured(id)
    return {
      id,
      configured,
      enabled: state.enabled ?? configured,
      lastWebhookAt: state.lastWebhookAt ?? null,
      lastOrderAt: state.lastOrderAt ?? null,
      lastError: state.lastError ?? null,
      orderCount: state.orderCount ?? 0,
    }
  })

  return {
    businessId: businessId || getBusinessId(),
    marketplaces,
  }
}

/** Vérifie Bearer token ou HMAC SHA-256 (header X-Webhook-Signature). */
export function verifyMarketplaceWebhookAuth(
  provider: MarketplaceProvider,
  rawBody: string,
  headers: Record<string, string | string[] | undefined>,
): { ok: boolean; error?: string } {
  const secret = marketplaceWebhookSecret(provider)
  if (!secret) {
    return { ok: false, error: 'webhook_secret_not_configured' }
  }

  const auth = String(headers.authorization ?? '')
  if (auth.startsWith('Bearer ') && auth.slice(7) === secret) {
    return { ok: true }
  }

  const signature = String(headers['x-webhook-signature'] ?? headers['x-deliveroo-signature'] ?? '')
  if (!signature) {
    return { ok: false, error: 'missing_signature' }
  }

  const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
  const provided = signature.replace(/^sha256=/i, '')
  try {
    const a = Buffer.from(expected, 'utf8')
    const b = Buffer.from(provided, 'utf8')
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return { ok: false, error: 'invalid_signature' }
    }
    return { ok: true }
  } catch {
    return { ok: false, error: 'invalid_signature' }
  }
}
