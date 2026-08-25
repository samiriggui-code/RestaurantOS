import { weeklyPromoPrice } from '../catalog/pizza-sizes';

// Lundi 2026-08-24, Mardi 2026-08-25, ..., Vendredi 2026-08-28, Dimanche 2026-08-30
const MONDAY = new Date('2026-08-24T12:00:00Z');
const TUESDAY = new Date('2026-08-25T12:00:00Z');
const WEDNESDAY = new Date('2026-08-26T12:00:00Z');
const THURSDAY = new Date('2026-08-27T12:00:00Z');
const FRIDAY = new Date('2026-08-28T12:00:00Z');
const SUNDAY = new Date('2026-08-30T12:00:00Z');

describe('weeklyPromoPrice', () => {
  it('applies 18€ Méga lun-jeu à emporter, hors Z Pizzas', () => {
    for (const day of [MONDAY, TUESDAY, WEDNESDAY, THURSDAY]) {
      expect(weeklyPromoPrice('tomate', '40', 'pickup', day)).toBe(18);
      expect(weeklyPromoPrice('creme', '40', 'pickup', day)).toBe(18);
    }
  });

  it('does not apply the Méga deal on Friday/Sunday', () => {
    expect(weeklyPromoPrice('tomate', '40', 'pickup', FRIDAY)).toBeNull();
    expect(weeklyPromoPrice('tomate', '40', 'pickup', SUNDAY)).toBeNull();
  });

  it('applies 11€ Sénior only on Tuesday', () => {
    expect(weeklyPromoPrice('tomate', '31', 'pickup', TUESDAY)).toBe(11);
    expect(weeklyPromoPrice('tomate', '31', 'pickup', MONDAY)).toBeNull();
    expect(weeklyPromoPrice('tomate', '31', 'pickup', WEDNESDAY)).toBeNull();
  });

  it('excludes Les Z Pizzas from both deals', () => {
    expect(weeklyPromoPrice('z-pizzas', '40', 'pickup', MONDAY)).toBeNull();
    expect(weeklyPromoPrice('z-pizzas', '31', 'pickup', TUESDAY)).toBeNull();
  });

  it('requires pickup (à emporter) — never applies on delivery', () => {
    expect(weeklyPromoPrice('tomate', '40', 'delivery', MONDAY)).toBeNull();
    expect(weeklyPromoPrice('tomate', '31', 'delivery', TUESDAY)).toBeNull();
  });

  it('does not apply to other sizes (50/60x40) even on eligible days', () => {
    expect(weeklyPromoPrice('tomate', '50', 'pickup', MONDAY)).toBeNull();
    expect(weeklyPromoPrice('tomate', '60x40', 'pickup', TUESDAY)).toBeNull();
  });

  it('does not apply to non-pizza categories', () => {
    expect(weeklyPromoPrice('desserts', '40', 'pickup', MONDAY)).toBeNull();
    expect(weeklyPromoPrice('boissons', '31', 'pickup', TUESDAY)).toBeNull();
  });
});
