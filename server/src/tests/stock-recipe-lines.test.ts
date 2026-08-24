import { parseRecipeLines } from '../lib/stock-recipe-lines';

describe('parseRecipeLines', () => {
  it('rejects non-array', () => {
    expect(parseRecipeLines(null).ok).toBe(false);
    expect(parseRecipeLines({})).toEqual({ ok: false, error: 'lines[] requis' });
  });

  it('accepts empty array (clear recipe)', () => {
    expect(parseRecipeLines([])).toEqual({ ok: true, lines: [] });
  });

  it('rejects invalid quantity or missing stockItemId', () => {
    expect(parseRecipeLines([{ stockItemId: 'a', quantity: 0 }]).ok).toBe(false);
    expect(parseRecipeLines([{ stockItemId: '', quantity: 1 }]).ok).toBe(false);
    expect(parseRecipeLines([{ quantity: 1 }]).ok).toBe(false);
  });

  it('rejects duplicate stockItemId', () => {
    const result = parseRecipeLines([
      { stockItemId: 'mozza', quantity: 0.1 },
      { stockItemId: 'mozza', quantity: 0.2 },
    ]);
    expect(result).toEqual({ ok: false, error: 'Ingrédient en double dans la recette' });
  });

  it('parses valid lines', () => {
    expect(
      parseRecipeLines([
        { stockItemId: ' mozza ', quantity: 0.12 },
        { stockItemId: 'tomate', quantity: 0.08 },
      ])
    ).toEqual({
      ok: true,
      lines: [
        { stockItemId: 'mozza', quantity: 0.12 },
        { stockItemId: 'tomate', quantity: 0.08 },
      ],
    });
  });
});
