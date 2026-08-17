import type { PrismaClient } from '@prisma/client'
import { InvoiceDocument } from '../emails/invoice-document'
import { businessDocumentContext } from './business-document-context'
import { renderPrintDocument } from './document-render'
import { decodeStoredText } from './decode-stored-text'

type InvoiceWithLines = {
  invoiceNumber: number
  status: string
  issueDate: Date
  dueDate: Date | null
  clientName: string
  clientEmail: string | null
  clientPhone: string | null
  clientSiret: string | null
  clientVatNumber: string | null
  clientAddress: string | null
  subtotalCents: number
  taxCents: number
  totalCents: number
  notes: string | null
  lines: Array<{
    description: string
    quantity: number
    unitPriceCents: number
    taxRate: number
  }>
  order?: { orderNumber: number } | null
}

export async function renderInvoiceDocumentHtml(
  prisma: PrismaClient,
  businessId: string,
  invoice: InvoiceWithLines,
): Promise<string> {
  const biz = await businessDocumentContext(prisma, businessId)

  return renderPrintDocument(
    InvoiceDocument({
      ...biz,
      invoiceNumber: invoice.invoiceNumber,
      status: invoice.status,
      issueDate: invoice.issueDate.toLocaleDateString('fr-FR'),
      dueDate: invoice.dueDate?.toLocaleDateString('fr-FR') ?? null,
      clientName: decodeStoredText(invoice.clientName) ?? invoice.clientName,
      clientEmail: invoice.clientEmail,
      clientPhone: invoice.clientPhone,
      clientSiret: invoice.clientSiret,
      clientVatNumber: invoice.clientVatNumber,
      clientAddress: invoice.clientAddress,
      orderNumber: invoice.order?.orderNumber ?? null,
      subtotalCents: invoice.subtotalCents,
      taxCents: invoice.taxCents,
      totalCents: invoice.totalCents,
      notes: decodeStoredText(invoice.notes),
      lines: invoice.lines.map((l) => ({
        ...l,
        description: decodeStoredText(l.description) ?? l.description,
      })),
    }),
  )
}
