/** @deprecated Import depuis `@/lib/print/print-job-handler` */
export {
  type PrintJobPayload,
  handlePosPrintJob as handleIncomingPrintJob,
  drainPosPrintJobs as drainPendingPrintJobs,
  updatePrintJobStatus,
} from '@/lib/print/print-job-handler'

export { isSunmiPrinterAvailable as isSunmiBridgeReady } from '@/lib/print/sunmi-printer'
export type { SunmiPrinterBridge } from '@/lib/print/sunmi-printer'
