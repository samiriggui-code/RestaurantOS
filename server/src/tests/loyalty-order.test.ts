import {
  loyaltyPointsForOrder,
  loyaltyFreePizzasAvailable,
  loyaltyPointsUntilNextFree,
} from '../lib/loyalty-order';

describe('loyaltyPointsForOrder', () => {
  it('awards 1 point per pizza ordered, not per euro spent', () => {
    expect(loyaltyPointsForOrder(3, 1)).toBe(3);
  });

  it('gives zero points for an order with no pizzas (drinks/desserts only)', () => {
    expect(loyaltyPointsForOrder(0, 1)).toBe(0);
  });

  it('gives zero points if the program rate is zero/negative', () => {
    expect(loyaltyPointsForOrder(5, 0)).toBe(0);
  });
});

describe('loyaltyFreePizzasAvailable / loyaltyPointsUntilNextFree — 10th pizza free', () => {
  const THRESHOLD = 10;

  it('unlocks exactly one free pizza at 10 points', () => {
    expect(loyaltyFreePizzasAvailable(10, THRESHOLD)).toBe(1);
    expect(loyaltyPointsUntilNextFree(10, THRESHOLD)).toBe(0);
  });

  it('does not unlock early at 9 points', () => {
    expect(loyaltyFreePizzasAvailable(9, THRESHOLD)).toBe(0);
    expect(loyaltyPointsUntilNextFree(9, THRESHOLD)).toBe(1);
  });

  it('unlocks a second free pizza at 20 points', () => {
    expect(loyaltyFreePizzasAvailable(20, THRESHOLD)).toBe(2);
  });
});
