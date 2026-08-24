import { encashOrder } from '../lib/order-encash';
import { applyPaymentMeta } from '../lib/order-payment-meta';
import { updateOrderPayment } from '../lib/order-payment-update';
import { posSettleOrder } from '../lib/order-pos-settle';

describe('order-encash', () => {
  it('rejects invalid payment method', async () => {
    const result = await encashOrder({} as never, {} as never, {
      orderId: 'o1',
      businessId: 'b1',
      userId: 'u1',
      paymentMethod: 'CRYPTO',
    });
    expect(result).toEqual({
      ok: false,
      status: 400,
      error: 'paymentMethod must be CASH or CARD',
    });
  });
});

describe('order-pos-settle', () => {
  it('rejects unknown action', async () => {
    const result = await posSettleOrder({} as never, {} as never, {
      orderId: 'o1',
      businessId: 'b1',
      userId: 'u1',
      action: 'noop',
    });
    expect(result).toEqual({
      ok: false,
      status: 400,
      error: 'action must be pay or handover',
    });
  });
});

describe('order-payment-meta', () => {
  it('returns empty for non cash/card', () => {
    expect(applyPaymentMeta({ paymentMethod: 'COUNTER' }, 1000)).toEqual({});
  });

  it('builds meta for CASH', () => {
    const meta = applyPaymentMeta({ paymentMethod: 'CASH' }, 1500);
    expect(meta.paymentMeta).toEqual(
      expect.objectContaining({
        amountCents: 1500,
        provider: 'MANUAL',
        captureMode: 'manual',
      })
    );
    expect(meta.paymentCapturedAt).toBeInstanceOf(Date);
  });
});

describe('order-payment-update', () => {
  it('returns 404 when order missing', async () => {
    const prisma = {
      order: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const result = await updateOrderPayment(prisma as never, {} as never, {
      orderId: 'missing',
      businessId: 'b1',
      userId: 'u1',
      paymentStatus: 'PAID',
    });
    expect(result).toEqual({ ok: false, status: 404, error: 'Order not found' });
  });
});
