import {
  syncPennylaneSupplierInvoices,
  listCachedSupplierInvoices,
} from '../lib/pennylane/pennylane-expense-sync';
import type { PennylaneSupplierInvoice } from '../lib/pennylane/pennylane-client';
import { PennylaneNotConfiguredError } from '../lib/pennylane/pennylane-sync';

jest.mock('../lib/pennylane/pennylane-client');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pennylaneClient = jest.requireMock('../lib/pennylane/pennylane-client') as {
  isPennylaneConfigured: jest.Mock;
  listPennylaneSupplierInvoices: jest.Mock;
};

function fakeInvoice(overrides: Partial<PennylaneSupplierInvoice> = {}): PennylaneSupplierInvoice {
  return {
    id: 1,
    supplier: { id: 10 },
    amount: '125.50',
    tax: '22.83',
    currency: 'EUR',
    date: '2026-09-01',
    deadline: '2026-10-01',
    payment_status: 'to_be_paid',
    paid: false,
    accounting_status: 'complete',
    invoice_number: 'FA-2026-001',
    label: 'Fournisseur farine',
    ...overrides,
  };
}

function fakePrisma(pennylaneToken: string | null = 'test-token') {
  return {
    business: {
      findUnique: jest.fn().mockResolvedValue({
        settings: pennylaneToken
          ? { integrations: { pennylane: { apiToken: pennylaneToken } } }
          : {},
      }),
    },
    pennylaneSupplierInvoice: {
      upsert: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([]),
    },
  };
}

describe('pennylane-expense-sync — syncPennylaneSupplierInvoices', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    pennylaneClient.isPennylaneConfigured.mockImplementation((t?: string | null) =>
      t === undefined ? true : Boolean(t?.trim())
    );
  });

  it('refuses to run when no Pennylane token is configured', async () => {
    const prisma = fakePrisma(null);
    await expect(syncPennylaneSupplierInvoices(prisma as never, 'b1')).rejects.toBeInstanceOf(
      PennylaneNotConfiguredError
    );
    expect(pennylaneClient.listPennylaneSupplierInvoices).not.toHaveBeenCalled();
  });

  it('upserts each invoice with correct cents conversion from the euro strings', async () => {
    pennylaneClient.listPennylaneSupplierInvoices.mockResolvedValue({
      items: [fakeInvoice({ id: 42, amount: '125.50', tax: '22.83' })],
      has_more: false,
      next_cursor: null,
    });
    const prisma = fakePrisma();

    const result = await syncPennylaneSupplierInvoices(prisma as never, 'b1');

    expect(result.synced).toBe(1);
    expect(prisma.pennylaneSupplierInvoice.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          businessId_pennylaneSupplierInvoiceId: {
            businessId: 'b1',
            pennylaneSupplierInvoiceId: 42,
          },
        },
        create: expect.objectContaining({ amountCents: 12550, taxCents: 2283, supplierId: 10 }),
      })
    );
  });

  it('follows cursor pagination until has_more is false', async () => {
    pennylaneClient.listPennylaneSupplierInvoices
      .mockResolvedValueOnce({
        items: [fakeInvoice({ id: 1 })],
        has_more: true,
        next_cursor: 'cursor-2',
      })
      .mockResolvedValueOnce({
        items: [fakeInvoice({ id: 2 })],
        has_more: false,
        next_cursor: null,
      });
    const prisma = fakePrisma();

    const result = await syncPennylaneSupplierInvoices(prisma as never, 'b1');

    expect(pennylaneClient.listPennylaneSupplierInvoices).toHaveBeenCalledTimes(2);
    expect(pennylaneClient.listPennylaneSupplierInvoices).toHaveBeenNthCalledWith(2, {
      cursor: 'cursor-2',
    });
    expect(result.synced).toBe(2);
  });
});

describe('pennylane-expense-sync — listCachedSupplierInvoices', () => {
  it('lists all by default (no paid filter applied)', async () => {
    const prisma = fakePrisma();
    await listCachedSupplierInvoices(prisma as never, 'b1');
    expect(prisma.pennylaneSupplierInvoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { businessId: 'b1' } })
    );
  });

  it('filters to unpaid only', async () => {
    const prisma = fakePrisma();
    await listCachedSupplierInvoices(prisma as never, 'b1', { paid: 'unpaid' });
    expect(prisma.pennylaneSupplierInvoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { businessId: 'b1', paid: false } })
    );
  });
});
