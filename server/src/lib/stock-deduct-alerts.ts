import type { PrismaClient } from '@prisma/client'
import { deductStockForOrderStandalone } from './order-stock'
import { checkStockAlertsAfterMovement } from './stock-alerts'

/** Déduction stock + alertes email admin si seuil atteint. */
export async function deductStockWithAlerts(
  prisma: PrismaClient,
  businessId: string,
  orderId: string,
  items: { menuItemId: string; quantity: number }[]
) {
  const touched = await deductStockForOrderStandalone(prisma, businessId, orderId, items)
  if (touched.length) {
    await checkStockAlertsAfterMovement(prisma, businessId, touched)
  }
  return touched
}
