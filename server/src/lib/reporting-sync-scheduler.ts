import type { PrismaClient } from '@prisma/client';
import { isSumupConfigured } from './sumup-config';
import { syncSumupTransactions } from './sumup-transaction-sync';
import { syncPennylaneSupplierInvoices } from './pennylane/pennylane-expense-sync';
import { PennylaneNotConfiguredError } from './pennylane/pennylane-sync';

const DEFAULT_INTERVAL_MIN = 15;

let schedulerStarted = false;

/**
 * Synchro périodique des sources du dashboard ventes/dépenses (SumUp + Pennylane).
 * Sans elle, le CA comptoir et les dépenses restent vides tant que personne ne clique
 * « Synchroniser » dans l'admin. Idempotent côté sync ; chaque source échoue isolément.
 * Désactivable : REPORTING_AUTO_SYNC=false. Période : REPORTING_SYNC_INTERVAL_MIN.
 */
export function startReportingSyncScheduler(prisma: PrismaClient): void {
  if (schedulerStarted || process.env.REPORTING_AUTO_SYNC === 'false') return;
  schedulerStarted = true;

  const intervalMin = Number(process.env.REPORTING_SYNC_INTERVAL_MIN) || DEFAULT_INTERVAL_MIN;
  let running = false;

  const tick = async (): Promise<void> => {
    if (running) return;
    running = true;
    try {
      const businesses = await prisma.business.findMany({ select: { id: true } });
      for (const biz of businesses) {
        if (isSumupConfigured()) {
          try {
            await syncSumupTransactions(prisma, biz.id);
          } catch (err) {
            console.error(`[reporting-sync] SumUp ${biz.id}:`, err);
          }
        }
        try {
          await syncPennylaneSupplierInvoices(prisma, biz.id);
        } catch (err) {
          if (!(err instanceof PennylaneNotConfiguredError)) {
            console.error(`[reporting-sync] Pennylane ${biz.id}:`, err);
          }
        }
      }
    } catch (err) {
      console.error('[reporting-sync] scheduler error:', err);
    } finally {
      running = false;
    }
  };

  setInterval(() => void tick(), intervalMin * 60_000).unref();
  setTimeout(() => void tick(), 30_000).unref();
}
