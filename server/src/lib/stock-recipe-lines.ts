/**
 * Validation lignes BOM (recette menu → stock).
 * Partagée routes + tests.
 */

export type RecipeLineInput = { stockItemId?: string; quantity?: number };

export type ParsedRecipeLine = { stockItemId: string; quantity: number };

export function parseRecipeLines(
  raw: unknown
): { ok: true; lines: ParsedRecipeLine[] } | { ok: false; error: string } {
  if (!Array.isArray(raw)) return { ok: false, error: 'lines[] requis' };
  const lines: ParsedRecipeLine[] = [];
  const seen = new Set<string>();
  for (const row of raw as RecipeLineInput[]) {
    const stockItemId = typeof row?.stockItemId === 'string' ? row.stockItemId.trim() : '';
    const quantity = Number(row?.quantity);
    if (!stockItemId || !Number.isFinite(quantity) || quantity <= 0) {
      return { ok: false, error: 'Chaque ligne doit avoir stockItemId et quantity > 0' };
    }
    if (seen.has(stockItemId)) {
      return { ok: false, error: 'Ingrédient en double dans la recette' };
    }
    seen.add(stockItemId);
    lines.push({ stockItemId, quantity });
  }
  return { ok: true, lines };
}
