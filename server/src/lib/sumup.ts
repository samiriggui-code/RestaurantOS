/**
 * Client Cloud API SumUp — lecteur Solo piloté serveur (appairage, checkout, statut, annulation).
 * Réf. developer.sumup.com/api/readers/ — pas de signature de webhook côté SumUp,
 * toujours re-vérifier le statut via l'API (GET checkout) plutôt que se fier à un callback.
 */

import { sumupApiKey, sumupMerchantCode } from './sumup-config';

const SUMUP_API_BASE = 'https://api.sumup.com/v0.1';

export class SumupApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'SumupApiError';
    this.status = status;
  }
}

async function sumupFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const apiKey = sumupApiKey();
  if (!apiKey) throw new SumupApiError('SUMUP_API_KEY non configuré', 400);

  const res = await fetch(`${SUMUP_API_BASE}${path}`, {
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

export type SumupReader = {
  id: string;
  name: string;
  status: string;
  device?: { identifier?: string; model?: string };
  created_at?: string;
  updated_at?: string;
};

export async function pairSumupReader(pairingCode: string, name: string): Promise<SumupReader> {
  const merchantCode = sumupMerchantCode();
  if (!merchantCode) throw new SumupApiError('SUMUP_MERCHANT_CODE non configuré', 400);

  return sumupFetch<SumupReader>(`/merchants/${merchantCode}/readers`, {
    method: 'POST',
    body: JSON.stringify({ pairing_code: pairingCode, name }),
  });
}

export type SumupReaderStatus = {
  status: 'ONLINE' | 'OFFLINE' | string;
  state?: string;
  battery_level?: number;
  connection_type?: string;
  firmware_version?: string;
};

export async function getSumupReaderStatus(readerId: string): Promise<SumupReaderStatus> {
  const merchantCode = sumupMerchantCode();
  if (!merchantCode) throw new SumupApiError('SUMUP_MERCHANT_CODE non configuré', 400);

  const res = await sumupFetch<{ data: SumupReaderStatus }>(
    `/merchants/${merchantCode}/readers/${readerId}/status`
  );
  return res.data;
}

export type SumupCheckoutStatus = {
  checkout_id: string;
  status: 'pending' | 'successful' | 'failed' | 'cancelled' | string;
  payment_status?: string;
  transaction_id?: string;
  total_amount?: { currency: string; minor_unit: number; value: number };
  created_at?: string;
  updated_at?: string;
};

export async function createSumupReaderCheckout(
  readerId: string,
  amountCents: number,
  reference: string,
  opts?: { currency?: string; description?: string }
): Promise<{ checkoutId: string }> {
  const merchantCode = sumupMerchantCode();
  if (!merchantCode) throw new SumupApiError('SUMUP_MERCHANT_CODE non configuré', 400);

  const res = await sumupFetch<{ data: { checkout_id: string } }>(
    `/merchants/${merchantCode}/readers/${readerId}/checkout`,
    {
      method: 'POST',
      body: JSON.stringify({
        total_amount: {
          currency: opts?.currency ?? 'EUR',
          minor_unit: 2,
          value: amountCents,
        },
        description: opts?.description ?? `La Z Pizza — ${reference}`,
        affiliate: {
          foreign_transaction_id: reference,
          tags: { reference },
        },
      }),
    }
  );
  return { checkoutId: res.data.checkout_id };
}

export async function getSumupReaderCheckoutStatus(
  readerId: string,
  checkoutId: string
): Promise<SumupCheckoutStatus> {
  const merchantCode = sumupMerchantCode();
  if (!merchantCode) throw new SumupApiError('SUMUP_MERCHANT_CODE non configuré', 400);

  const res = await sumupFetch<{ data: SumupCheckoutStatus }>(
    `/merchants/${merchantCode}/readers/${readerId}/checkout/${checkoutId}`
  );
  return res.data;
}

export async function terminateSumupReaderCheckout(readerId: string): Promise<void> {
  const merchantCode = sumupMerchantCode();
  if (!merchantCode) throw new SumupApiError('SUMUP_MERCHANT_CODE non configuré', 400);

  await sumupFetch<void>(`/merchants/${merchantCode}/readers/${readerId}/terminate`, {
    method: 'POST',
  });
}
