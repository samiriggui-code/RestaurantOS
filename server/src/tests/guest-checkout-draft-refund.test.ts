jest.mock('../lib/business', () => ({ getBusinessId: jest.fn().mockReturnValue('b1') }));
jest.mock('../lib/online-order', () => ({
  validateOnlineOrderBody: jest.fn().mockReturnValue(null),
  validateOrderFeasibility: jest.fn().mockResolvedValue(null),
  createOnlineOrder: jest.fn(),
}));
jest.mock('../lib/online-payment-finalize', () => ({
  runOnlineCardPaymentHooks: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../lib/payment-provider', () => ({
  getPaymentProvider: jest.fn(),
  assertPaymentConfigured: jest.fn(),
}));
jest.mock('../lib/sumup-online-config', () => ({
  sumupWebhookUrl: jest.fn().mockReturnValue('https://x/webhook'),
}));

import { completeGuestCheckout } from '../lib/guest-checkout-draft';
import { createOnlineOrder } from '../lib/online-order';
import { getPaymentProvider } from '../lib/payment-provider';

function fakeDraft(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'draft-1',
    businessId: 'b1',
    payload: { lines: [], checkout: {}, subtotal: 0, deliveryFee: 0, total: 12 },
    totalCents: 1200,
    sumupCheckoutId: 'chk-1',
    consumedAt: null,
    refundedAt: null,
    expiresAt: new Date(Date.now() + 60_000),
    ...overrides,
  };
}

function fakePrisma(draft: ReturnType<typeof fakeDraft> | null) {
  return {
    guestCheckoutDraft: {
      findFirst: jest.fn().mockResolvedValue(draft),
      findUnique: jest.fn().mockResolvedValue(draft),
      update: jest.fn().mockResolvedValue({}),
    },
    order: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
  };
}

describe('completeGuestCheckout — remboursement automatique si le paiement est capturé mais la commande échoue', () => {
  beforeEach(() => jest.clearAllMocks());

  it('refunds and marks the draft when order creation fails after payment is confirmed paid', async () => {
    const draft = fakeDraft();
    const prisma = fakePrisma(draft);
    const refund = jest.fn().mockResolvedValue({ ok: true });
    (getPaymentProvider as jest.Mock).mockReturnValue({
      getCheckoutStatus: jest.fn().mockResolvedValue({ paid: true, amountCents: 1200 }),
      refund,
    });
    (createOnlineOrder as jest.Mock).mockResolvedValue({ error: 'Créneau complet', status: 400 });

    const result = await completeGuestCheckout(prisma as never, null, 'draft-1');

    expect(refund).toHaveBeenCalledWith({ checkoutId: 'chk-1', amountCents: 1200 });
    expect(prisma.guestCheckoutDraft.update).toHaveBeenCalledWith({
      where: { id: 'draft-1' },
      data: { refundedAt: expect.any(Date) },
    });
    expect('error' in result && result.error).toMatch(/remboursé automatiquement/);
  });

  it('tells the customer to reach out when the automatic refund itself fails, and does not mark refundedAt', async () => {
    const draft = fakeDraft();
    const prisma = fakePrisma(draft);
    const refund = jest.fn().mockResolvedValue({ ok: false, error: 'SumUp down' });
    (getPaymentProvider as jest.Mock).mockReturnValue({
      getCheckoutStatus: jest.fn().mockResolvedValue({ paid: true, amountCents: 1200 }),
      refund,
    });
    (createOnlineOrder as jest.Mock).mockResolvedValue({ error: 'Créneau complet', status: 400 });

    const result = await completeGuestCheckout(prisma as never, null, 'draft-1');

    expect(prisma.guestCheckoutDraft.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: { refundedAt: expect.anything() } })
    );
    expect('error' in result && result.error).toMatch(/contactez-nous/);
  });

  it('never refunds twice — skips the refund call when the draft was already refunded', async () => {
    const draft = fakeDraft({ refundedAt: new Date() });
    const prisma = fakePrisma(draft);
    const refund = jest.fn();
    (getPaymentProvider as jest.Mock).mockReturnValue({
      getCheckoutStatus: jest.fn().mockResolvedValue({ paid: true, amountCents: 1200 }),
      refund,
    });
    (createOnlineOrder as jest.Mock).mockResolvedValue({ error: 'Créneau complet', status: 400 });

    const result = await completeGuestCheckout(prisma as never, null, 'draft-1');

    expect(refund).not.toHaveBeenCalled();
    expect('error' in result && result.error).toBe('Créneau complet');
  });
});
