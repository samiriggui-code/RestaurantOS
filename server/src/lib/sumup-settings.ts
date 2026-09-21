import type { PrismaClient } from '@prisma/client';
import { getBusinessId } from './business';
import { parseBusinessSettings } from './business-settings';
import { getSumupPublicStatus, maskSecretHint, setSumupDbCredentials } from './sumup-config';

export async function loadSumupCredentialsFromDb(
  prisma: PrismaClient,
  businessId = getBusinessId()
): Promise<void> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { settings: true },
  });
  const settings = parseBusinessSettings(business?.settings);
  const sumup = settings.integrations?.sumup;
  setSumupDbCredentials(
    sumup?.apiKey && sumup?.merchantCode
      ? { apiKey: sumup.apiKey, merchantCode: sumup.merchantCode }
      : null
  );
}

export async function saveSumupCredentials(
  prisma: PrismaClient,
  businessId: string,
  patch: { apiKey?: string | null; merchantCode?: string | null; clear?: boolean }
): Promise<ReturnType<typeof getSumupPublicStatus>> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { settings: true },
  });
  const settings = parseBusinessSettings(business?.settings);
  const prev = settings.integrations?.sumup ?? {};
  const next = { ...prev };

  if (patch.clear) {
    delete next.apiKey;
    delete next.merchantCode;
  } else {
    if (typeof patch.apiKey === 'string' && patch.apiKey.trim()) {
      next.apiKey = patch.apiKey.trim();
    }
    if (typeof patch.merchantCode === 'string' && patch.merchantCode.trim()) {
      next.merchantCode = patch.merchantCode.trim();
    }
  }

  const hasBoth = Boolean(next.apiKey?.trim() && next.merchantCode?.trim());
  await prisma.business.update({
    where: { id: businessId },
    data: {
      settings: {
        ...settings,
        integrations: {
          ...settings.integrations,
          sumup: hasBoth || Object.keys(next).length ? next : undefined,
        },
      } as object,
    },
  });

  setSumupDbCredentials(
    next.apiKey && next.merchantCode
      ? { apiKey: next.apiKey, merchantCode: next.merchantCode }
      : null
  );

  return getSumupPublicStatus();
}

export { maskSecretHint };
