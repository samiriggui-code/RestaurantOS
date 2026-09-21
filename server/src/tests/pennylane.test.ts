import { frVatRateCode } from '../lib/pennylane/pennylane-vat';
import {
  parseFrenchAddressForPennylane,
  splitClientName,
} from '../lib/pennylane/pennylane-address';

jest.mock('../lib/pennylane/pennylane-client');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pennylaneClient = jest.requireMock('../lib/pennylane/pennylane-client') as {
  isPennylaneConfigured: jest.Mock;
  findPennylaneCustomerByExternalReference: jest.Mock;
  findPennylaneInvoiceByExternalReference: jest.Mock;
  createPennylaneCompanyCustomer: jest.Mock;
  createPennylaneIndividualCustomer: jest.Mock;
  createPennylaneCustomerInvoice: jest.Mock;
};

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { syncInvoiceToPennylane, PennylaneNotConfiguredError } = jest.requireActual(
  '../lib/pennylane/pennylane-sync'
) as typeof import('../lib/pennylane/pennylane-sync');

describe('pennylane/vat', () => {
  it.each([
    [20, 'FR_200'],
    [10, 'FR_100'],
    [5.5, 'FR_55'],
    [2.1, 'FR_21'],
    [0, 'FR_0'],
  ])('maps %s%% to %s', (rate, code) => {
    expect(frVatRateCode(rate)).toBe(code);
  });

  it('throws on an unmapped rate rather than sending garbage to accounting software', () => {
    expect(() => frVatRateCode(8.5)).toThrow(/non reconnu/);
  });
});

describe('pennylane/address', () => {
  it('splits a standard French address around the postal code', () => {
    const result = parseFrenchAddressForPennylane('12 rue de la Paix, 33370 Fargues-Saint-Hilaire');
    expect(result).toEqual({
      address: '12 rue de la Paix',
      postal_code: '33370',
      city: 'Fargues-Saint-Hilaire',
      country_alpha2: 'FR',
    });
  });

  it('handles a newline-separated address', () => {
    const result = parseFrenchAddressForPennylane('12 rue de la Paix\n33370 Fargues-Saint-Hilaire');
    expect(result.postal_code).toBe('33370');
    expect(result.city).toBe('Fargues-Saint-Hilaire');
  });

  it('throws when no postal code can be found — refuses to invent an address', () => {
    expect(() => parseFrenchAddressForPennylane('adresse incomplète')).toThrow(/incomplète/);
  });

  it('throws on an empty/missing address', () => {
    expect(() => parseFrenchAddressForPennylane(null)).toThrow(/incomplète/);
  });

  it('throws when the postal code has nothing around it', () => {
    expect(() => parseFrenchAddressForPennylane('33370')).toThrow(/incomplète/);
  });
});

describe('pennylane/splitClientName', () => {
  it('splits a two-word name', () => {
    expect(splitClientName('Jean Dupont')).toEqual({ firstName: 'Jean', lastName: 'Dupont' });
  });

  it('keeps the remainder as last name for multi-word names', () => {
    expect(splitClientName('Jean-Paul De La Tour')).toEqual({
      firstName: 'Jean-Paul',
      lastName: 'De La Tour',
    });
  });

  it('falls back gracefully for a single-word name', () => {
    expect(splitClientName('Dupont')).toEqual({ firstName: 'Client', lastName: 'Dupont' });
  });
});

function baseInvoice(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'inv-1',
    businessId: 'b1',
    invoiceNumber: 42,
    status: 'ISSUED',
    clientName: 'Jean Dupont',
    clientEmail: 'jean@example.com',
    clientPhone: null,
    clientSiret: null,
    clientVatNumber: null,
    clientAddress: '12 rue de la Paix, 33370 Fargues-Saint-Hilaire',
    issueDate: new Date('2026-08-20T10:00:00Z'),
    dueDate: null,
    pennylaneCustomerId: null,
    lines: [
      {
        id: 'l1',
        description: 'Pizza Regina',
        quantity: 2,
        unitPriceCents: 1200,
        taxRate: 10,
        sortOrder: 0,
      },
    ],
    ...overrides,
  };
}

