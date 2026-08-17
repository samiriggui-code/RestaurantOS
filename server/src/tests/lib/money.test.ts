import { eurosToCents, centsToEuros, formatEUR, orderTotalsCents } from '../../lib/money'

describe('money', () => {
  it('converts euros to cents', () => {
    expect(eurosToCents(11.5)).toBe(1150)
    expect(eurosToCents(9)).toBe(900)
  })

  it('formats EUR from cents', () => {
    expect(formatEUR(1150)).toMatch(/11,50/)
  })

  it('calculates order totals in cents', () => {
    const { tax, serviceCharge, total } = orderTotalsCents(2000, 10, 0, 'TAKEAWAY')
    expect(tax).toBe(200)
    expect(serviceCharge).toBe(0)
    expect(total).toBe(2200)
    expect(centsToEuros(total)).toBe(22)
  })
})
