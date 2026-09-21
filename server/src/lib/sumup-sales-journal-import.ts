/**
 * Import du "Rapport de ventes" (journal de ventes) exporté manuellement depuis SumUp —
 * seul export SumUp qui donne le détail produit par transaction (l'API Cloud ne le fournit
 * jamais, vérifié par inspection directe du payload). On regroupe les lignes par
 * "Réf. transaction" et on rattache le détail (résumé texte + lignes structurées) aux
 * transactions déjà en cache (matching par transactionCode), sans jamais recalculer les
 * montants de la transaction elle-même — la source du montant total reste l'API/le cache,
 * ce fichier ne complète que le détail produit (alimente "Ventes par article"/"CA par
 * catégorie", qui avant n'incluaient que les commandes Order).
 */

import type { PrismaClient } from '@prisma/client';

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === ',' && !inQuotes) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

/** "12,00" (format SumUp, virgule décimale) -> 1200 centimes. */
function parseAmountToCents(raw: string | undefined): number {
  if (!raw) return 0;
  const normalized = raw.trim().replace(',', '.');
  const value = Number(normalized);
  return Number.isFinite(value) ? Math.round(value * 100) : 0;
}

type JournalLine = {
  transactionRef: string;
  description: string;
  category: string | null;
  quantity: number;
  amountCents: number;
};

const REQUIRED_HEADERS = ['Réf. transaction', 'Description', 'Quantité'];

export function parseSalesJournalCsv(csv: string): Map<string, JournalLine[]> {
  const lines = csv.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length === 0) throw new Error('Fichier CSV vide');

  const header = parseCsvLine(lines[0]);
  const idx = {
    ref: header.indexOf('Réf. transaction'),
    description: header.indexOf('Description'),
    quantity: header.indexOf('Quantité'),
    category: header.indexOf('Catégorie'),
    amount: header.indexOf('Prix (TTC)'),
  };
  for (const required of REQUIRED_HEADERS) {
    if (!header.includes(required)) {
      throw new Error(
        `Colonne "${required}" absente — ce n'est pas un export "Rapport de ventes" SumUp valide`
      );
    }
  }

  const byTransaction = new Map<string, JournalLine[]>();
  for (const line of lines.slice(1)) {
    const cols = parseCsvLine(line);
    const transactionRef = cols[idx.ref]?.trim();
    const description = cols[idx.description]?.trim();
    if (!transactionRef || !description) continue;
    const quantity = Number(cols[idx.quantity]) || 1;
    const category = idx.category >= 0 ? cols[idx.category]?.trim() || null : null;
    const amountCents = idx.amount >= 0 ? parseAmountToCents(cols[idx.amount]) : 0;

    const existing = byTransaction.get(transactionRef) ?? [];
    existing.push({ transactionRef, description, category, quantity, amountCents });
    byTransaction.set(transactionRef, existing);
  }

  return byTransaction;
}

export function formatProductSummary(lines: JournalLine[]): string {
  return lines
    .map(l => (l.quantity > 1 ? `${l.quantity}x ${l.description}` : l.description))
    .join(', ');
}

export type SalesJournalImportResult = {
  matched: number;
  unmatched: string[];
};

/**
 * Rattache le détail produit du journal de ventes aux transactions déjà en cache : le
 * résumé texte (`productSummary`, affichage Suivi caisse) ET les lignes structurées
 * (`SumupTransactionItem`, exploitées par les rapports articles/catégories). Réimport
 * idempotent — les anciennes lignes d'une transaction sont remplacées, jamais cumulées.
 * N'écrit jamais le montant de la transaction elle-même — appeler la synchro avant,
 * sinon rien à rattacher (une transaction non encore en cache est reportée en "unmatched").
 */
export async function importSalesJournal(
  prisma: PrismaClient,
  businessId: string,
  csv: string
): Promise<SalesJournalImportResult> {
  const byTransaction = parseSalesJournalCsv(csv);

  const unmatched: string[] = [];
  let matched = 0;

  for (const [transactionCode, journalLines] of byTransaction) {
    const transaction = await prisma.sumupTransaction.findFirst({
      where: { businessId, transactionCode },
      select: { id: true },
    });
    if (!transaction) {
      unmatched.push(transactionCode);
      continue;
    }

    await prisma.sumupTransaction.update({
      where: { id: transaction.id },
      data: { productSummary: formatProductSummary(journalLines) },
    });
    await prisma.sumupTransactionItem.deleteMany({ where: { transactionId: transaction.id } });
    await prisma.sumupTransactionItem.createMany({
      data: journalLines.map(l => ({
        transactionId: transaction.id,
        description: l.description,
        category: l.category,
        quantity: l.quantity,
        amountCents: l.amountCents,
      })),
    });
    matched += 1;
  }

  return { matched, unmatched };
}
