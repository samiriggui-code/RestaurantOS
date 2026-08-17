export type OrderEmailPayload = {
  to: string
  orderNumber: number | string
  trackingToken?: string
  trackingUrl?: string
  customerName?: string
  emailTitle?: string
  preview?: string
  statusUpdate?: boolean
  statusLine?: string
  deliveryHandoverCode?: string
  subject?: string
}

/**
 * @deprecated Préférer sendOrderConfirmationEmailV2 (React Email + journal EmailLog).
 */
export async function sendOrderConfirmationEmail(payload: OrderEmailPayload): Promise<boolean> {
  const { sendOrderConfirmationEmailV2 } = await import('./mail-service')
  const { prisma } = await import('./prisma')
  return sendOrderConfirmationEmailV2(prisma, '', payload)
}
