'use client'

import { useEffect, useState } from 'react'
import { useFeedbackState } from '@/lib/use-feedback-state'
import { Loader2, Printer, RefreshCw } from 'lucide-react'
import { getStaffSession } from '@/lib/staff-auth'
import { staffFetch } from '@/lib/staff-api'

type PrintJobRow = {
  id: string
  type: string
  status: string
  error?: string | null
  createdAt: string
  printedAt?: string | null
  order?: { orderNumber: number; status: string } | null
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'En attente',
  PRINTED: 'Imprimé',
  FAILED: 'Échec',
}

export function AdminPrintJobsPanel() {
  const [jobs, setJobs] = useState<PrintJobRow[]>([])
  const [loading, setLoading] = useState(true)
  const { error, setError } = useFeedbackState()

  async function load() {
    const session = getStaffSession()
    if (!session) return
    setLoading(true)
    try {
      const data = await staffFetch<PrintJobRow[]>('/print-jobs?limit=30', { token: session.token })
      setJobs(data)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chargement impossible')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  return (
    <section className="rounded-2xl border border-white/10 bg-[#1A1412] p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-semibold text-cream">
            <Printer className="h-4 w-4 text-tomato-light" />
            File d&apos;impression
          </h2>
          <p className="mt-1 text-xs text-cream/45">30 derniers tickets — traçabilité SUNMI / navigateur</p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-1 rounded-lg border border-white/15 px-3 py-1.5 text-xs text-cream/70 hover:bg-white/5"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Actualiser
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-tomato-light" />
        </div>
      ) : error ? (
        <p className="text-sm text-red-300">{error}</p>
      ) : jobs.length === 0 ? (
        <p className="text-sm text-cream/45">Aucune impression enregistrée.</p>
      ) : (
        <ul className="divide-y divide-white/10 text-sm">
          {jobs.map((job) => (
            <li key={job.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <div>
                <span className="font-medium text-cream">
                  {job.type}
                  {job.order ? ` · #${job.order.orderNumber}` : ''}
                </span>
                <p className="text-xs text-cream/40">
                  {new Date(job.createdAt).toLocaleString('fr-FR')}
                  {job.error ? ` — ${job.error}` : ''}
                </p>
              </div>
              <span
                className={
                  job.status === 'PRINTED'
                    ? 'rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-300'
                    : job.status === 'FAILED'
                      ? 'rounded-full bg-red-500/15 px-2 py-0.5 text-xs text-red-300'
                      : 'rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-200'
                }
              >
                {STATUS_LABEL[job.status] ?? job.status}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
