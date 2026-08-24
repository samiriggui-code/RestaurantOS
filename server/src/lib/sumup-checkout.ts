/**
 * Client Cloud API SumUp — Checkout en ligne (paiement carte sur le site public).
 * Distinct de `sumup.ts` (lecteur Solo comptoir, endpoints `/merchants/{code}/readers/...`).
 * Réf. developer.sumup.com/api/checkouts/ — comme pour le lecteur, pas de signature de
 * webhook côté SumUp : toujours re-vérifier le statut via GET /checkouts/{id}.
 *
 * `amount` est en unités majeures décimales (ex. 10.1 pour 10,10 €), pas en centimes.
 */

import { sumupApiKey, sumupMerchantCode } from './sumup-config';
import { SumupApiError } from './sumup';

const SUMUP_API_ROOT = 'https://api.sumup.com';

/** `path` doit inclure sa propre version d'API (ex. `/v0.1/checkouts`, `/v1.0/merchants/...`). */
async function sumupCheckoutFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const apiKey = sumupApiKey();
  if (!apiKey) throw new SumupApiError('SUMUP_API_KEY non configuré', 400);

  const res = await fetch(`${SUMUP_API_ROOT}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const body = text ? JSON.parse(text) : undefined;

  if (!res.ok) {
    const message =
      (body &&
        typeof body === 'object' &&
        'message' in body &&
        String((body as { message: unknown }).message)) ||
      `Erreur SumUp (${res.status})`;
    throw new SumupApiError(message, res.status);
  }

  return body as T;
}

function centsToAmount(amountCents: number): number {
  return Math.round(amountCents) / 100;
}

export type SumupCheckoutTransaction = {
  id: string;
  status: string;
  payment_type?: string;
};

export type SumupCheckout = {
  id: string;
  status: 'PENDING' | 'FAILED' | 'PAID' | 'EXPIRED' | string;
  checkout_reference: string;
  amount: number;
  currency: string;
  transactions?: SumupCheckoutTransaction[];
};

export async function createSumupCheckout(params: {
  amountCents: number;
  currency: string;
  reference: string;
  description?: string;
  returnUrl: string;
}): Promise<{ checkoutId: string; status: string }> {
  const merchantCode = sumupMerchantCode();
  if (!merchantCode) throw new SumupApiError('SUMUP_MERCHANT_CODE non configuré', 400);

  const checkout = await sumupCheckoutFetch<SumupCheckout>('/v0.1/checkouts', {
    method: 'POST',
    body: JSON.stringify({
      checkout_reference: params.reference,
      amount: centsToAmount(params.amountCents),
      currency: params.currency,
      merchant_code: merchantCode,
      description: params.description,
      return_url: params.returnUrl,
    }),
  });

  return { checkoutId: checkout.id, status: checkout.status };
}

export async function getSumupCheckoutStatus(checkoutId: string): Promise<SumupCheckout> {
  return sumupCheckoutFetch<SumupCheckout>(`/v0.1/checkouts/${checkoutId}`);
}

export async function refundSumupTransaction(
  transactionId: string,
  amountCents?: number
): Promise<void> {
  const merchantCode = sumupMerchantCode();
  if (!merchantCode) throw new SumupApiError('SUMUP_MERCHANT_CODE non configuré', 400);

  await sumupCheckoutFetch<void>(
    `/v1.0/merchants/${merchantCode}/payments/${transactionId}/refunds`,
    {
      method: 'POST',
      body:
        amountCents != null ? JSON.stringify({ amount: centsToAmount(amountCents) }) : undefined,
    }
  );
}