function prismaWithBusiness(
  invoice: { findFirst: jest.Mock; update?: jest.Mock },
  pennylaneToken: string | null = 'test-token-pennylane'
) {
  return {
    business: {
      findUnique: jest.fn().mockResolvedValue({
        settings: pennylaneToken
          ? { integrations: { pennylane: { apiToken: pennylaneToken } } }
          : {},
      }),
    },
    invoice,
  };
}

describe('pennylane/sync — syncInvoiceToPennylane', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    pennylaneClient.isPennylaneConfigured.mockImplementation((t?: string | null) =>
      t === undefined ? true : Boolean(t?.trim())
    );
  });

  it('refuses to run when no Pennylane token is configured', async () => {
    const prisma = prismaWithBusiness({ findFirst: jest.fn() }, null);
    await expect(syncInvoiceToPennylane(prisma as never, 'b1', 'inv-1')).rejects.toBeInstanceOf(
      PennylaneNotConfiguredError
    );
    expect(prisma.invoice.findFirst).not.toHaveBeenCalled();
  });

  it('404s when the invoice is not found', async () => {
    const prisma = prismaWithBusiness({ findFirst: jest.fn().mockResolvedValue(null) });
    await expect(syncInvoiceToPennylane(prisma as never, 'b1', 'inv-1')).rejects.toThrow(
      'Facture introuvable'
    );
  });

  it('refuses a DRAFT invoice — must be finalized in RestaurantOS first', async () => {
    const prisma = prismaWithBusiness({
      findFirst: jest.fn().mockResolvedValue(baseInvoice({ status: 'DRAFT' })),
    });
    await expect(syncInvoiceToPennylane(prisma as never, 'b1', 'inv-1')).rejects.toThrow(
      /brouillon/
    );
  });

  it('refuses an invoice with no lines', async () => {
    const prisma = prismaWithBusiness({
      findFirst: jest.fn().mockResolvedValue(baseInvoice({ lines: [] })),
    });
    await expect(syncInvoiceToPennylane(prisma as never, 'b1', 'inv-1')).rejects.toThrow(
      /sans lignes/
    );
  });

  it.each(['DELIVEROO', 'UBER_EATS'])(
    "refuses a %s invoice — already booked by Pennylane's own marketplace connector",
    async channel => {
      const prisma = prismaWithBusiness({
        findFirst: jest.fn().mockResolvedValue(baseInvoice({ order: { channel } })),
      });
      await expect(syncInvoiceToPennylane(prisma as never, 'b1', 'inv-1')).rejects.toThrow(
        /connecteur natif/
      );
      expect(pennylaneClient.createPennylaneCustomerInvoice).not.toHaveBeenCalled();
    }
  );

  it('allows a WEB-channel invoice through (no marketplace conflict)', async () => {
    const prisma = prismaWithBusiness({
      findFirst: jest.fn().mockResolvedValue(baseInvoice({ order: { channel: 'WEB' } })),
      update: jest.fn().mockResolvedValue({}),
    });
    pennylaneClient.findPennylaneInvoiceByExternalReference.mockResolvedValue({ id: 999 });

    const result = await syncInvoiceToPennylane(prisma as never, 'b1', 'inv-1');

    expect(result).toEqual({ pennylaneInvoiceId: 999, created: false });
  });

  it('is idempotent: reuses an already-synced Pennylane invoice instead of creating a duplicate', async () => {
    const update = jest.fn().mockResolvedValue({});
    const prisma = prismaWithBusiness({
      findFirst: jest.fn().mockResolvedValue(baseInvoice()),
      update,
    });
    pennylaneClient.findPennylaneInvoiceByExternalReference.mockResolvedValue({ id: 999 });

    const result = await syncInvoiceToPennylane(prisma as never, 'b1', 'inv-1');

    expect(result).toEqual({ pennylaneInvoiceId: 999, created: false });
    expect(pennylaneClient.createPennylaneCustomerInvoice).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith({
      where: { id: 'inv-1' },
      data: { pdpReference: '999', pennylaneSyncedAt: expect.any(Date), pennylaneSyncError: null },
    });
  });

  it('creates an individual customer + invoice for a consumer client (no SIRET)', async () => {
    const update = jest.fn().mockResolvedValue({});
    const prisma = prismaWithBusiness({
      findFirst: jest.fn().mockResolvedValue(baseInvoice()),
      update,
    });
    pennylaneClient.findPennylaneInvoiceByExternalReference.mockResolvedValue(null);
    pennylaneClient.findPennylaneCustomerByExternalReference.mockResolvedValue(null);
    pennylaneClient.createPennylaneIndividualCustomer.mockResolvedValue({ id: 55 });
    pennylaneClient.createPennylaneCustomerInvoice.mockResolvedValue({ id: 777 });

    const result = await syncInvoiceToPennylane(prisma as never, 'b1', 'inv-1');

    expect(result).toEqual({ pennylaneInvoiceId: 777, created: true });
    expect(pennylaneClient.createPennylaneCompanyCustomer).not.toHaveBeenCalled();
    expect(pennylaneClient.createPennylaneIndividualCustomer).toHaveBeenCalledWith(
      expect.objectContaining({ firstName: 'Jean', lastName: 'Dupont' })
    );
    const invoiceCall = pennylaneClient.createPennylaneCustomerInvoice.mock.calls[0][0];
    expect(invoiceCall.customerId).toBe(55);
    expect(invoiceCall.lines).toEqual([
      { label: 'Pizza Regina', quantity: 2, raw_currency_unit_price: '12.00', vat_rate: 'FR_100' },
    ]);
    expect(update).toHaveBeenCalledWith({
      where: { id: 'inv-1' },
      data: {
        pennylaneCustomerId: 55,
        pdpReference: '777',
        pennylaneSyncedAt: expect.any(Date),
        pennylaneSyncError: null,
      },
    });
  });

  it('creates a company customer for a B2B client (SIRET present)', async () => {
    const prisma = prismaWithBusiness({
      findFirst: jest.fn().mockResolvedValue(baseInvoice({ clientSiret: '12345678900012' })),
      update: jest.fn().mockResolvedValue({}),
    });
    pennylaneClient.findPennylaneInvoiceByExternalReference.mockResolvedValue(null);
    pennylaneClient.findPennylaneCustomerByExternalReference.mockResolvedValue(null);
    pennylaneClient.createPennylaneCompanyCustomer.mockResolvedValue({ id: 66 });
    pennylaneClient.createPennylaneCustomerInvoice.mockResolvedValue({ id: 888 });

    await syncInvoiceToPennylane(prisma as never, 'b1', 'inv-1');

    expect(pennylaneClient.createPennylaneIndividualCustomer).not.toHaveBeenCalled();
    expect(pennylaneClient.createPennylaneCompanyCustomer).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Jean Dupont', regNo: '12345678900012' })
    );
  });

  it('records the error on the invoice and re-throws when Pennylane rejects the push', async () => {
    const update = jest.fn().mockResolvedValue({});
    const prisma = prismaWithBusiness({
      findFirst: jest.fn().mockResolvedValue(baseInvoice()),
      update,
    });
    pennylaneClient.findPennylaneInvoiceByExternalReference.mockResolvedValue(null);
    pennylaneClient.findPennylaneCustomerByExternalReference.mockResolvedValue({ id: 55 });
    pennylaneClient.createPennylaneCustomerInvoice.mockRejectedValue(
      new Error('Pennylane API 422')
    );

    await expect(syncInvoiceToPennylane(prisma as never, 'b1', 'inv-1')).rejects.toThrow(
      'Pennylane API 422'
    );
    expect(update).toHaveBeenCalledWith({
      where: { id: 'inv-1' },
      data: { pennylaneSyncError: 'Pennylane API 422' },
    });
  });
});
