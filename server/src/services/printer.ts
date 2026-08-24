import { centsToEuros } from '../lib/money';
import { orderItemDisplayName, orderItemModifierLines } from '../lib/order-item-display';
import {
  buildTicketFooter,
  buildTicketHeader,
  padCenter,
  resolveTicketBranding,
  TICKET_WIDTH,
  wrapTicketLines,
} from '../lib/ticket-branding';

interface ReceiptData {
  businessName: string;
  businessNameAr?: string;
  orderNumber: number;
  tableNumber?: string;
  cashierName?: string;
  items: Array<{
    name: string;
    nameAr?: string;
    quantity: number;
    price: number;
    modifiers?: string[];
  }>;
  subtotal: number;
  tax: number;
  serviceCharge: number;
  discount: number;
  total: number;
  paymentMethod?: string;
  paymentStatus?: string;
  date: string;
  customerName?: string;
  footer?: string;
}

function euros(cents: number): string {
  return centsToEuros(cents).toFixed(2);
}

function formatDeliveryAddress(order: {
  deliveryAddress?: string | null;
  deliveryPostalCode?: string | null;
  deliveryCity?: string | null;
}): string[] {
  const lines: string[] = [];
  if (order.deliveryAddress?.trim()) {
    lines.push(...wrapTicketLines(order.deliveryAddress.trim(), 32));
  }
  const cityLine = [order.deliveryPostalCode?.trim(), order.deliveryCity?.trim()]
    .filter(Boolean)
    .join(' ');
  if (cityLine) lines.push(cityLine);
  return lines;
}

const TYPE_LABEL: Record<string, string> = {
  DINE_IN: 'Sur place',
  TAKEAWAY: 'À emporter',
  DELIVERY: 'Livraison',
};

type PrinterOrderItemInput = {
  menuItem: { name?: string | null; nameAr?: string | null };
  selectedModifiers?: unknown;
  notes?: string | null;
  quantity: number;
  price: number;
};

/** Champs communs consommés par les 4 générateurs de ce fichier (reçu, cuisine, étiquette, dispatch). */
type PrinterOrderInput = {
  orderNumber: number;
  table?: { number?: string } | null;
  cashier?: { name?: string } | null;
  items: PrinterOrderItemInput[];
  subtotal: number;
  tax: number;
  serviceCharge: number;
  discount: number;
  total: number;
  paymentMethod?: string | null;
  paymentStatus?: string | null;
  createdAt: Date | string;
  customerName?: string | null;
  customerPhone?: string | null;
  type: string;
  isOnlineOrder?: boolean;
  deliveryAddress?: string | null;
  deliveryPostalCode?: string | null;
  deliveryCity?: string | null;
  notes?: string | null;
  trackingToken?: string | null;
};

type PrinterBusinessInput = {
  name: string;
  nameAr?: string | null;
  settings?: unknown;
};

export function generateReceiptData(
  order: PrinterOrderInput,
  business: PrinterBusinessInput
): ReceiptData {
  return {
    businessName: business.name,
    businessNameAr: business.nameAr ?? undefined,
    orderNumber: order.orderNumber,
    tableNumber: order.table?.number,
    cashierName: order.cashier?.name,
    items: order.items.map(item => ({
      name: orderItemDisplayName(item),
      nameAr: item.menuItem?.nameAr ?? undefined,
      quantity: item.quantity,
      price: item.price,
      modifiers: orderItemModifierLines(item).length
        ? orderItemModifierLines(item)
        : item.selectedModifiers
          ? (Object.values(item.selectedModifiers as Record<string, unknown>).flat() as string[])
          : undefined,
    })),
    subtotal: order.subtotal,
    tax: order.tax,
    serviceCharge: order.serviceCharge,
    discount: order.discount,
    total: order.total,
    paymentMethod: order.paymentMethod ?? undefined,
    paymentStatus: order.paymentStatus ?? undefined,
    date: new Date(order.createdAt).toLocaleDateString('fr-FR'),
    customerName: order.customerName ?? undefined,
    footer: business.name || business.nameAr || undefined,
  };
}

