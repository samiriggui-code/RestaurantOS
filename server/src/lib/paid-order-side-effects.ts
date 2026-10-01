import type { PrismaClient } from '@prisma/client';
import { deductStockWithAlerts } from './stock-deduct-alerts';
import { ensureInvoiceForPaidOrder } from './invoice-from-order';
import { ensureLoyaltyCreditForPaidOrder } from './loyalty-order';

type SideEffectOpts = {
  businessId: string;
  orderId: string;
  /** Lignes pour déduction stock (omit / vide = pas de déduction). */
  stockItems?: { menuItemId: string; quantity: number }[];
  userId?: string;
  /** Facture auto (défaut true). */
  invoice?: boolean;
  /** Crédit fidélité (défaut true ; échec loggé, non bloquant). */
  loyalty?: boolean;
};

/**
 * Effets métier après paiement / confirmation — **await** (pas fire-and-forget).
 * Stock + facture : erreurs remontées. Fidélité : best-effort (log).
 */
export async function runPaidOrderSideEffects(
  prisma: PrismaClient,
  opts: SideEffectOpts
): Promise<void> {
  const { businessId, orderId, stockItems, userId, invoice = true, loyalty = true } = opts;

  if (stockItems && stockItems.length > 0) {
    await deductStockWithAlerts(prisma, businessId, orderId, stockItems);
  }

  if (invoice) {
    await ensureInvoiceForPaidOrder(prisma, businessId, orderId, userId);
  }

  if (loyalty) {
    try {
      await ensureLoyaltyCreditForPaidOrder(prisma, businessId, orderId);
    } catch (err) {
      console.error('[loyalty] credit failed for order', orderId, err);
    }
  }
}
