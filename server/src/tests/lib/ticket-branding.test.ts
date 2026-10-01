import {
  buildTicketFooter,
  buildTicketHeader,
  resolveTicketBranding,
} from '../../lib/ticket-branding';
import { generateKitchenTicketText, generateReceiptText } from '../../services/printer';

describe('ticket-branding', () => {
  const business = {
    name: 'La Z Pizza',
    settings: {
      siret: '981 700 842 00017',
      vatNumber: 'FR81 981 700 842',
      address: "33 Avenue de l'Entre-Deux-Mers, 33370 Fargues-Saint-Hilaire",
      phone: '05.57.80.32.45',
      legalName: 'LA Z PIZZA',
      legalForm: 'Société à responsabilité limitée',
      website: 'https://lazpizza.fr',
    },
  };

  it('inclut logo et footer légal', () => {
    const branding = resolveTicketBranding(business);
    const header = buildTicketHeader(branding, { banner: 'CUISINE', mode: 'kitchen' }).join('\n');
    const footer = buildTicketFooter(branding).join('\n');

    expect(header).toContain('La Z Pizza');
    expect(header).toContain('|  Z  |');
    expect(header).toContain('CUISINE');
    expect(footer).toContain('SIRET');
    expect(footer).toContain('TVA');
    expect(footer).toContain('Merci');
  });
});

describe('printer tickets', () => {
  const business = {
    name: 'La Z Pizza',
    settings: {
      siret: '981 700 842 00017',
      vatNumber: 'FR81 981 700 842',
      address: "33 Avenue de l'Entre-Deux-Mers, 33370 Fargues-Saint-Hilaire",
      phone: '05.57.80.32.45',
    },
  };

  const order = {
    orderNumber: 42,
    type: 'TAKEAWAY',
    isOnlineOrder: false,
    createdAt: new Date('2026-07-11T18:30:00Z'),
    items: [{ quantity: 1, price: 1200, menuItem: { name: 'Margherita' } }],
    subtotal: 1091,
    tax: 109,
    serviceCharge: 0,
    discount: 0,
    total: 1200,
    paymentMethod: 'CASH',
    paymentStatus: 'PAID',
  };

  it('génère ticket cuisine compact sans pied légal', () => {
    const text = generateKitchenTicketText(order, business);
    expect(text).toContain('La Z Pizza');
    expect(text).toContain('|  Z  |');
    expect(text).toContain('#42');
    expect(text).not.toContain('SIRET');
    expect(text).not.toContain('Bon courage');
  });

  it('génère reçu client avec mentions légales', () => {
    const text = generateReceiptText(order, business);
    expect(text).toContain('LA Z PIZZA');
    expect(text).toContain('TOTAL TTC');
    expect(text).toContain('Merci de votre visite');
    expect(text).toContain('SIRET');
  });
});
