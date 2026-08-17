import { describe, it, expect } from '@jest/globals'
import { validateOnlineOrderBody, type OnlineOrderBody } from '../../lib/online-order'

const baseBody: OnlineOrderBody = {
  lines: [
    {
      slug: 'tomate-margherita',
      name: 'Margherita',
      categoryId: 'tomate',
      unitPrice: 11,
      quantity: 2,
    },
  ],
  checkout: {
    orderType: 'pickup',
    customerFirstName: 'Jean',
    customerLastName: 'Dupont',
    customerPhone: '0612345678',
    customerEmail: 'jean@test.fr',
    addressLine: '',
    postalCode: '',
    city: '',
    instructions: '',
    timeSlot: 'Dès que possible',
  },
  subtotal: 22,
  deliveryFee: 0,
  total: 22,
}

describe('validateOnlineOrderBody', () => {
  it('accepts valid pickup order', () => {
    expect(validateOnlineOrderBody(baseBody)).toBeNull()
  })

  it('rejects empty cart', () => {
    expect(validateOnlineOrderBody({ ...baseBody, lines: [] })).toBe('Panier vide')
  })

  it('rejects inconsistent total', () => {
    expect(validateOnlineOrderBody({ ...baseBody, total: 99 })).toBe('Total incohérent')
  })

  it('requires delivery address', () => {
    const body: OnlineOrderBody = {
      ...baseBody,
      checkout: { ...baseBody.checkout, orderType: 'delivery' },
      deliveryFee: 4.5,
      total: 26.5,
    }
    expect(validateOnlineOrderBody(body)).toBe('Adresse de livraison incomplète')
  })
})
