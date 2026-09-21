import { ORDER_STATUS_VALUES, parseOrderStatusFilter } from '../lib/order-status-filter';

describe('parseOrderStatusFilter', () => {
  it('garde les statuts valides', () => {
    expect(parseOrderStatusFilter('CONFIRMED,PREPARING,READY')).toEqual([
      'CONFIRMED',
      'PREPARING',
      'READY',
    ]);
  });

  it('ignore un statut inconnu (ancien PENDING) au lieu de faire planter Prisma', () => {
    expect(parseOrderStatusFilter('CONFIRMED,PENDING,PREPARING')).toEqual([
      'CONFIRMED',
      'PREPARING',
    ]);
  });

  it('renvoie [] pour une valeur vide ou entièrement inconnue', () => {
    expect(parseOrderStatusFilter(undefined)).toEqual([]);
    expect(parseOrderStatusFilter('')).toEqual([]);
    expect(parseOrderStatusFilter('PENDING,FOO')).toEqual([]);
  });

  it('tolère les espaces', () => {
    expect(parseOrderStatusFilter(' CONFIRMED , READY ')).toEqual(['CONFIRMED', 'READY']);
  });
});

describe('ORDER_STATUS_VALUES', () => {
  it("reste identique à l'enum Prisma OrderStatus", () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { OrderStatus } = require('@prisma/client') as { OrderStatus: Record<string, string> };
    expect([...ORDER_STATUS_VALUES].sort()).toEqual(Object.values(OrderStatus).sort());
  });
});
