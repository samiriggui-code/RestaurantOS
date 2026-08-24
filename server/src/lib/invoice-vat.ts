/**
 * Calcul TVA factures — aligné commandes RestaurantOS.
 *
 * - Caisse / sur place : prix menu = HT, TVA ajoutée (Order.subtotal + Order.tax).
 * - Site en ligne : prix affichés = TTC, Order.tax = 0, livraison dans serviceCharge.
 */

export type PriceMode = 'HT' | 'TTC';

export type InvoiceLineInput = {
  description: string;
  quantity: number;
  /** HT ou TTC selon priceMode à l'import — stocké HT en base InvoiceLine */
  unitPriceCents: number;
  taxRatePercent: number;
  sortOrder?: number;
};

export type InvoiceLineStored = {
  description: string;
  quantity: number;
  unitPriceCents: number;
  taxRate: number;
  sortOrder: number;
};

/** Extrait HT + TVA unitaire depuis un prix TTC (arrondi centime, TVA = TTC − HT). */
export function splitTtcUnitCents(
  unitTtcCents: number,
  taxRatePercent: number
): { ht: number; tax: number } {
  const divisor = 1 + taxRatePercent / 100;
  const ht = Math.round(unitTtcCents / divisor);
  const tax = unitTtcCents - ht;
  return { ht, tax };
}

export function unitHtFromPrice(
  unitPriceCents: number,
  taxRatePercent: number,
  priceMode: PriceMode
): number {
  if (priceMode === 'HT') return unitPriceCents;
  return splitTtcUnitCents(unitPriceCents, taxRatePercent).ht;
}

/** Montants d'une ligne facture (prix unitaire stocké HT). */
export function lineAmounts(
  quantity: number,
  unitHtCents: number,
  taxRatePercent: number
): { htCents: number; taxCents: number; ttcCents: number } {
  const htCents = Math.round(quantity * unitHtCents);
  const taxCents = Math.round((htCents * taxRatePercent) / 100);
  return { htCents, taxCents, ttcCents: htCents + taxCents };
}

export function computeLineTotals(
  lines: Array<{ quantity: number; unitPriceCents: number; taxRate: number }>
): { subtotalCents: number; taxCents: number; totalCents: number } {
  let subtotalCents = 0;
  let taxCents = 0;
  for (const line of lines) {
    const { htCents, taxCents: lineTax } = lineAmounts(
      line.quantity,
      line.unitPriceCents,
      line.taxRate
    );
    subtotalCents += htCents;
    taxCents += lineTax;
  }
  return { subtotalCents, taxCents, totalCents: subtotalCents + taxCents };
}

/** Mode tarifaire d'une commande en BDD. */
export function orderPriceMode(order: { isOnlineOrder: boolean; tax?: number }): PriceMode {
  // Commande web : prix figés TTC (Order.tax souvent 0 — ne pas basculer en HT)
  if (order.isOnlineOrder) return 'TTC';
  return 'HT';
}

export type OrderForInvoiceLines = {
  isOnlineOrder: boolean;
  tax: number;
  type: string;
  subtotal: number;
  serviceCharge: number;
  discount: number;
  total: number;
  items: Array<{
    quantity: number;
    price: number;
    menuItem: { name: string; nameAr?: string | null; vatRateBps?: number | null };
  }>;
};

export function buildInvoiceLinesFromOrder(
  order: OrderForInvoiceLines,
  defaultTaxRatePercent: number,
  nameFn: (item: OrderForInvoiceLines['items'][0]['menuItem']) => string
): InvoiceLineStored[] {
  const mode = orderPriceMode(order);
  const lines: InvoiceLineStored[] = [];

  order.items.forEach((item, i) => {
    const taxRatePercent =
      item.menuItem.vatRateBps != null ? item.menuItem.vatRateBps / 100 : defaultTaxRatePercent;
    const unitHt = unitHtFromPrice(item.price, taxRatePercent, mode);
    lines.push({
      description: nameFn(item.menuItem),
      quantity: item.quantity,
      unitPriceCents: unitHt,
      taxRate: taxRatePercent,
      sortOrder: i,
    });
  });

  if (order.serviceCharge > 0) {
    const isDelivery = order.type === 'DELIVERY';
    const label = isDelivery ? 'Frais de livraison' : 'Frais de service';
    const serviceMode: PriceMode = mode === 'TTC' ? 'TTC' : 'HT';
    const serviceTaxRate = mode === 'TTC' ? defaultTaxRatePercent : 0;
    const unitHt = unitHtFromPrice(
      order.serviceCharge,
      serviceTaxRate || defaultTaxRatePercent,
      serviceMode
    );
    lines.push({
      description: label,
      quantity: 1,
      unitPriceCents: unitHt,
      taxRate: serviceTaxRate,
      sortOrder: 900,
    });
  }

  if (order.discount > 0) {
    const unitHt = unitHtFromPrice(order.discount, defaultTaxRatePercent, mode);
    lines.push({
      description: 'Remise',
      quantity: 1,
      unitPriceCents: -unitHt,
      taxRate: defaultTaxRatePercent,
      sortOrder: 901,
    });
  }

  return lines;
}

/**
 * Totaux facture depuis commande — calé sur Order.total payé.
 * Caisse : reprend Order.subtotal / tax / total quand cohérent.
 * En ligne TTC : TVA calculée par lignes, total = Order.total.
 */
export function invoiceTotalsFromOrder(
  order: OrderForInvoiceLines,
  lines: InvoiceLineStored[]
): { subtotalCents: number; taxCents: number; totalCents: number } {
  const computed = computeLineTotals(lines);
  const mode = orderPriceMode(order);

  if (mode === 'TTC') {
    return {
      subtotalCents: computed.subtotalCents,
      taxCents: computed.taxCents,
      totalCents: order.total,
    };
  }

  if (mode === 'HT' && order.tax > 0) {
    return {
      subtotalCents: computed.subtotalCents,
      taxCents: order.tax,
      totalCents: order.total,
    };
  }

  if (Math.abs(computed.totalCents - order.total) <= 2) {
    return computed;
  }

  return {
    subtotalCents: computed.subtotalCents,
    taxCents: computed.taxCents,
    totalCents: order.total,
  };
}
