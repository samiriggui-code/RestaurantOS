import type { PrintJobPayload } from '@/lib/print/print-job-handler'

/** Rattrapage après reconnexion socket — pas les vieux jobs bloqués en PENDING. */
export const PRINT_BACKLOG_MAX_AGE_MS = 2 * 60 * 1000

export type PrintJobWithTime = PrintJobPayload & { createdAt?: string }

export function filterRecentPrintBacklog(
  jobs: PrintJobWithTime[],
  maxAgeMs = PRINT_BACKLOG_MAX_AGE_MS,
  now = Date.now(),
): PrintJobWithTime[] {
  const cutoff = now - maxAgeMs
  return jobs.filter((job) => {
    if (!job.createdAt) return false
    const created = new Date(job.createdAt).getTime()
    return Number.isFinite(created) && created >= cutoff
  })
}
