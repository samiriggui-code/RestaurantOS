jest.mock('../lib/delivery-quote', () => ({
  computeDeliveryQuote: jest.fn().mockResolvedValue({ ok: true, fee: 0 }),
}));
jest.mock('../lib/time-slots', () => ({
  validateTimeSlot: jest.fn().mockResolvedValue(null),
  parseTimeSlotToDate: jest.fn().mockReturnValue(null),
}));
jest.mock('../lib/sync-menu-formules', () => ({
  validateFormuleLines: jest.fn().mockResolvedValue(null),
}));

import { validateOrderFeasibility, type OnlineOrderBody } from '../lib/online-order';
import { validateTimeSlot } from '../lib/time-slots';
import { computeDeliveryQuote } from '../lib/delivery-quote';
import { validateFormuleLines } from '../lib/sync-menu-formules';

function fakeBody(overrides: Partial<OnlineOrderBody> = {}): OnlineOrderBody {
  return {
    lines: [
      { slug: 'reine-senior', name: 'Reine Sénior', categoryId: 'c1', unitPrice: 12, quantity: 1 },
    ],
    checkout: {
      orderType: 'pickup',
      customerFirstName: 'Jean',
      customerLastName: 'Dupont',
      customerPhone: '0600000000',
    },
    subtotal: 12,
    deliveryFee: 0,
    total: 12,
    ...overrides,
  };
}

function fakePrisma(menuItem: { isActive: boolean; isAvailable: boolean } | null) {
  return {
    menuItem: {
      findFirst: jest.fn().mockResolvedValue(menuItem),
    },
  };
}

describe('online-order — validateOrderFeasibility (contrôle de stock au paiement)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects a line whose menu item was deactivated after being added to the cart', async () => {
    const prisma = fakePrisma({ isActive: false, isAvailable: true });

    const error = await validateOrderFeasibility(prisma as never, 'b1', fakeBody());

    expect(error).toMatch(/indisponible/i);
  });

  it('rejects a line whose menu item is marked unavailable (sold out)', async () => {
    const prisma = fakePrisma({ isActive: true, isAvailable: false });

    const error = await validateOrderFeasibility(prisma as never, 'b1', fakeBody());

    expect(error).toMatch(/indisponible/i);
  });

  it('passes when the menu item is active and available', async () => {
    const prisma = fakePrisma({ isActive: true, isAvailable: true });

    const error = await validateOrderFeasibility(prisma as never, 'b1', fakeBody());

    expect(error).toBeNull();
  });

  it('skips the stock check for the internal snapshot line (no real menu item to look up)', async () => {
    const prisma = fakePrisma(null);
    const body = fakeBody({
      lines: [
        {
          slug: '__snapshot__',
          name: 'Ligne interne',
          categoryId: 'c1',
          unitPrice: 5,
          quantity: 1,
        },
      ],
    });

    const error = await validateOrderFeasibility(prisma as never, 'b1', body);

    expect(error).toBeNull();
    expect(prisma.menuItem.findFirst).not.toHaveBeenCalled();
  });

  it('still runs delivery quote, time slot, and formule checks before the stock check', async () => {
    const prisma = fakePrisma({ isActive: true, isAvailable: true });
    (validateTimeSlot as jest.Mock).mockResolvedValueOnce('Créneau complet');

    const error = await validateOrderFeasibility(prisma as never, 'b1', fakeBody());

    expect(error).toBe('Créneau complet');
    expect(prisma.menuItem.findFirst).not.toHaveBeenCalled();
  });

  it('checks delivery quote and fee consistency for delivery orders', async () => {
    const prisma = fakePrisma({ isActive: true, isAvailable: true });
    (computeDeliveryQuote as jest.Mock).mockResolvedValueOnce({
      ok: false,
      error: 'Zone non couverte',
    });
    const body = fakeBody({
      checkout: {
        orderType: 'delivery',
        customerFirstName: 'Jean',
        customerLastName: 'Dupont',
        customerPhone: '0600000000',
        addressLine: '1 rue de la Paix',
        postalCode: '33370',
        city: 'Fargues',
      },
    });

    const error = await validateOrderFeasibility(prisma as never, 'b1', body);

    expect(error).toBe('Zone non couverte');
  });

  it('checks formule lines', async () => {
    const prisma = fakePrisma({ isActive: true, isAvailable: true });
    (validateFormuleLines as jest.Mock).mockResolvedValueOnce('Formule invalide');

    const error = await validateOrderFeasibility(prisma as never, 'b1', fakeBody());

    expect(error).toBe('Formule invalide');
  });
});
