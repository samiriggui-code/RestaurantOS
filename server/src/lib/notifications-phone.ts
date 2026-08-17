/** Normalisation téléphone FR → E.164 (partagé SMS / WhatsApp). */

export function normalizePhoneE164(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('0') && digits.length === 10) return `+33${digits.slice(1)}`
  if (digits.startsWith('33')) return `+${digits}`
  if (phone.startsWith('+')) return phone
  return `+${digits}`
}