export function generateEscPosReceipt(data: ReceiptData): Uint8Array {
  const WIDTH = 32;
  const LF = '\n';
  const lines: string[] = [];

  lines.push('');
  lines.push(padCenter(data.businessName, WIDTH));
  lines.push('='.repeat(WIDTH));
  lines.push(`Commande #${data.orderNumber}`);
  if (data.tableNumber) lines.push(`Table: ${data.tableNumber}`);
  if (data.customerName) lines.push(`Client: ${data.customerName}`);
  lines.push(`Date: ${data.date}`);
  if (data.cashierName) lines.push(`Caissier: ${data.cashierName}`);
  lines.push('-'.repeat(WIDTH));
  lines.push('Qte   Article          Prix');
  lines.push('-'.repeat(WIDTH));

  for (const item of data.items) {
    const name = (item.name || item.nameAr || '').substring(0, 16);
    const qty = `${item.quantity}`;
    const lineTotal = euros(item.price * item.quantity);
    lines.push(`${qty.padEnd(4)}   ${name.padEnd(14)} ${lineTotal.padStart(8)}`);
    if (item.modifiers?.length) {
      for (const mod of item.modifiers) {
        lines.push(`       ${String(mod).substring(0, 20)}`);
      }
    }
  }

  lines.push('-'.repeat(WIDTH));
  const fmtAmount = (label: string, amountCents: number): string =>
    `${label.padEnd(20)} ${euros(amountCents).padStart(10)}`;
  lines.push(fmtAmount('Sous-total', data.subtotal));
  lines.push(fmtAmount('TVA', data.tax));
  if (data.serviceCharge > 0) lines.push(fmtAmount('Service', data.serviceCharge));
  if (data.discount > 0) lines.push(fmtAmount('Remise', data.discount));
  lines.push('='.repeat(WIDTH));
  lines.push(fmtAmount('TOTAL', data.total));
  lines.push('='.repeat(WIDTH));
  if (data.paymentMethod) lines.push(`Paiement: ${data.paymentMethod}`);
  if (data.paymentStatus === 'PAID') lines.push(padCenter('PAYE', WIDTH));
  lines.push('');
  if (data.footer) lines.push(padCenter(data.footer, WIDTH));
  lines.push(padCenter('Merci de votre commande', WIDTH));

  const text = lines.join(LF);
  const textBytes = new TextEncoder().encode(text);
  const ESC = 0x1b;
  const GS = 0x1d;
  const LF_BYTE = 0x0a;
  const commands: number[] = [
    ESC,
    0x40,
    ESC,
    0x61,
    0x01,
    ESC,
    0x21,
    0x30,
    ...textBytes.slice(0, 40),
    LF_BYTE,
    LF_BYTE,
    ESC,
    0x61,
    0x00,
    ESC,
    0x21,
    0x00,
    ...textBytes.slice(40),
    GS,
    0x56,
    0x00,
  ];
  return new Uint8Array(commands);
}

/** Ticket préparation cuisine (Epson / SUNMI) — compact, sans pied légal. */
export function generateKitchenTicketText(
  order: PrinterOrderInput,
  business: PrinterBusinessInput
): string {
  const W = TICKET_WIDTH;
  const branding = resolveTicketBranding(business);
  const time = new Date(order.createdAt).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const mode = TYPE_LABEL[order.type] ?? order.type;
  const origin = order.isOnlineOrder ? 'Web' : 'Comptoir';

  const lines: string[] = [
    ...buildTicketHeader(branding, { banner: 'CUISINE', mode: 'kitchen' }),
    `#${order.orderNumber} · ${mode} · ${time}`,
    `${origin}`,
  ];
  if (order.customerName) lines.push(`Client: ${order.customerName}`);
  if (order.customerPhone) lines.push(`Tel: ${order.customerPhone}`);
  if (order.type === 'DELIVERY' && order.deliveryAddress) {
    for (const part of wrapTicketLines(order.deliveryAddress, W)) {
      lines.push(`> ${part}`);
    }
  }
  if (order.notes) {
    for (const part of wrapTicketLines(`Note: ${order.notes}`, W)) {
      lines.push(part);
    }
  }
  lines.push('-'.repeat(W));
  for (const item of order.items) {
    lines.push(`${item.quantity}x ${orderItemDisplayName(item)}`);
    for (const mod of orderItemModifierLines(item)) {
      lines.push(`  + ${mod}`);
    }
    if (item.notes) lines.push(`  (${item.notes})`);
  }
  return lines.join('\n');
}

/** Étiquette sac / colis (traçabilité livraison ou emporter). */
export function generateBagLabelText(
  order: PrinterOrderInput,
  business: PrinterBusinessInput
): string {
  const W = TICKET_WIDTH;
  const branding = resolveTicketBranding(business);
  const dash = '-'.repeat(W);
  const lines: string[] = [
    ...buildTicketHeader(branding, { banner: 'LIVRAISON', mode: 'label' }),
    `#${order.orderNumber} · ${(TYPE_LABEL[order.type] ?? order.type).toUpperCase()}`,
    dash,
  ];

  if (order.customerName?.trim()) lines.push(order.customerName.trim());
  if (order.customerPhone?.trim()) lines.push(order.customerPhone.trim());

  if (order.type === 'DELIVERY') {
    const addrLines = formatDeliveryAddress(order);
    if (addrLines.length) {
      lines.push(...addrLines);
    } else {
      lines.push('(adresse non renseignée)');
    }
  } else if (order.type === 'TAKEAWAY') {
    lines.push('À emporter — comptoir');
  } else if (order.table?.number != null) {
    lines.push(`Table ${order.table.number}`);
  }

  lines.push(dash);
  for (const item of order.items ?? []) {
    lines.push(`${item.quantity}x ${orderItemDisplayName(item)}`);
  }

  if (order.notes?.trim()) {
    lines.push(...wrapTicketLines(`Note: ${order.notes.trim()}`, W));
  }

  lines.push(dash, padCenter('Coller sur le sac', W));
  return lines.join('\n');
}

