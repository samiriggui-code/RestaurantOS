import { render } from '@react-email/render'
import nodemailer from 'nodemailer'
import type { PrismaClient } from '@prisma/client'
import { OrderConfirmationEmail } from '../emails/order-confirmation'
import { FiscalReceiptEmail } from '../emails/fiscal-receipt-email'
import { InvoiceEmail } from '../emails/invoice-email'
import { StockAlertEmail, type StockAlertItem } from '../emails/stock-alert'
import { AdminNotificationEmail } from '../emails/admin-notification'

export type { StockAlertItem } from '../emails/stock-alert'
import { parseBusinessSettings } from './business-settings'
import { displayName } from './locale'
import { decodeStoredText } from './decode-stored-text'
import { resolveBrandLogoUrl, BRAND_LOGO_ON_PRIMARY_URI } from '../emails/brand-logo'
import { BRAND } from '../emails/brand'
import { businessDocumentContext } from './business-document-context'
import type { OrderEmailPayload } from './email'

function isEmailConfigured(): boolean {
  return Boolean(process.env.EMAIL_SERVER_HOST && process.env.EMAIL_FROM)
}

function createTransport() {
  const host = process.env.EMAIL_SERVER_HOST ?? '127.0.0.1'
  const port = Number(process.env.EMAIL_SERVER_PORT ?? 1025)
  const user = process.env.EMAIL_SERVER_USER
  const pass = process.env.EMAIL_SERVER_PASSWORD

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: user ? { user, pass: pass ?? '' } : undefined,
  })
}

async function logEmail(
  prisma: PrismaClient | null,
  entry: {
    businessId?: string
    template: string
    toAddress: string
    subject: string
    status: string
    error?: string
    metadata?: Record<string, unknown>
  }
) {
  if (!prisma) return
  try {
    await prisma.emailLog.create({
      data: {
        businessId: entry.businessId,
        template: entry.template,
        toAddress: entry.toAddress,
        subject: entry.subject,
        status: entry.status,
        error: entry.error,
        metadata: entry.metadata ? (entry.metadata as object) : undefined,
      },
    })
  } catch (err) {
    console.warn('[mail] log email failed', err)
  }
}

async function sendRendered(
  prisma: PrismaClient | null,
  opts: {
    businessId?: string
    template: string
    to: string
    subject: string
    html: string
    metadata?: Record<string, unknown>
  }
): Promise<boolean> {
  if (!opts.to?.trim()) return false
  if (!isEmailConfigured()) {
    console.warn('[mail] EMAIL_SERVER_HOST / EMAIL_FROM non configurés')
    await logEmail(prisma, {
      ...opts,
      toAddress: opts.to,
      status: 'SKIPPED',
      error: 'Email non configuré',
    })
    return false
  }

  try {
    await createTransport().sendMail({
      from: process.env.EMAIL_FROM!,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    })
    await logEmail(prisma, { ...opts, toAddress: opts.to, status: 'SENT' })
    return true
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[mail] échec envoi:', err)
    await logEmail(prisma, {
      ...opts,
      toAddress: opts.to,
      status: 'FAILED',
      error: message,
    })
    return false
  }
}

export async function getAdminNotificationEmails(
  prisma: PrismaClient,
  businessId: string
): Promise<string[]> {
  const business = await prisma.business.findUnique({ where: { id: businessId } })
  const settings = parseBusinessSettings(business?.settings)
  const fromSettings = settings.adminNotificationEmail?.split(',').map((s) => s.trim()).filter(Boolean) ?? []
  if (fromSettings.length) return fromSettings

  const fromEnv = process.env.ADMIN_NOTIFICATION_EMAIL?.split(',').map((s) => s.trim()).filter(Boolean) ?? []
  if (fromEnv.length) return fromEnv

  const admins = await prisma.user.findMany({
    where: { businessId, role: 'ADMIN', isActive: true },
    select: { email: true },
  })
  return admins.map((a) => a.email).filter(Boolean)
}

async function businessEmailContext(prisma: PrismaClient, businessId: string) {
  return businessDocumentContext(prisma, businessId)
}

/** Confirmation commande client — React Email */
export async function sendOrderConfirmationEmailV2(
  prisma: PrismaClient | null,
  businessId: string,
  payload: OrderEmailPayload
): Promise<boolean> {
  const biz =
    businessId && prisma
      ? await businessEmailContext(prisma, businessId)
      : await Promise.resolve({
          businessName: 'La Z Pizza' as string | undefined,
          logoUrl: BRAND_LOGO_ON_PRIMARY_URI,
        })
  const siteUrl = process.env.PUBLIC_SITE_URL ?? 'http://pizzeria.test'
  const trackingUrl =
    payload.trackingUrl ?? (payload.trackingToken ? `${siteUrl}/suivi/${payload.trackingToken}` : undefined)

  const emailTitle = payload.emailTitle ?? 'Commande confirmée'
  const html = await render(
    OrderConfirmationEmail({
      ...biz,
      customerName: payload.customerName,
      orderNumber: payload.orderNumber,
      trackingUrl,
      emailTitle,
      preview: payload.preview,
      statusUpdate: payload.statusUpdate,
      statusLine: payload.statusLine,
      deliveryHandoverCode: payload.deliveryHandoverCode,
    })
  )

  const subject =
    payload.subject ??
    `${biz.businessName ?? 'La Z Pizza'} — commande n° ${payload.orderNumber}`

  return sendRendered(prisma, {
    businessId: businessId || undefined,
    template: 'order-confirmation',
    to: payload.to,
    subject,
    html,
    metadata: { orderNumber: payload.orderNumber, emailTitle },
  })
}

