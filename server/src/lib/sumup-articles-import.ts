import type { PrismaClient } from '@prisma/client';
import { deductionsForMenuLine } from './order-stock';

/**
 * Import manuel de l'export "Rapport-articles" SumUp (Rapports > Exports > Articles) —
 * recale le stock RestaurantOS sur les ventes faites directement sur la Caisse SumUp
 * (comptoir), invisibles autrement (pas d'API Caisse Pro, cf. SUMUP-CAPACITES-CONSTATEES.md).
 *
 * Colonnes attendues : "Nom de l'article,Nom de la variante,Catégorie,SKU,Quantité,Devise,Montant"
 * Les tailles (variantes) sont sommées par nom d'article : le modèle de recette RestaurantOS
 * ne distingue pas la taille pour la déduction de stock (même limite que pour les commandes
 * normales, cf. `order-stock.ts`).
 */

export type SumupArticlesImportResult = {
  matched: {
    menuItemName: string;
    quantitySold: number;
    stockAdjustments: { stockItemName: string; deducted: number }[];
  }[];
  unmatched: { articleName: string; quantitySold: number }[];
};

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      result.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  result.push(cur);
  return result;
}

function parseNumberFr(raw: string): number {
  const cleaned = raw.trim().replace(/\s/g, '').replace(',', '.');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

/** Regroupe les quantités par nom d'article (toutes tailles/variantes confondues). */
export function parseSumupArticlesCsv(text: string): Map<string, number> {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter(l => l.trim().length > 0);
  if (lines.length < 2) return new Map();

  const header = parseCsvLine(lines[0]).map(h => h.trim().toLowerCase());
  const nameIdx = header.findIndex(
    h => h.includes("nom de l'article") || h.includes('nom de l\u2019article')
  );
  const qtyIdx = header.findIndex(h => h.includes('quantit'));
  if (nameIdx === -1 || qtyIdx === -1) {
    throw new Error(
      'Format CSV inattendu — colonnes "Nom de l\'article" / "Quantité" introuvables (export Rapports > Exports > Articles requis)'
    );
  }

  const totals = new Map<string, number>();
  for (const line of lines.slice(1)) {
    const cols = parseCsvLine(line);
    const name = (cols[nameIdx] ?? '').trim();
    if (!name) continue;
    const qty = parseNumberFr(cols[qtyIdx] ?? '0');
    totals.set(name, (totals.get(name) ?? 0) + qty);
  }
  return totals;
}

/**
 * @param batchRef identifiant unique du fichier importé (ex. nom de fichier + période) —
 * sert à ne jamais déduire deux fois le même import.
 */
export async function importSumupArticlesSales(
  prisma: PrismaClient,
  businessId: string,
  csvText: string,
  batchRef: string
): Promise<SumupArticlesImportResult> {
  const totals = parseSumupArticlesCsv(csvText);
  const matched: SumupArticlesImportResult['matched'] = [];
  const unmatched: SumupArticlesImportResult['unmatched'] = [];

  for (const [articleName, quantitySold] of totals) {
    if (quantitySold <= 0) continue;

    const menuItem = await prisma.menuItem.findFirst({
      where: { name: { equals: articleName, mode: 'insensitive' }, category: { businessId } },
    });

    if (!menuItem) {
      unmatched.push({ articleName, quantitySold });
      continue;
    }

    const stockAdjustments: { stockItemName: string; deducted: number }[] = [];

    await prisma.$transaction(async tx => {
      const deductions = await deductionsForMenuLine(tx, businessId, menuItem.id, quantitySold);
      for (const { stockItemId, quantity } of deductions) {
        const ref = `import:sumup-articles:${batchRef}:${stockItemId}`;
        const already = await tx.stockMovement.findFirst({ where: { note: ref } });
        if (already) continue;

        const stock = await tx.stockItem.findUnique({ where: { id: stockItemId } });
        if (!stock) continue;

        const newQty = stock.quantity - quantity;
        await tx.stockItem.update({ where: { id: stock.id }, data: { quantity: newQty } });
        await tx.stockMovement.create({
          data: { stockItemId: stock.id, orderId: null, type: 'OUT', quantity, note: ref },
        });
        stockAdjustments.push({ stockItemName: stock.name, deducted: quantity });
      }
    });

    matched.push({ menuItemName: menuItem.name, quantitySold, stockAdjustments });
  }

  return { matched, unmatched };
}

export type SumupVentesSummary = {
  totalCents: number;
  rowCount: number;
  /** Total par libellé exact de "Moyen de paiement" tel qu'exporté par SumUp (non normalisé —
   * on n'a pas encore vu de vraie donnée pour savoir si c'est "Espèces", "CASH", etc.). */
  byPaymentMethod: { method: string; totalCents: number }[];
};

/** Résumé de l'export "Rapport-ventes" (Rapports > Exports > Ventes) — total par moyen de paiement. */
export function parseSumupVentesCsv(text: string): SumupVentesSummary {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter(l => l.trim().length > 0);
  if (lines.length < 2) return { totalCents: 0, rowCount: 0, byPaymentMethod: [] };

  const header = parseCsvLine(lines[0]).map(h => h.trim().toLowerCase());
  const methodIdx = header.findIndex(h => h.includes('moyen de paiement'));
  const priceIdx = header.findIndex(h => h.includes('prix (ttc)') || h.includes('prix ttc'));
  if (methodIdx === -1 || priceIdx === -1) {
    throw new Error(
      'Format CSV inattendu — colonnes "Moyen de paiement" / "Prix (TTC)" introuvables (export Rapports > Exports > Ventes requis)'
    );
  }

  const byMethod = new Map<string, number>();
  let totalCents = 0;
  let rowCount = 0;
  for (const line of lines.slice(1)) {
    const cols = parseCsvLine(line);
    const method = (cols[methodIdx] ?? '').trim() || '(non renseigné)';
    const cents = Math.round(parseNumberFr(cols[priceIdx] ?? '0') * 100);
    byMethod.set(method, (byMethod.get(method) ?? 0) + cents);
    totalCents += cents;
    rowCount += 1;
  }

  return {
    totalCents,
    rowCount,
    byPaymentMethod: [...byMethod.entries()].map(([method, cents]) => ({
      method,
      totalCents: cents,
    })),
  };
}