export type PrintTicketType = 'KITCHEN' | 'BAG_LABEL' | 'RECEIPT';

function trackingUrl(token: string | null | undefined, baseUrl?: string): string | null {
  if (!token) return null;
  const base = (baseUrl ?? process.env.PUBLIC_SITE_URL ?? 'https://pizzeria.fr').replace(/\/$/, '');
  return `${base}/suivi/${token}`;
}

export type ReceiptPrintOptions = {
  reprintBanner?: string;
  fiscalSerial?: number;
  fiscalHashPreview?: string;
  fiscalKind?: string;
  publicSiteUrl?: string;
};

/** Reçu client texte 58 mm (SIRET, TVA, QR suivi). */
export function generateReceiptText(
  order: PrinterOrderInput,
  business: PrinterBusinessInput,
  options?: ReceiptPrintOptions
): string {
  const W = TICKET_WIDTH;
  const data = generateReceiptData(order, business);
  const branding = resolveTicketBranding(business);
  const trackUrl = trackingUrl(order.trackingToken, options?.publicSiteUrl);

  const lines: string[] = [...buildTicketHeader(branding)];
  if (options?.reprintBanner) {
    lines.push(padCenter(options.reprintBanner, W));
    lines.push('='.repeat(W));
  }
  lines.push(`Commande #${data.orderNumber}`, `Date: ${data.date}`);
  if (data.customerName) lines.push(`Client: ${data.customerName}`);
  if (data.cashierName) lines.push(`Caissier: ${data.cashierName}`);
  lines.push('-'.repeat(W));

  for (const item of data.items) {
    const name = (item.name || '').substring(0, 16);
    lines.push(`${item.quantity}x ${name} ${euros(item.price * item.quantity).padStart(7)}`);
    if (item.modifiers?.length) {
      for (const mod of item.modifiers) lines.push(`   ${String(mod).substring(0, 24)}`);
    }
  }

  lines.push('-'.repeat(W));
  const fmt = (label: string, cents: number): string =>
    `${label.padEnd(20)} ${euros(cents).padStart(10)}`;
  lines.push(fmt('Sous-total HT', data.subtotal));
  lines.push(fmt('TVA', data.tax));
  if (data.discount > 0) lines.push(fmt('Remise', -data.discount));
  lines.push('='.repeat(W));
  lines.push(fmt('TOTAL TTC', data.total));
  lines.push('='.repeat(W));
  if (data.paymentMethod) {
    const pm =
      data.paymentMethod === 'CASH'
        ? 'Espèces'
        : data.paymentMethod === 'CARD'
          ? 'Carte'
          : data.paymentMethod;
    lines.push(`Paiement: ${pm}`);
  }
  if (data.paymentStatus === 'PAID') {
    lines.push(padCenter('PAYÉ', W));
    if (options?.fiscalSerial != null) {
      lines.push('');
      const training = options.fiscalKind === 'TRAINING' ? ' (FORMATION)' : '';
      lines.push(`Ticket fiscal n°${options.fiscalSerial}${training}`);
      if (options.fiscalHashPreview) {
        lines.push(`Intégrité: ${options.fiscalHashPreview}`);
      }
    }
  }
  lines.push('');
  if (trackUrl) {
    lines.push('');
    lines.push(padCenter('Suivi commande', W));
    lines.push(padCenter('Scannez ou ouvrez :', W));
    for (const l of wrapTicketLines(trackUrl, W)) lines.push(l);
  }
  lines.push(...buildTicketFooter(branding, { thankYou: 'Merci de votre visite !' }));
  return lines.join('\n');
}

export function generatePrintText(
  order: PrinterOrderInput,
  business: PrinterBusinessInput,
  type: PrintTicketType,
  options?: { receipt?: ReceiptPrintOptions }
): string {
  if (type === 'BAG_LABEL') return generateBagLabelText(order, business);
  if (type === 'RECEIPT') return generateReceiptText(order, business, options?.receipt);
  return generateKitchenTicketText(order, business);
}
