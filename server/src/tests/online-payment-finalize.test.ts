import { runOnlineCardPaymentHooks } from '../lib/online-payment-finalize';

jest.mock('../lib/paid-order-side-effects');
jest.mock('../lib/fiscal/hook-paid-order');
jest.mock('../lib/enqueue-order-prints', () => ({
  enqueueConfirmedOrderPrints: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../lib/order-track-events');
jest.mock('../lib/socket-emit');
jest.mock('../lib/mail-service');

// eslint-disable-next-line @typescript-eslint/no-var-requires
const sideEffects = jest.requireMock('../lib/paid-order-side-effects') as {
  runPaidOrderSideEffects: jest.Mock;
};
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fiscalHook = jest.requireMock('../lib/fiscal/hook-paid-order') as {
  requireFiscalTicketForPaidOrder: jest.Mock;
};

function fakeOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 'o1',
    businessId: 'b1',
    orderNumber: 1,
    paymentStatus: 'PAID',
    type: 'DELIVERY',
    customerEmail: null,
    items: [],
    table: null,
    ...overrides,
  };
}

function fakePrisma(order: ReturnType<typeof fakeOrder>) {
  return {
    order: { findFirst: jest.fn().mockResolvedValue(order) },
    fiscalTicket: {
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn().mockResolvedValue({ recordHash: 'h' }),
    },
  };
}

const fakeIo = { to: jest.fn().mockReturnThis(), emit: jest.fn() };

describe('runOnlineCardPaymentHooks — invoice timing (livraison vs autres canaux)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sideEffects.runPaidOrderSideEffects.mockResolvedValue(undefined);
    fiscalHook.requireFiscalTicketForPaidOrder.mockResolvedValue({
      ticketId: 't1',
      serialNumber: 1,
    });
  });

  it('suppresses invoice-at-payment for a DELIVERY order (invoice waits for driver confirmation)', async () => {
    const order = fakeOrder({ type: 'DELIVERY' });
    const prisma = fakePrisma(order);

    await runOnlineCardPaymentHooks(prisma as never, fakeIo as never, 'b1', 'o1');

    expect(sideEffects.runPaidOrderSideEffects).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({ invoice: false })
    );
  });

  it('keeps invoice-at-payment for a PICKUP order (no delivery-confirmation event exists)', async () => {
    const order = fakeOrder({ type: 'PICKUP' });
    const prisma = fakePrisma(order);

    await runOnlineCardPaymentHooks(prisma as never, fakeIo as never, 'b1', 'o1');

    expect(sideEffects.runPaidOrderSideEffects).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({ invoice: true })
    );
  });
});
