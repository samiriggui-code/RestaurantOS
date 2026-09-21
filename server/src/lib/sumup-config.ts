/** Clés SumUp Cloud API — lecteur Solo + checkout en ligne. Priorité BDD backoffice, repli .env. */

function cleanEnv(value: string): string {
  let v = (value ?? '').trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1).trim();
  }
  return v;
}

type SumupDbCreds = { apiKey: string; merchantCode: string };

/** Cache rempli au boot + après sauvegarde Intégrations (évite un await partout). */
let dbCreds: SumupDbCreds | null = null;

export function setSumupDbCredentials(creds: SumupDbCreds | null): void {
  if (!creds?.apiKey?.trim() || !creds?.merchantCode?.trim()) {
    dbCreds = null;
    return;
  }
  dbCreds = {
    apiKey: cleanEnv(creds.apiKey),
    merchantCode: cleanEnv(creds.merchantCode),
  };
}

export function sumupApiKey(): string {
  return cleanEnv(dbCreds?.apiKey || process.env.SUMUP_API_KEY || '');
}

export function sumupMerchantCode(): string {
  return cleanEnv(dbCreds?.merchantCode || process.env.SUMUP_MERCHANT_CODE || '');
}

export function isSumupConfigured(): boolean {
  return Boolean(sumupApiKey() && sumupMerchantCode());
}

export function sumupConfigSource(): 'settings' | 'env' | null {
  if (dbCreds?.apiKey && dbCreds?.merchantCode) return 'settings';
  if (
    cleanEnv(process.env.SUMUP_API_KEY || '') &&
    cleanEnv(process.env.SUMUP_MERCHANT_CODE || '')
  ) {
    return 'env';
  }
  return null;
}

export function maskSecretHint(value: string | null | undefined): string | null {
  const t = (value ?? '').trim();
  if (!t) return null;
  if (t.length <= 4) return '••••';
  return `••••${t.slice(-4)}`;
}

export function getSumupPublicStatus(): {
  configured: boolean;
  source: 'settings' | 'env' | null;
  apiKeyHint: string | null;
  merchantCode: string | null;
} {
  const key = sumupApiKey();
  const merchant = sumupMerchantCode();
  return {
    configured: Boolean(key && merchant),
    source: sumupConfigSource(),
    apiKeyHint: maskSecretHint(key),
    merchantCode: merchant || null,
  };
}
