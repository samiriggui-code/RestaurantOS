/**
 * Notifications client — email + SMS (stub) à chaque étape livraison.
 */

import { prisma } from './prisma'
import { sendOrderConfirmationEmailV2 } from './mail-service'
import { normalizePhoneE164 } from './notifications-phone'
import { isWhatsAppEnabled, sendWhatsAppMessage } from './whatsapp'

export type OrderStatusNotification = {
  phone: string
  email?: string
  orderNumber: number | string
  status: string
  trackingToken?: string
  type?: string
  deliveryHandoverCode?: string
}

const STATUS_SMS_LABEL: Record<string, string> = {
  CONFIRMED: 'confirmée',
  PREPARING: 'en préparation',
  READY: 'prête',
  OUT_FOR_DELIVERY: 'en route vers vous',
  DELIVERED: 'livrée',
  DELIVERY_ISSUE: 'retour livreur — problème signalé',
  COMPLETED: 'terminée',
}

const STATUS_EMAIL: Record<
  string,
  { title: string; preview: string; showHandoverCode: boolean }
> = {
  CONFIRMED: {
    title: 'Commande confirmée',
    preview: 'Votre commande est confirmée',
    showHandoverCode: true,
  },
  READY: {
    title: 'Commande prête',
    preview: 'Votre commande est prête',
    showHandoverCode: true,
  },
  OUT_FOR_DELIVERY: {
    title: 'Livreur en route',
    preview: 'Votre commande est en route',
    showHandoverCode: true,
  },
  DELIVERED: {
    title: 'Commande livrée',
    preview: 'Votre commande a été livrée',
    showHandoverCode: false,
  },
}

function trackingUrl(token: string): string {
  const base =
    process.env.PUBLIC_SITE_URL ||
    process.env.PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'http://localhost:3000'
  return `${base.replace(/\/$/, '')}/suivi/${token}`
}

function driverUrl(token: string): string {
  const base =
    process.env.PUBLIC_SITE_URL ||
    process.env.PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'http://localhost:3000'
  return `${base.replace(/\/$/, '')}/livreur/${token}`
}

async function sendViaTwilio(to: string, body: string): Promise<boolean> {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_FROM_NUMBER
  if (!sid || !token || !from) return false

  const params = new URLSearchParams({
    To: normalizePhoneE164(to),
    From: from,
    Body: body,
  })

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  })

  if (!res.ok) {
    console.error('[sms:twilio]', await res.text())
    return false
  }
  return true
}

/** Corps SMS / WhatsApp pour un changement de statut commande. */
export function buildOrderStatusMessage(payload: OrderStatusNotification): string {
  const label = STATUS_SMS_LABEL[payload.status] ?? payload.status
  const pizzeria = process.env.SMS_SENDER_NAME || 'La Z Pizza'
  let body = `${pizzeria} — Commande #${payload.orderNumber} ${label}.`
  if (payload.trackingToken && ['OUT_FOR_DELIVERY', 'DELIVERED', 'READY'].includes(payload.status)) {
    body += ` Suivi : ${trackingUrl(payload.trackingToken)}`
  }
  if (
    payload.type === 'DELIVERY' &&
    payload.deliveryHandoverCode &&
    ['CONFIRMED', 'READY', 'OUT_FOR_DELIVERY'].includes(payload.status)
  ) {
    body += ` Code livraison : ${payload.deliveryHandoverCode} (à communiquer au livreur).`
  }
  return body
}

/** SMS — configure SMS_PROVIDER=twilio */
export async function sendOrderStatusSms(payload: OrderStatusNotification): Promise<boolean> {
  const body = buildOrderStatusMessage(payload)

  const provider = (process.env.SMS_PROVIDER || '').toLowerCase()
  if (provider === 'twilio') {
    return sendViaTwilio(payload.phone, body)
  }

  if (!process.env.SMS_PROVIDER || provider === 'twilio_whatsapp') {
    console.info(`[sms:stub] ${payload.phone} — ${body}`)
    return false
  }
  return false
}

/** WhatsApp — WHATSAPP_PROVIDER=twilio|meta ou SMS_PROVIDER=twilio_whatsapp */
export async function sendOrderStatusWhatsApp(payload: OrderStatusNotification): Promise<boolean> {
  if (!isWhatsAppEnabled()) return false
  return sendWhatsAppMessage({
    phone: payload.phone,
    body: buildOrderStatusMessage(payload),
  })
}

/** SMS + email optionnel selon le statut. */
export async function notifyOrderStatusChange(order: {
  businessId: string
  customerPhone?: string | null
  customerEmail?: string | null
  customerName?: string | null
  orderNumber: number
  status: string
  trackingToken?: string | null
  type?: string
  deliveryHandoverCode?: string | null
}): Promise<void> {
  const label = STATUS_SMS_LABEL[order.status] ?? order.status
  if (order.customerPhone?.trim()) {
    const payload = {
      phone: order.customerPhone,
      email: order.customerEmail ?? undefined,
      orderNumber: order.orderNumber,
      status: order.status,
      trackingToken: order.trackingToken ?? undefined,
      type: order.type,
      deliveryHandoverCode: order.deliveryHandoverCode ?? undefined,
    }
    await sendOrderStatusSms(payload)
    await sendOrderStatusWhatsApp(payload)
  }

  const emailMeta = STATUS_EMAIL[order.status]
  if (
    order.customerEmail &&
    order.trackingToken &&
    emailMeta &&
    ['CONFIRMED', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(order.status)
  ) {
    void sendOrderConfirmationEmailV2(prisma, order.businessId, {
      to: order.customerEmail,
      orderNumber: order.orderNumber,
      customerName: order.customerName ?? undefined,
      trackingToken: order.trackingToken,
      emailTitle: emailMeta.title,
      preview: emailMeta.preview,
      statusUpdate: order.status !== 'CONFIRMED',
      statusLine:
        order.status === 'CONFIRMED'
          ? undefined
          : `Votre commande est ${label}.`,
      deliveryHandoverCode:
        order.type === 'DELIVERY' && emailMeta.showHandoverCode
          ? order.deliveryHandoverCode ?? undefined
          : undefined,
    }).catch((err) => console.error('[notifications] email:', err))
  }
}

/** @deprecated use notifyOrderStatusChange */
export async function notifyOrderReady(order: {
  businessId: string
  customerPhone?: string | null
  customerEmail?: string | null
  customerName?: string | null
  orderNumber: number
  trackingToken?: string | null
  type?: string
  deliveryHandoverCode?: string | null
}): Promise<void> {
  await notifyOrderStatusChange({ ...order, status: 'READY' })
}

export { driverUrl }
