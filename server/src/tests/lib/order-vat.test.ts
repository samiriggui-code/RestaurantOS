import {
  computeOrderTotalsFromLines,
  defaultVatBpsFromTaxRate,
  type OrderVatLine,
} from '../../lib/order-vat'
import { orderPriceMode } from '../../lib/invoice-vat'

describe('order-vat multi-TVA', () => {
  it('ventile 10 % et 20 % sur une commande caisse HT', () => {
    const lines: OrderVatLine[] = [
      { quantity: 2, unitPriceCents: 1000, vatRateBps: 1000 },
      { quantity: 1, unitPriceCents: 500, vatRateBps: 2000 },
    ]
    const result = computeOrderTotalsFromLines(lines, {
      priceMode: 'HT',
      serviceRatePercent: 0,
      orderType: 'TAKEAWAY',
    })
    expect(result.subtotal).toBe(2500)
    expect(result.tax).toBe(300)
    expect(result.taxByRate['10']).toBe(200)
    expect(result.taxByRate['20']).toBe(100)
    expect(result.total).toBe(2800)
  })

  it('applique 5,5 % sur ligne à emporter', () => {
    const lines: OrderVatLine[] = [{ quantity: 1, unitPriceCents: 1000, vatRateBps: 550 }]
    const result = computeOrderTotalsFromLines(lines, {
      priceMode: 'HT',
      serviceRatePercent: 0,
      orderType: 'TAKEAWAY',
    })
    expect(result.tax).toBe(55)
    expect(result.taxByRate['5.5']).toBe(55)
  })

  it('commande en ligne TTC : tax stockée à 0', () => {
    const lines: OrderVatLine[] = [
      { quantity: 1, unitPriceCents: 1100, vatRateBps: 1000 },
      { quantity: 1, unitPriceCents: 600, vatRateBps: 2000 },
    ]
    const result = computeOrderTotalsFromLines(lines, {
      priceMode: 'TTC',
      serviceRatePercent: 0,
      orderType: 'DELIVERY',
      extraCents: 250,
    })
    expect(result.subtotal).toBe(1700)
    expect(result.tax).toBe(0)
    expect(result.serviceCharge).toBe(250)
    expect(result.total).toBe(1950)
    expect(Object.keys(result.taxByRate).length).toBeGreaterThan(0)
  })

  it('dérive le taux par défaut depuis Business.taxRate', () => {
    expect(defaultVatBpsFromTaxRate(10)).toBe(1000)
    expect(orderPriceMode({ isOnlineOrder: false, tax: 100 })).toBe('HT')
    expect(orderPriceMode({ isOnlineOrder: true, tax: 0 })).toBe('TTC')
    expect(orderPriceMode({ isOnlineOrder: true, tax: 230 })).toBe('TTC')
  })
})