/** Reçu fiscal client — commande en ligne payée par carte. */
export async function sendFiscalReceiptEmailV2(
  prisma: PrismaClient,
  businessId: string,
  payload: {
    to: string
    customerName?: string
    orderNumber: number
    fiscalSerialNumber: number
    fiscalRecordHash: string
    totalCents: number
    trackingToken?: string | null
  },
): Promise<boolean> {
  const biz = await businessEmailContext(prisma, businessId)
  const siteUrl = process.env.PUBLIC_SITE_URL ?? 'http://pizzeria.test'
  const trackingUrl = payload.trackingToken
    ? `${siteUrl}/suivi/${payload.trackingToken}`
    : undefined
  const hashPreview = payload.fiscalRecordHash.slice(0, 10).toUpperCase()

  const html = await render(
    FiscalReceiptEmail({
      ...biz,
      customerName: payload.customerName,
      orderNumber: payload.orderNumber,
      fiscalSerialNumber: payload.fiscalSerialNumber,
      fiscalHashPreview: hashPreview,
      totalCents: payload.totalCents,
      trackingUrl,
    }),
  )

  const subject = `${biz.businessName ?? 'La Z Pizza'} — reçu fiscal n° ${payload.fiscalSerialNumber}`

  return sendRendered(prisma, {
    businessId,
    template: 'fiscal-receipt',
    to: payload.to,
    subject,
    html,
    metadata: {
      orderNumber: payload.orderNumber,
      fiscalSerialNumber: payload.fiscalSerialNumber,
    },
  })
}

export async function sendInvoiceEmail(
  prisma: PrismaClient,
  businessId: string,
  to: string,
  data: {
    invoiceNumber: number
    clientName: string
    issueDate: string
    dueDate?: string
    lines: { description: string; quantity: number; unitPriceCents: number; taxRate?: number; lineTotalCents: number }[]
    subtotalCents: number
    taxCents: number
    totalCents: number
    notes?: string
  }
): Promise<boolean> {
  const biz = await businessEmailContext(prisma, businessId)
  const html = await render(
    InvoiceEmail({
      ...biz,
      ...data,
      clientName: decodeStoredText(data.clientName) ?? data.clientName,
      lines: data.lines.map((line) => ({
        ...line,
        description: decodeStoredText(line.description) ?? line.description,
      })),
      notes: decodeStoredText(data.notes),
    })
  )

  return sendRendered(prisma, {
    businessId,
    template: 'invoice',
    to,
    subject: `${biz.businessName ?? 'La Z Pizza'} — facture n° ${data.invoiceNumber}`,
    html,
    metadata: { invoiceNumber: data.invoiceNumber },
  })
}

export async function sendStockAlertEmail(
  prisma: PrismaClient,
  businessId: string,
  items: StockAlertItem[]
): Promise<boolean> {
  if (!items.length) return false
  const recipients = await getAdminNotificationEmails(prisma, businessId)
  if (!recipients.length) return false

  const biz = await businessEmailContext(prisma, businessId)
  const html = await render(StockAlertEmail({ ...biz, items }))

  let ok = false
  for (const to of recipients) {
    const sent = await sendRendered(prisma, {
      businessId,
      template: 'stock-alert',
      to,
      subject: `[Stock] ${items.length} alerte(s) — ${biz.businessName ?? 'La Z Pizza'}`,
      html,
      metadata: { count: items.length },
    })
    ok = ok || sent
  }
  return ok
}

export async function sendAdminNotificationEmail(
  prisma: PrismaClient,
  businessId: string,
  opts: { subject: string; body: string; severity?: 'info' | 'warning' | 'critical' }
): Promise<boolean> {
  const recipients = await getAdminNotificationEmails(prisma, businessId)
  if (!recipients.length) return false

  const biz = await businessEmailContext(prisma, businessId)
  const html = await render(
    AdminNotificationEmail({
      ...biz,
      subject: opts.subject,
      body: opts.body,
      severity: opts.severity,
    })
  )

  let ok = false
  for (const to of recipients) {
    const sent = await sendRendered(prisma, {
      businessId,
      template: 'admin-notification',
      to,
      subject: `[Admin] ${opts.subject}`,
      html,
      metadata: { severity: opts.severity },
    })
    ok = ok || sent
  }
  return ok
}
