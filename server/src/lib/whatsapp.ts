/**
 * WhatsApp — Twilio ou Meta Cloud API.
 * Réutilise les libellés SMS (STATUS_SMS_LABEL).
 */

import { normalizePhoneE164 } from './notifications-phone'

export type WhatsAppPayload = {
  phone: string
  body: string
}

function whatsappProvider(): string {
  const explicit = (process.env.WHATSAPP_PROVIDER || '').toLowerCase()
  if (explicit) return explicit
  if ((process.env.SMS_PROVIDER || '').toLowerCase() === 'twilio_whatsapp') return 'twilio'
  return ''
}

function phoneDigitsE164(phone: string): string {
  return normalizePhoneE164(phone).replace(/^\+/, '')
}

async function sendViaTwilioWhatsApp(to: string, body: string): Promise<boolean> {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_WHATSAPP_FROM
  if (!sid || !token || !from) return false

  const params = new URLSearchParams({
    To: `whatsapp:${normalizePhoneE164(to)}`,
    From: from.startsWith('whatsapp:') ? from : `whatsapp:${from}`,
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
    console.error('[whatsapp:twilio]', await res.text())
    return false
  }
  return true
}

async function sendViaMetaWhatsApp(to: string, body: string): Promise<boolean> {
  const accessToken = process.env.WHATSAPP_META_TOKEN
  const phoneNumberId = process.env.WHATSAPP_META_PHONE_ID
  if (!accessToken || !phoneNumberId) return false

  const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: phoneDigitsE164(to),
      type: 'text',
      text: { body },
    }),
  })

  if (!res.ok) {
    console.error('[whatsapp:meta]', await res.text())
    return false
  }
  return true
}

export async function sendWhatsAppMessage(payload: WhatsAppPayload): Promise<boolean> {
  const provider = whatsappProvider()
  if (!provider) {
    console.info(`[whatsapp:stub] ${payload.phone} — ${payload.body}`)
    return false
  }

  if (provider === 'twilio') {
    return sendViaTwilioWhatsApp(payload.phone, payload.body)
  }
  if (provider === 'meta') {
    return sendViaMetaWhatsApp(payload.phone, payload.body)
  }

  console.warn(`[whatsapp] provider inconnu: ${provider}`)
  return false
}

export function isWhatsAppEnabled(): boolean {
  return whatsappProvider().length > 0
}
