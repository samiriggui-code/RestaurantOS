import type { PrismaClient, Invoice, InvoiceLine } from '@prisma/client';
import {
  createPennylaneCompanyCustomer,
  createPennylaneCustomerInvoice,
  createPennylaneIndividualCustomer,
  findPennylaneCustomerByExternalReference,
  findPennylaneInvoiceByExternalReference,
  isPennylaneConfigured,
} from './pennylane-client';
import { resolvePennylaneConfig, runWithPennylaneToken } from './pennylane-config';
import { parseFrenchAddressForPennylane, splitClientName } from './pennylane-address';
import { frVatRateCode } from './pennylane-vat';

type InvoiceWithLines = Invoice & { lines: InvoiceLine[] };

export class PennylaneNotConfiguredError extends Error {
  constructor() {
    super('Pennylane non configuré — colle le token API dans Admin → Intégrations → Pennylane');
    this.name = 'PennylaneNotConfiguredError';
  }
}

function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function customerExternalReference(invoice: InvoiceWithLines): string {
  const key = invoice.clientEmail?.trim().toLowerCase() || invoice.clientSiret?.trim();
  return key ? `ros-client-${key}` : `ros-invoice-${invoice.id}`;
}

async function resolveOrCreatePennylaneCustomer(
  prisma: PrismaClient,
  invoice: InvoiceWithLines
): Promise<number> {
  if (invoice.pennylaneCustomerId) return invoice.pennylaneCustomerId;

  const externalReference = customerExternalReference(invoice);
  const existing = await findPennylaneCustomerByExternalReference(externalReference);
  if (existing) return existing.id;

  const billingAddress = parseFrenchAddressForPennylane(invoice.clientAddress);
  const emails = invoice.clientEmail ? [invoice.clientEmail] : undefined;

  const customer = invoice.clientSiret
    ? await createPennylaneCompanyCustomer({
        name: invoice.clientName,
        billingAddress,
        vatNumber: invoice.clientVatNumber ?? undefined,
        regNo: invoice.clientSiret,
        emails,
        externalReference,
      })
    : await createPennylaneIndividualCustomer({
        ...splitClientName(invoice.clientName),
        billingAddress,
        emails,
        externalReference,
      });

  return customer.id;
}

function buildInvoiceLines(lines: InvoiceLine[]): {
  label: string;
  quantity: number;
  raw_currency_unit_price: string;
  vat_rate: string;
}[] {
  return lines
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(l => ({
      label: l.description,
      quantity: l.quantity,
      raw_currency_unit_price: (l.unitPriceCents / 100).toFixed(2),
      vat_rate: frVatRateCode(l.taxRate),
    }));
}

export type PennylaneSyncResult = { pennylaneInvoiceId: number; created: boolean };

/**
 * Pousse une facture RestaurantOS (déjà ISSUED) vers Pennylane comme facture client.
 * Idempotent. Brouillon par défaut (réglable dans Intégrations).
 */
export async function syncInvoiceToPennylane(
  prisma: PrismaClient,
  businessId: string,
  invoiceId: string
): Promise<PennylaneSyncResult> {
  const config = await resolvePennylaneConfig(prisma, businessId);
  if (!config.token || !isPennylaneConfigured(config.token)) {
    throw new PennylaneNotConfiguredError();
  }

  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, businessId },
    include: {
      lines: { orderBy: { sortOrder: 'asc' } },
      order: { select: { channel: true } },
    },
  });
  if (!invoice) throw new Error('Facture introuvable');
  if (invoice.status === 'DRAFT') {
    throw new Error(
      'Facture encore en brouillon côté RestaurantOS — finalise-la avant de synchroniser'
    );
  }
  if (invoice.lines.length === 0) {
    throw new Error('Facture sans lignes — rien à synchroniser');
  }
  if (invoice.order?.channel === 'DELIVEROO' || invoice.order?.channel === 'UBER_EATS') {
    throw new Error(
      'Vente Deliveroo/Uber Eats — déjà comptabilisée par le connecteur natif de la marketplace dans Pennylane, ne pas la pousser en double.'
    );
  }

  const externalReference = `ros-invoice-${invoice.id}`;
  const token = config.token;

  return runWithPennylaneToken(token, async () => {
    try {
      const existing = await findPennylaneInvoiceByExternalReference(externalReference);
      if (existing) {
        await prisma.invoice.update({
          where: { id: invoice.id },
          data: {
            pdpReference: String(existing.id),
            pennylaneSyncedAt: new Date(),
            pennylaneSyncError: null,
          },
        });
        return { pennylaneInvoiceId: existing.id, created: false };
      }

      const customerId = await resolveOrCreatePennylaneCustomer(prisma, invoice);

      const created = await createPennylaneCustomerInvoice({
        customerId,
        date: toDateOnly(invoice.issueDate),
        deadline: toDateOnly(invoice.dueDate ?? invoice.issueDate),
        externalReference,
        draft: config.invoiceDraft,
        lines: buildInvoiceLines(invoice.lines),
        label: `Facture ${invoice.invoiceNumber} — La Z Pizza`,
      });

      await prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          pennylaneCustomerId: customerId,
          pdpReference: String(created.id),
          pennylaneSyncedAt: new Date(),
          pennylaneSyncError: null,
        },
      });

      return { pennylaneInvoiceId: created.id, created: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur Pennylane inconnue';
      await prisma.invoice
        .update({ where: { id: invoice.id }, data: { pennylaneSyncError: message.slice(0, 1000) } })
        .catch(() => undefined);
      throw err;
    }
  });
}
