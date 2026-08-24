/** URL publique du serveur Express — cible du `return_url` SumUp (checkout + webhook). */

function cleanEnv(value: string): string {
  return (value ?? '').trim().replace(/\/+$/, '');
}

export function sumupWebhookUrl(): string | null {
  const base = cleanEnv(process.env.API_PUBLIC_BASE_URL ?? '');
  if (!base) return null;
  return `${base}/api/payments/sumup-checkout/webhook`;
}
