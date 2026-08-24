import type { PrismaClient } from '@prisma/client';
import { sendStockAlertEmail } from './mail-service';
import type { StockAlertItem } from '../emails/stock-alert';

const alertCooldownMs = 6 * 60 * 60 * 1000; // 6 h entre deux mails pour le même article

function stockLevel(quantity: number, reorderAt: number | null): 'ok' | 'low' | 'critical' | null {
  if (reorderAt == null) return null;
  if (quantity <= reorderAt * 0.5) return 'critical';
  if (quantity <= reorderAt) return 'low';
  return 'ok';
}

/** Vérifie les seuils et envoie un email admin si nécessaire (avec anti-spam). */
export async function checkStockAlertsAfterMovement(
  prisma: PrismaClient,
  businessId: string,
  stockItemIds: string[]
): Promise<void> {
  if (!stockItemIds.length) return;

  const items = await prisma.stockItem.findMany({
    where: { id: { in: stockItemIds }, businessId, isActive: true },
  });

  const alerts: StockAlertItem[] = [];
  for (const item of items) {
    const level = stockLevel(item.quantity, item.reorderAt);
    if (!level || level === 'ok') continue;

    const since = new Date(Date.now() - alertCooldownMs);
    const recent = await prisma.emailLog.findFirst({
      where: {
        businessId,
        template: 'stock-alert',
        status: 'SENT',
        createdAt: { gte: since },
        subject: `stock-item:${item.id}`,
      },
    });
    if (recent) continue;

    alerts.push({
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      reorderAt: item.reorderAt,
      level,
    });
  }

  if (!alerts.length) return;

  await sendStockAlertEmail(prisma, businessId, alerts);

  for (const alert of alerts) {
    const item = items.find(i => i.name === alert.name);
    if (!item) continue;
    await prisma.emailLog.create({
      data: {
        businessId,
        template: 'stock-alert',
        toAddress: 'admin-batch',
        subject: `stock-item:${item.id}`,
        status: 'SENT',
        metadata: { stockItemId: item.id, level: alert.level },
      },
    });
  }
}
