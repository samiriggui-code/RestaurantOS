import type { PrismaClient } from '@prisma/client';
import { AsyncLocalStorage } from 'node:async_hooks';
import { parseBusinessSettings, type BusinessSettingsJson } from '../business-settings';

export type PennylaneSettings = {
  /** Token API société (Pennylane → Paramètres → API). Stocké en BDD, pas en .env VPS. */
  apiToken?: string;
  /** true = facture poussée en brouillon (défaut). false = émission directe. */
  invoiceDraft?: boolean;
};

export type PennylaneResolvedConfig = {
  token: string | null;
  /** 'settings' = backoffice, 'env' = repli legacy VPS, null = absent */
  source: 'settings' | 'env' | null;
  invoiceDraft: boolean;
  /** Aperçu masqué pour l’UI (••••abcd) */
  tokenHint: string | null;
};

const tokenStore = new AsyncLocalStorage<string>();

export function getPennylaneSettings(settings: BusinessSettingsJson): PennylaneSettings {
  return settings.integrations?.pennylane ?? {};
}

export function maskPennylaneToken(token: string): string {
  const t = token.trim();
  if (t.length <= 4) return '••••';
  return `••••${t.slice(-4)}`;
}

export async function resolvePennylaneConfig(
  prisma: PrismaClient,
  businessId: string
): Promise<PennylaneResolvedConfig> {
  let fromSettings: string | undefined;
  let invoiceDraft = true;

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { settings: true },
  });
  const settings = parseBusinessSettings(business?.settings);
  const pl = getPennylaneSettings(settings);
  if (typeof pl.apiToken === 'string' && pl.apiToken.trim()) {
    fromSettings = pl.apiToken.trim();
  }
  if (typeof pl.invoiceDraft === 'boolean') {
    invoiceDraft = pl.invoiceDraft;
  } else if (process.env.PENNYLANE_INVOICE_DRAFT === 'false') {
    invoiceDraft = false;
  }

  const fromEnv = process.env.PENNYLANE_API_TOKEN?.trim() || undefined;
  const token = fromSettings || fromEnv || null;
  const source: PennylaneResolvedConfig['source'] = fromSettings
    ? 'settings'
    : fromEnv
      ? 'env'
      : null;

  return {
    token,
    source,
    invoiceDraft,
    tokenHint: token ? maskPennylaneToken(token) : null,
  };
}

/** Exécute un bloc d’appels API avec le token résolu (backoffice ou env). */
export function runWithPennylaneToken<T>(token: string, fn: () => Promise<T>): Promise<T> {
  return tokenStore.run(token.trim(), fn);
}

export function getActivePennylaneToken(): string | null {
  return tokenStore.getStore()?.trim() || null;
}

export async function savePennylaneSettings(
  prisma: PrismaClient,
  businessId: string,
  patch: { apiToken?: string | null; invoiceDraft?: boolean }
): Promise<PennylaneResolvedConfig> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { settings: true },
  });
  const settings = parseBusinessSettings(business?.settings);
  const prev = getPennylaneSettings(settings);
  const next: PennylaneSettings = { ...prev };

  if (patch.apiToken !== undefined) {
    const trimmed = patch.apiToken?.trim() ?? '';
    if (trimmed) next.apiToken = trimmed;
    else delete next.apiToken;
  }
  if (typeof patch.invoiceDraft === 'boolean') {
    next.invoiceDraft = patch.invoiceDraft;
  }

  const integrations = { ...settings.integrations, pennylane: next };
  await prisma.business.update({
    where: { id: businessId },
    data: { settings: { ...settings, integrations } as object },
  });

  return resolvePennylaneConfig(prisma, businessId);
}
