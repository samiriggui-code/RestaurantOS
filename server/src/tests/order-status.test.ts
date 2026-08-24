import {
  assertOrderStatusTransition,
  assertPaymentStatusTransition,
  canTransitionOrderStatus,
  InvalidOrderTransitionError,
  normalizeOrderStatus,
  transitionOrderStatus,
} from '../lib/order-status';

describe('order-status state machine', () => {
  it('normalizes legacy PENDING to CONFIRMED', () => {
    expect(normalizeOrderStatus('PENDING')).toBe('CONFIRMED');
  });

  it('allows CONFIRMED → PREPARING', () => {
    expect(canTransitionOrderStatus('CONFIRMED', 'PREPARING')).toBe(true);
    expect(transitionOrderStatus('CONFIRMED', 'PREPARING')).toEqual({ status: 'PREPARING' });
  });

  it('rejects COMPLETED → PREPARING', () => {
    expect(canTransitionOrderStatus('COMPLETED', 'PREPARING')).toBe(false);
    expect(() => assertOrderStatusTransition('COMPLETED', 'PREPARING')).toThrow(
      InvalidOrderTransitionError
    );
  });

  it('allows PAID → REFUNDED', () => {
    expect(assertPaymentStatusTransition('PAID', 'REFUNDED')).toBe('REFUNDED');
  });

  it('rejects REFUNDED → PAID', () => {
    expect(() => assertPaymentStatusTransition('REFUNDED', 'PAID')).toThrow();
  });
});
