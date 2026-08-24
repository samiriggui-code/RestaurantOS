import type { PrismaClient } from '@prisma/client';
import { closeFiscalDay } from './closure';
import { fiscalDayKey, parisHour, parisParts } from './timezone';
import { getFiscalClosureStatus } from './closure-status';

let schedulerStarted = false;

/** Clôture Z automatique à 23:55 Europe/Paris si non effectuée. */
export function startFiscalScheduler(prisma: PrismaClient): void {
  if (schedulerStarted || process.env.FISCAL_AUTO_Z_CLOSURE === 'false') return;
  schedulerStarted = true;

  const tick = async (): Promise<void> => {
    try {
      const now = new Date();
      const { h: hour, mi: minute } = {
        h: parisHour(now),
        mi: parisParts(now.getTime()).mi,
      };
      if (hour !== 23 || minute < 55) return;

      const businesses = await prisma.business.findMany({ select: { id: true } });
      for (const biz of businesses) {
        const status = await getFiscalClosureStatus(prisma, biz.id);
        if (status.closed) continue;
        await closeFiscalDay(prisma, biz.id, null, {
          dayKey: fiscalDayKey(now),
          skipPreclose: process.env.FISCAL_AUTO_SKIP_PRECLOSE === 'true',
        });
        console.log(`[fiscal] Clôture Z auto — ${biz.id} — ${fiscalDayKey(now)}`);
      }
    } catch (err) {
      console.error('[fiscal] scheduler error:', err);
    }
  };

  setInterval(() => void tick(), 60_000);
  void tick();
}
