import {
  parseSalesJournalCsv,
  formatProductSummary,
  importSalesJournal,
} from '../lib/sumup-sales-journal-import';

const HEADER =
  'Date,Type,Réf. transaction,Moyen de paiement,Quantité,Description,Catégorie,SKU,Devise,Prix avant réduction,Réduction,Prix (TTC),Prix (HT),TVA,Taux de TVA,Compte,Motif du remboursement';

function csvLine(
  ref: string,
  description: string,
  quantity = 1,
  category = '1 - Pizzas Base Tomate',
  amountTTC = '12,00'
): string {
  return `7 sept. 2026 20:13,Vente,${ref},Visa - Débit,${quantity},${description},${category},,EUR,"${amountTTC}","0,00","${amountTTC}","12,00","0,00",,a@b.com,`;
}

describe('sumup-sales-journal-import — parseSalesJournalCsv', () => {
  it('groups line-items by transaction ref', () => {
    const csv = [
      HEADER,
      csvLine('TAAA1', 'Crémeuse Sénior 31cm'),
      csvLine('TAAA1', 'Fromagère Sénior 31cm'),
      csvLine('TAAA2', 'Reine Sénior 31cm'),
    ].join('\n');

    const grouped = parseSalesJournalCsv(csv);

    expect(grouped.size).toBe(2);
    expect(grouped.get('TAAA1')).toHaveLength(2);
    expect(grouped.get('TAAA2')).toHaveLength(1);
  });

  it('captures category and TTC amount per line (feeds category/item reports)', () => {
    const csv = [
      HEADER,
      csvLine('TAAA1', 'Crémeuse Sénior 31cm', 2, '2 - Pizzas Base Crème Fraîche', '27,00'),
    ].join('\n');

    const [line] = parseSalesJournalCsv(csv).get('TAAA1')!;

    expect(line).toMatchObject({
      description: 'Crémeuse Sénior 31cm',
      category: '2 - Pizzas Base Crème Fraîche',
      quantity: 2,
      amountCents: 2700,
    });
  });

  it('rejects a CSV missing the expected SumUp columns', () => {
    expect(() => parseSalesJournalCsv('a,b,c\n1,2,3')).toThrow(/Réf. transaction/);
  });

  it('throws on an empty file', () => {
    expect(() => parseSalesJournalCsv('')).toThrow(/vide/);
  });
});

describe('sumup-sales-journal-import — formatProductSummary', () => {
  it('joins descriptions, prefixing quantity when greater than 1', () => {
    const summary = formatProductSummary([
      {
        transactionRef: 'T1',
        description: 'Crémeuse Sénior 31cm',
        category: null,
        quantity: 1,
        amountCents: 1200,
      },
      {
        transactionRef: 'T1',
        description: 'Canette Coca',
        category: null,
        quantity: 2,
        amountCents: 400,
      },
    ]);

    expect(summary).toBe('Crémeuse Sénior 31cm, 2x Canette Coca');
  });
});

describe('sumup-sales-journal-import — importSalesJournal', () => {
  function fakePrisma(findTransactionId: (transactionCode: string) => string | null) {
    return {
      sumupTransaction: {
        findFirst: jest.fn().mockImplementation((args: { where: { transactionCode: string } }) => {
          const id = findTransactionId(args.where.transactionCode);
          return Promise.resolve(id ? { id } : null);
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      sumupTransactionItem: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
  }

  it('attaches productSummary and structured items to matching cached transactions, never touching amounts', async () => {
    const prisma = fakePrisma(code => (code === 'TAAA1' ? 'txn-uuid-1' : null));
    const csv = [
      HEADER,
      csvLine('TAAA1', 'Crémeuse Sénior 31cm', 1, '2 - Pizzas Base Crème Fraîche', '13,50'),
    ].join('\n');

    const result = await importSalesJournal(prisma as never, 'b1', csv);

    expect(result.matched).toBe(1);
    expect(prisma.sumupTransaction.update).toHaveBeenCalledWith({
      where: { id: 'txn-uuid-1' },
      data: { productSummary: 'Crémeuse Sénior 31cm' },
    });
    expect(prisma.sumupTransactionItem.deleteMany).toHaveBeenCalledWith({
      where: { transactionId: 'txn-uuid-1' },
    });
    expect(prisma.sumupTransactionItem.createMany).toHaveBeenCalledWith({
      data: [
        {
          transactionId: 'txn-uuid-1',
          description: 'Crémeuse Sénior 31cm',
          category: '2 - Pizzas Base Crème Fraîche',
          quantity: 1,
          amountCents: 1350,
        },
      ],
    });
  });

  it('reports transaction codes with no match in the cache (not yet synced) and writes nothing for them', async () => {
    const prisma = fakePrisma(() => null);
    const csv = [HEADER, csvLine('TAAA9', 'Reine Sénior 31cm')].join('\n');

    const result = await importSalesJournal(prisma as never, 'b1', csv);

    expect(result.matched).toBe(0);
    expect(result.unmatched).toEqual(['TAAA9']);
    expect(prisma.sumupTransaction.update).not.toHaveBeenCalled();
    expect(prisma.sumupTransactionItem.createMany).not.toHaveBeenCalled();
  });

  it('replaces existing items on reimport instead of accumulating duplicates', async () => {
    const prisma = fakePrisma(() => 'txn-uuid-1');
    const csv = [HEADER, csvLine('TAAA1', 'Reine Sénior 31cm')].join('\n');

    await importSalesJournal(prisma as never, 'b1', csv);
    await importSalesJournal(prisma as never, 'b1', csv);

    expect(prisma.sumupTransactionItem.deleteMany).toHaveBeenCalledTimes(2);
    expect(prisma.sumupTransactionItem.createMany).toHaveBeenCalledTimes(2);
  });
});
