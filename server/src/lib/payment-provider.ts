/**
 * Contrat paiement RestaurantOS — SumUp uniquement (plus de Stripe actif).
 * Les nouveaux flux passent par getPaymentProvider() ; Stripe n’est plus un provider.
 */

import { isSumupConfigured } from './sumup-config';
import {
  createSumupCheckout,
  getSumupCheckoutStatus,
  refundSumupTransaction,
} from './sumup-checkout';
import { SumupApiError } from './sumup';

export type PaymentProviderId = 'SUMUP';

export type CreateOnlineCheckoutInput = {
  amountCents: number;
  currency?: string;
  checkoutReference: string;
  description?: string;
  returnUrl: string;
};

export type CreateOnlineCheckoutResult = {
  provider: PaymentProviderId;
  checkoutId: string;
  status: string;
};

export type PaymentStatusResult = {
  provider: PaymentProviderId;
  checkoutId: string;
  status: string;
  paid: boolean;
  transactionId?: string | null;
  amountCents?: number | null;
  /** Référence métier (draftId) renvoyée par SumUp */
  checkoutReference?: string | null;
};

export type RefundInput = {
  checkoutId: string;
  amountCents?: number;
};

export type RefundResult = {
  provider: PaymentProviderId;
  ok: boolean;
  error?: string;
};

export interface PaymentProvider {
  readonly id: PaymentProviderId;
  isConfigured(): boolean;
  createOnlineCheckout(input: CreateOnlineCheckoutInput): Promise<CreateOnlineCheckoutResult>;
  getCheckoutStatus(checkoutId: string): Promise<PaymentStatusResult>;
  refund(input: RefundInput): Promise<RefundResult>;
}

export const sumupPaymentProvider: PaymentProvider = {
  id: 'SUMUP',

  isConfigured(): boolean {
    return isSumupConfigured();
  },

  async createOnlineCheckout(
    input: CreateOnlineCheckoutInput
  ): Promise<CreateOnlineCheckoutResult> {
    const checkout = await createSumupCheckout({
      amountCents: input.amountCents,
      currency: input.currency ?? 'EUR',
      reference: input.checkoutReference,
      description: input.description,
      returnUrl: input.returnUrl,
    });
    return {
      provider: 'SUMUP',
      checkoutId: checkout.checkoutId,
      status: checkout.status,
    };
  },

  async getCheckoutStatus(checkoutId: string): Promise<PaymentStatusResult> {
    const checkout = await getSumupCheckoutStatus(checkoutId);
    const status = String(checkout.status ?? '').toUpperCase();
    const paid = status === 'PAID';
    const tx =
      checkout.transactions?.find(t => String(t.status).toUpperCase() === 'SUCCESSFUL') ??
      checkout.transactions?.[0];
    return {
      provider: 'SUMUP',
      checkoutId,
      status,
      paid,
      transactionId: tx?.id ?? null,
      amountCents: typeof checkout.amount === 'number' ? Math.round(checkout.amount * 100) : null,
      checkoutReference: checkout.checkout_reference ?? null,
    };
  },

  async refund(input: RefundInput): Promise<RefundResult> {
    try {
      const status = await getSumupCheckoutStatus(input.checkoutId);
      const tx = status.transactions?.find(t => String(t.status).toUpperCase() === 'SUCCESSFUL');
      if (!tx?.id) {
        return { provider: 'SUMUP', ok: false, error: 'Aucune transaction SumUp réussie' };
      }
      await refundSumupTransaction(tx.id, input.amountCents);
      return { provider: 'SUMUP', ok: true };
    } catch (err) {
      const message =
        err instanceof SumupApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Remboursement SumUp échoué';
      return { provider: 'SUMUP', ok: false, error: message };
    }
  },
};

/** Provider actif — SumUp exclusive. */
export function getPaymentProvider(): PaymentProvider {
  return sumupPaymentProvider;
}

export function assertPaymentConfigured(): void {
  if (!getPaymentProvider().isConfigured()) {
    throw new Error('Paiement SumUp non configuré (SUMUP_API_KEY / SUMUP_MERCHANT_CODE)');
  }
}
