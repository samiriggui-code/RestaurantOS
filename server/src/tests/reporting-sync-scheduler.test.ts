import type { startReportingSyncScheduler as StartFn } from '../lib/reporting-sync-scheduler';

jest.mock('../lib/sumup-config');
jest.mock('../lib/sumup-transaction-sync');
jest.mock('../lib/pennylane/pennylane-expense-sync');

const prisma = { business: { findMany: jest.fn() } };

/** Laisse le premier tick (30 s) s'exécuter et vider ses promesses. */
async function runFirstTick(): Promise<void> {
  await jest.advanceTimersByTimeAsync(30_000);
}

describe('reporting-sync-scheduler', () => {
  let errorSpy: jest.SpyInstance;
  let sumupConfig: { isSumupConfigured: jest.Mock };
  let sumupSync: { syncSumupTransactions: jest.Mock };
  let pennylaneSync: { syncPennylaneSupplierInvoices: jest.Mock };
  let PennylaneNotConfiguredError: new () => Error;
  let startScheduler: typeof StartFn;

  beforeEach(() => {
    // Le scheduler est un singleton (schedulerStarted) : on recharge tout le graphe à neuf,
    // mocks et classes d'erreur compris, pour que `instanceof` reste cohérent.
    jest.resetModules();
    /* eslint-disable @typescript-eslint/no-var-requires */
    sumupConfig = require('../lib/sumup-config');
    sumupSync = require('../lib/sumup-transaction-sync');
    pennylaneSync = require('../lib/pennylane/pennylane-expense-sync');
    PennylaneNotConfiguredError =
      require('../lib/pennylane/pennylane-sync').PennylaneNotConfiguredError;
    startScheduler = require('../lib/reporting-sync-scheduler').startReportingSyncScheduler;
    /* eslint-enable @typescript-eslint/no-var-requires */

    jest.clearAllMocks();
    jest.useFakeTimers();
    delete process.env.REPORTING_AUTO_SYNC;
    prisma.business.findMany.mockResolvedValue([{ id: 'b1' }, { id: 'b2' }]);
    sumupConfig.isSumupConfigured.mockReturnValue(true);
    sumupSync.syncSumupTransactions.mockResolvedValue({});
    pennylaneSync.syncPennylaneSupplierInvoices.mockResolvedValue({});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
    errorSpy.mockRestore();
  });

  function start(): void {
    startScheduler(prisma as never);
  }

  it('synchronise SumUp et Pennylane pour chaque business au premier tick', async () => {
    start();
    await runFirstTick();

    expect(sumupSync.syncSumupTransactions).toHaveBeenCalledTimes(2);
    expect(pennylaneSync.syncPennylaneSupplierInvoices).toHaveBeenCalledTimes(2);
    expect(sumupSync.syncSumupTransactions).toHaveBeenCalledWith(prisma, 'b1');
    expect(pennylaneSync.syncPennylaneSupplierInvoices).toHaveBeenCalledWith(prisma, 'b2');
  });

  it('ne fait rien si REPORTING_AUTO_SYNC=false', async () => {
    process.env.REPORTING_AUTO_SYNC = 'false';
    start();
    await runFirstTick();

    expect(prisma.business.findMany).not.toHaveBeenCalled();
  });

  it('saute SumUp quand il n’est pas configuré mais synchronise Pennylane', async () => {
    sumupConfig.isSumupConfigured.mockReturnValue(false);
    start();
    await runFirstTick();

    expect(sumupSync.syncSumupTransactions).not.toHaveBeenCalled();
    expect(pennylaneSync.syncPennylaneSupplierInvoices).toHaveBeenCalledTimes(2);
  });

  it('ignore silencieusement Pennylane non configuré', async () => {
    pennylaneSync.syncPennylaneSupplierInvoices.mockRejectedValue(
      new PennylaneNotConfiguredError()
    );
    start();
    await runFirstTick();

    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('isole les échecs : SumUp en erreur n’empêche pas Pennylane ni le business suivant', async () => {
    sumupSync.syncSumupTransactions.mockRejectedValue(new Error('boom'));
    start();
    await runFirstTick();

    expect(pennylaneSync.syncPennylaneSupplierInvoices).toHaveBeenCalledTimes(2);
    expect(errorSpy).toHaveBeenCalledTimes(2);
  });

  it('rejoue à l’intervalle configuré (15 min par défaut)', async () => {
    start();
    await runFirstTick();
    await jest.advanceTimersByTimeAsync(15 * 60_000);

    expect(sumupSync.syncSumupTransactions).toHaveBeenCalledTimes(4);
  });
});
