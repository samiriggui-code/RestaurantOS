/**
 * Client HTTP minimal pour l'API Pennylane v2 (self-intégration — token de société,
 * pas le flow OAuth2 réservé aux apps publiques du marketplace).
 * Doc : https://pennylane.readme.io/reference
 */

const PENNYLANE_BASE_URL = 'https://app.pennylane.com/api/external/v2';

export function isPennylaneConfigured(): boolean {
  return Boolean(process.env.PENNYLANE_API_TOKEN?.trim());
}

function pennylaneToken(): string {
  const token = process.env.PENNYLANE_API_TOKEN?.trim();
  if (!token) throw new Error('PENNYLANE_API_TOKEN manquant côté serveur');
  return token;
}

async function pennylaneFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${PENNYLANE_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${pennylaneToken()}`,
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Pennylane API ${res.status} ${path}: ${body.slice(0, 500)}`);
  }
  return res.json() as Promise<T>;
}

// ─── Clients ────────────────────────────────────────────────────────────────

export type PennylaneAddress = {
  address: string;
  postal_code: string;
  city: string;
  country_alpha2: string;
};

export type PennylaneCustomer = { id: number; external_reference?: string | null };

/** Recherche un client Pennylane par sa référence externe (posée par nous à la création). */
export async function findPennylaneCustomerByExternalReference(
  externalReference: string
): Promise<PennylaneCustomer | null> {
  const filter = encodeURIComponent(
    JSON.stringify([{ field: 'external_reference', operator: 'eq', value: externalReference }])
  );
  const res = await pennylaneFetch<{ items: PennylaneCustomer[] }>(`/customers?filter=${filter}`);
  return res.items[0] ?? null;
}

export type CreateCompanyCustomerInput = {
  name: string;
  billingAddress: PennylaneAddress;
  vatNumber?: string;
  regNo?: string;
  emails?: string[];
  externalReference: string;
};

export async function createPennylaneCompanyCustomer(
  input: CreateCompanyCustomerInput
): Promise<PennylaneCustomer> {
  return pennylaneFetch<PennylaneCustomer>('/company_customers', {
    method: 'POST',
    body: JSON.stringify({
      name: input.name,
      billing_address: input.billingAddress,
      vat_number: input.vatNumber,
      reg_no: input.regNo,
      emails: input.emails,
      external_reference: input.externalReference,
    }),
  });
}

export type CreateIndividualCustomerInput = {
  firstName: string;
  lastName: string;
  billingAddress: PennylaneAddress;
  emails?: string[];
  externalReference: string;
};

export async function createPennylaneIndividualCustomer(
  input: CreateIndividualCustomerInput
): Promise<PennylaneCustomer> {
  return pennylaneFetch<PennylaneCustomer>('/individual_customers', {
    method: 'POST',
    body: JSON.stringify({
      first_name: input.firstName,
      last_name: input.lastName,
      billing_address: input.billingAddress,
      emails: input.emails,
      external_reference: input.externalReference,
    }),
  });
}

// ─── Factures client ────────────────────────────────────────────────────────

export type PennylaneInvoiceLineInput = {
  label: string;
  quantity: number;
  raw_currency_unit_price: string;
  vat_rate: string;
  unit?: string;
};

export type CreatePennylaneInvoiceInput = {
  customerId: number;
  date: string; // YYYY-MM-DD
  deadline: string; // YYYY-MM-DD
  externalReference: string;
  draft: boolean;
  lines: PennylaneInvoiceLineInput[];
  currency?: string;
  label?: string;
};

export type PennylaneInvoice = { id: number; external_reference?: string | null };

export async function findPennylaneInvoiceByExternalReference(
  externalReference: string
): Promise<PennylaneInvoice | null> {
  const filter = encodeURIComponent(
    JSON.stringify([{ field: 'external_reference', operator: 'eq', value: externalReference }])
  );
  const res = await pennylaneFetch<{ items: PennylaneInvoice[] }>(
    `/customer_invoices?filter=${filter}`
  );
  return res.items[0] ?? null;
}

export async function createPennylaneCustomerInvoice(
  input: CreatePennylaneInvoiceInput
): Promise<PennylaneInvoice> {
  return pennylaneFetch<PennylaneInvoice>('/customer_invoices', {
    method: 'POST',
    body: JSON.stringify({
      customer_id: input.customerId,
      date: input.date,
      deadline: input.deadline,
      external_reference: input.externalReference,
      draft: input.draft,
      currency: input.currency ?? 'EUR',
      label: input.label,
      invoice_lines: input.lines,
    }),
  });
}
