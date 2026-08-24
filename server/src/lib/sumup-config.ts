/** Clés SumUp Cloud API — lecteur Solo piloté serveur (checkout carte comptoir). */

function cleanEnv(value: string): string {
  let v = (value ?? '').trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1).trim();
  }
  return v;
}

export function sumupApiKey(): string {
  return cleanEnv(process.env.SUMUP_API_KEY ?? '');
}

export function sumupMerchantCode(): string {
  return cleanEnv(process.env.SUMUP_MERCHANT_CODE ?? '');
}

export function isSumupConfigured(): boolean {
  return Boolean(sumupApiKey() && sumupMerchantCode());
}
