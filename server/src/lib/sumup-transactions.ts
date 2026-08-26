/**
 * Historique des transactions SumUp (comptoir + en ligne) — v2.1, même clé API que
 * sumup.ts (Bearer SUMUP_API_KEY), pas de flow OAuth2 séparé. Vérifié en direct le
 * 2026-08-26 contre le compte sandbox (200, ventes créées côté appli caisse SumUp
 * visibles) et le compte production réel (200, 0 transaction — caisse pas encore
 * en activité, ouverture prévue 2026-09-01).
 * Réf. developer.sumup.com/api/transactions
 */

import { SumupApiError } from './sumup';
import { sumupApiKey, sumupMerchantCode } from './sumup-config';

const SUMUP_TRANSACTIONS_BASE = 'https://api.sumup.com/v2.1';

export type SumupPaymentType =
  | 'ECOM'
  | 'POS'
  | 'CASH'
  | 'RECURRING'
  | 'BITCOIN'
  | 'BALANCE'
  | 'MOTO'
  | 'BOLETO'
  | 'DIRECT_DEBIT'
  | 'APM'
  | 'UNKNOWN';

export type SumupTransaction = {
  id: string;
  transaction_id: string;
  transaction_code: string;
  client_transaction_id?: string;
  amount: number;
  vat_amount?: number;
  tip_amount?: number;
  fee_amount?: number;
  refunded_amount?: number;
  currency: string;
  timestamp: string;
  status: string;
  simple_status?: string;
  payment_type: SumupPaymentType;
  entry_mode?: string;
  card_type?: string;
  product_summary?: string;
  payouts_received?: number;
  payouts_total?: number;
  payout_plan?: string;
  user?: string;
  type?: string;
};

export type SumupTransactionHistoryParams = {
  /** Bornes ISO 8601 — oldest inclus, newest exclu. */
  oldestTime?: string;
  newestTime?: string;
  /** Défaut SumUp = 10 si omis. */
  limit?: number;
  paymentTypes?: SumupPaymentType[];
  order?: 'ascending' | 'descending';
};

export type SumupTransactionHistoryResult = { items: SumupTransaction[] };

export async function getSumupTransactionHistory(
  params: SumupTransactionHistoryParams = {}
): Promise<SumupTransactionHistoryResult> {
  const apiKey = sumupApiKey();
  const merchantCode = sumupMerchantCode();
  if (!apiKey) throw new SumupApiError('SUMUP_API_KEY non configuré', 400);
  if (!merchantCode) throw new SumupApiError('SUMUP_MERCHANT_CODE non configuré', 400);

  const query = new URLSearchParams();
  if (params.oldestTime) query.set('oldest_time', params.oldestTime);
  if (params.newestTime) query.set('newest_time', params.newestTime);
  if (params.limit) query.set('limit', String(params.limit));
  if (params.order) query.set('order', params.order);
  if (params.paymentTypes?.length) {
    for (const t of params.paymentTypes) query.append('payment_types[]', t);
  }

  const qs = query.toString();
  const url = `${SUMUP_TRANSACTIONS_BASE}/merchants/${merchantCode}/transactions/history${qs ? `?${qs}` : ''}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  const text = await res.text();
  const body = text ? JSON.parse(text) : undefined;

  if (!res.ok) {
    const message =
      (body &&
        typeof body === 'object' &&
        'message' in body &&
        String((body as { message: unknown }).message)) ||
      `Erreur SumUp transactions (${res.status})`;
    throw new SumupApiError(message, res.status);
  }

  return (body as SumupTransactionHistoryResult) ?? { items: [] };
}

/**
 * Somme les frais SumUp (fee_amount) sur une période — utile en rapprochement
 * comptable : ce que SumUp prélève n'est aujourd'hui capturé nulle part côté
 * RestaurantOS (ni Dépenses, ni Facturation).
 */
export function sumSumupFees(transactions: SumupTransaction[]): number {
  return transactions.reduce((total, t) => total + (t.fee_amount ?? 0), 0);
}
