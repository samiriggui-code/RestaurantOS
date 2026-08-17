'use client'

import { useCallback, useEffect, useState } from 'react'
import { useFeedbackState } from '@/lib/use-feedback-state'
import { Clock, Loader2, LogOut } from 'lucide-react'
import { getStaffSession } from '@/lib/staff-auth'
import { staffFetch } from '@/lib/staff-api'
import { roleLabel } from '@/lib/staff-display'

type OpenAttendance = {
  id: string
  userId: string
  date: string
  clockIn: string
  user: { id: string; name: string; role: string }
  minutesWorkedLabel?: string
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function formatClock(iso: string) {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function formatDay(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

export function AdminAttendancePanel() {
  const [records, setRecords] = useState<OpenAttendance[]>([])
  const [loading, setLoading] = useState(true)
  const [closingId, setClosingId] = useState<string | null>(null)
  const [times, setTimes] = useState<Record<string, string>>({})
  const { error, setError, message, setMessage } = useFeedbackState()

  const load = useCallback(async () => {
    const session = getStaffSession('crm')
    if (!session) return
    setLoading(true)
    setError(null)
    try {
      const to = new Date().toISOString().slice(0, 10)
      const from = addDays(to, -14)
      const rows = await staffFetch<
        Array<{
          id: string
          userId: string
          date: string
          clockIn: string
          clockOut: string | null
          user: { id: string; name: string; role: string }
        }>
      >(`/employees/attendance?from=${from}&to=${to}`, { token: session.token })
      setRecords(
        rows
          .filter((r) => r.clockIn && !r.clockOut)
          .map((r) => ({
            id: r.id,
            userId: r.userId,
            date: r.date,
            clockIn: r.clockIn,
            user: r.user,
          })),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chargement impossible')
    } finally {
      setLoading(false)
    }
  }, [setError])

  useEffect(() => {
    void load()
  }, [load])

  async function closeRecord(record: OpenAttendance) {
    const session = getStaffSession('crm')
    if (!session) return
    const clockOutTime = times[record.id]?.trim()
    if (!clockOutTime) {
      setError('Saisissez l\'heure de fin (HH:mm)')
      return
    }
    setClosingId(record.id)
    setError(null)
    setMessage(null)
    try {
      await staffFetch('/employees/attendance/manual-close', {
        method: 'POST',
        token: session.token,
        body: JSON.stringify({
          attendanceId: record.id,
          clockOutTime,
        }),
      })
      setMessage(`Sortie enregistrée pour ${record.user.name} (${formatDay(record.date)})`)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Correction impossible')
    } finally {
      setClosingId(null)
    }
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="mb-4 flex items-start gap-3">
        <Clock className="mt-0.5 h-5 w-5 text-amber-300" />
        <div>
          <h2 className="font-semibold text-cream">Pointages — sorties oubliées</h2>
          <p className="mt-1 text-sm text-cream/50">
            Clôture manuelle quand un employé a oublié de pointer sa sortie (ex. service de la veille).
          </p>
        </div>
      </div>

      {error && (
        <p className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      )}
      {message && (
        <p className="mb-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
          {message}
        </p>
      )}

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-cream/40" />
        </div>
      ) : records.length === 0 ? (
        <p className="text-sm text-cream/45">Aucune entrée sans sortie sur les 14 derniers jours.</p>
      ) : (
        <ul className="space-y-3">
          {records.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-end gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4"
            >
              <div className="min-w-[160px] flex-1">
                <p className="font-medium text-cream">{r.user.name}</p>
                <p className="text-xs text-cream/50">
                  {roleLabel(r.user.role)} · {formatDay(r.date)}
                </p>
                <p className="mt-1 text-xs text-cream/60">
                  Entrée {formatClock(r.clockIn)}
                </p>
              </div>
              <label className="block text-xs text-cream/55">
                Heure de fin
                <input
                  type="time"
                  value={times[r.id] ?? ''}
                  onChange={(e) => setTimes((prev) => ({ ...prev, [r.id]: e.target.value }))}
                  className="mt-1 block rounded-lg border border-white/15 bg-charcoal px-3 py-2 text-sm text-cream"
                />
              </label>
              <button
                type="button"
                disabled={closingId === r.id}
                onClick={() => void closeRecord(r)}
                className="inline-flex min-h-[42px] items-center gap-2 rounded-xl bg-amber-600 px-4 py-2 text-sm font-bold text-charcoal hover:bg-amber-500 disabled:opacity-50"
              >
                {closingId === r.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <LogOut className="h-4 w-4" />
                )}
                Clôturer
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
