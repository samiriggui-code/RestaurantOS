import type { PrismaClient } from '@prisma/client';
import { withDbRetry } from '../db-ready';
import { logFiscalEvent } from './events';
import { repairFiscalEventChain } from './repair-jet-chain';
import { verifyFiscalChains } from './verify-chain';

const softwareVersion = (): string => process.env.FISCAL_SOFTWARE_VERSION ?? '1.0.0';

/** Labo : recalcule les empreintes si un redeploy a cassé la chaîne. */
export async function ensureFiscalChainHealthy(prisma: PrismaClient): Promise<void> {
  if (process.env.FISCAL_ALLOW_JET_REPAIR !== 'true') return;

  const businesses = await withDbRetry(() => prisma.business.findMany({ select: { id: true } }), {
    label: 'fiscal',
  });
  for (const biz of businesses) {
    const verify = await verifyFiscalChains(prisma, biz.id);
    if (verify.ok) continue;
    console.warn(`[fiscal] Chaîne compromise (${biz.id}) : ${verify.message}`);
    const result = await repairFiscalEventChain(prisma, biz.id);
    console.log(`[fiscal] Réparation auto JET : ${result.message}`);
  }
}

/** Évite un SOFTWARE_START à chaque redémarrage Docker (sinon rupture chaîne en labo). */
export async function logFiscalSoftwareStart(prisma: PrismaClient): Promise<void> {
  try {
    const businesses = await withDbRetry(() => prisma.business.findMany({ select: { id: true } }), {
      label: 'fiscal',
    });
    const version = softwareVersion();
    const since = new Date(Date.now() - 6 * 60 * 60 * 1000);

    for (const biz of businesses) {
      const recent = await prisma.fiscalEvent.findFirst({
        where: {
          businessId: biz.id,
          eventType: 'SOFTWARE_START',
          createdAt: { gte: since },
        },
        orderBy: { createdAt: 'desc' },
        select: { payload: true },
      });
      const recentVersion =
        recent?.payload &&
        typeof recent.payload === 'object' &&
        recent.payload !== null &&
        'softwareVersion' in recent.payload
          ? String((recent.payload as { softwareVersion?: string }).softwareVersion)
          : null;
      if (recentVersion === version) continue;

      await logFiscalEvent(prisma, {
        businessId: biz.id,
        eventType: 'SOFTWARE_START',
        payload: {
          softwareVersion: version,
          nodeEnv: process.env.NODE_ENV ?? 'development',
        },
      });
    }
    console.log(`[fiscal] JET SOFTWARE_START — ${businesses.length} établissement(s)`);
  } catch (err) {
    console.error('[fiscal] SOFTWARE_START failed:', err);
  }
}
