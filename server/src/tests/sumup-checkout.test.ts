import request from 'supertest';
import express from 'express';
import sumupCheckoutRoutes from '../routes/sumup-checkout';

const mockReconcile = jest.fn();

jest.mock('../lib/guest-checkout-draft', () => ({
  reconcileGuestCheckoutFromWebhook: (...args: unknown[]): unknown => mockReconcile(...args),
}));

const app = express();
app.use(express.json());
app.set('prisma', {});
app.set('io', { to: jest.fn().mockReturnThis(), emit: jest.fn() });
app.use('/api/payments/sumup-checkout', sumupCheckoutRoutes);

beforeEach(() => {
  mockReconcile.mockReset();
});

describe('POST /api/payments/sumup-checkout/webhook', () => {
  it('reconcile le checkout pour un CHECKOUT_STATUS_CHANGED', async () => {
    mockReconcile.mockResolvedValue({ id: 'order-1' });

    const res = await request(app)
      .post('/api/payments/sumup-checkout/webhook')
      .send({ event_type: 'CHECKOUT_STATUS_CHANGED', id: 'checkout-1' });

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
    expect(mockReconcile).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'checkout-1');
  });

  it('ignore poliment un event_type inconnu (compat future)', async () => {
    const res = await request(app)
      .post('/api/payments/sumup-checkout/webhook')
      .send({ event_type: 'SOMETHING_ELSE', id: 'checkout-1' });

    expect(res.status).toBe(200);
    expect(mockReconcile).not.toHaveBeenCalled();
  });

  it('idempotent — deux livraisons du même événement ne plantent pas', async () => {
    mockReconcile.mockResolvedValue(null);

    const first = await request(app)
      .post('/api/payments/sumup-checkout/webhook')
      .send({ event_type: 'CHECKOUT_STATUS_CHANGED', id: 'checkout-2' });
    const second = await request(app)
      .post('/api/payments/sumup-checkout/webhook')
      .send({ event_type: 'CHECKOUT_STATUS_CHANGED', id: 'checkout-2' });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(mockReconcile).toHaveBeenCalledTimes(2);
  });

  it('renvoie 500 sur une vraie erreur transitoire (pour déclencher le retry SumUp)', async () => {
    mockReconcile.mockRejectedValue(new Error('DB down'));

    const res = await request(app)
      .post('/api/payments/sumup-checkout/webhook')
      .send({ event_type: 'CHECKOUT_STATUS_CHANGED', id: 'checkout-3' });

    expect(res.status).toBe(500);
  });
});
