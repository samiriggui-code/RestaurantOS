import {
  buildInvoiceLinesFromOrder,
  invoiceTotalsFromOrder,
  orderPriceMode,
} from '../../lib/invoice-vat'

describe('invoice-vat commandes en ligne', () => {
  const onlineOrder277125 = {
    isOnlineOrder: true,
    tax: 0,
    type: 'DELIVERY',
    subtotal: 2300,
    serviceCharge: 0,
    discount: 0,
    total: 2300,
    items: [
      { quantity: 1, price: 1100, menuItem: { name: 'Margherita', vatRateBps: 1000 } },
      { quantity: 1, price: 100, menuItem: { name: 'Légumes', vatRateBps: 1000 } },
      { quantity: 1, price: 250, menuItem: { name: 'Viande / fromage', vatRateBps: 1000 } },
      { quantity: 1, price: 300, menuItem: { name: 'Pâte Cheezy', vatRateBps: 1000 } },
      { quantity: 1, price: 350, menuItem: { name: 'Tiramisu caramel', vatRateBps: 1000 } },
      { quantity: 1, price: 200, menuItem: { name: 'Coca (canette)', vatRateBps: 1000 } },
    ],
  }

  it('traiter les prix web en TTC même si Order.tax > 0', () => {
    expect(orderPriceMode({ isOnlineOrder: true, tax: 0 })).toBe('TTC')
    expect(orderPriceMode({ isOnlineOrder: true, tax: 230 })).toBe('TTC')
  })

  it('ne pas re-facturer 10 % sur des lignes déjà TTC (commande #277125)', () => {
    const lines = buildInvoiceLinesFromOrder(onlineOrder277125, 10, (item) => item.name)
    const totals = invoiceTotalsFromOrder(onlineOrder277125, lines)

    expect(totals.totalCents).toBe(2300)
    expect(totals.totalCents).not.toBe(2530)
    expect(totals.subtotalCents).toBeLessThan(2300)
    expect(totals.taxCents).toBeGreaterThan(0)
    expect(totals.subtotalCents + totals.taxCents).toBeLessThanOrEqual(2300 + 2)
  })
})
