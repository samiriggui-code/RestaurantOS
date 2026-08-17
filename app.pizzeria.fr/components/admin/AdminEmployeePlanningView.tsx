'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useFeedbackState } from '@/lib/use-feedback-state'
import Link from 'next/link'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Info,
  Copy,
  Loader2,
  Monitor,
  ShieldCheck,
  Sparkles,
  Wand2,
  XCircle,
} from 'lucide-react'
import { getStaffSession } from '@/lib/staff-auth'
import { staffFetch } from '@/lib/staff-api'
import { cn } from '@/lib/cn'
import {
  roleLabel,
  roleStyle,
  staffInitials,
} from '@/lib/staff-display'
import { isPolyvalentEmployee, planningPostsForEmployee } from '@/lib/planning-posts'
import { AdminAttendancePanel } from '@/components/admin/AdminAttendancePanel'

type Shift = { id: string; name: string; slug?: string | null; startTime: string; endTime: string }
type Employee = {
  id: string
  name: string
  role: string
  shiftId: string | null
  shift: Shift | null
  planningMeta?: unknown
}
type Entry = {
  id: string
  userId: string
  date: string
  shiftId: string | null
  startTime: string | null
  endTime: string | null
  roleLabel: string | null
  user: { id: string; name: string; role: string }
  shift: Shift | null
}

type GuardrailIssue = {
  id: string
  severity: 'critical' | 'warning' | 'info'
  date?: string
  message: string
  suggestion?: string
}

type ScheduleSuggestion = {
  id: string
  priority: 'high' | 'medium' | 'low'
  message: string
  action?: { userId: string; date: string; shiftId: string; roleLabel: string }
}

type ScheduleIntelligence = {
  score: number
  issues: GuardrailIssue[]
  suggestions: ScheduleSuggestion[]
  guardrails?: {
    maxDaysPerWeek: number
    maxConsecutiveDays: number
    minRestDaysPerWeek: number
  }
}

type ScheduleData = {
  from: string
  to: string
  entries: Entry[]
  employees: Employee[]
  shifts: Shift[]
  intelligence?: ScheduleIntelligence
}

type SmartPreview = {
  proposed: { userId: string; date: string; shiftId: string; roleLabel: string; reason: string }[]
  restDays: { userId: string; date: string; reason: string }[]
  score: number
  summary: string
  issues: GuardrailIssue[]
  suggestions: ScheduleSuggestion[]
  skippedExisting: number
}

const DOW = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

const GUARDRAIL_RULES = [
  { key: 'chef', label: '3 postes fixes — Cuisine 16h (1/jour, gérant peut remplacer)' },
  { key: 'front', label: 'Caisse 18h (1/jour, gérant peut remplacer)' },
  { key: 'driver', label: 'Livraison 18h — Lucas lun–ven · Amine sam–dim · 2 livreurs ven–dim' },
  { key: 'manager', label: 'Atmane remplace absents / repos (cuisine · caisse · livraison, lun–sam)' },
  { key: 'hours', label: 'Ouverture 18h–22h — 7j/7 (site client)' },
  { key: 'rest', label: 'Max 6 jours / semaine + 1 repos — remplacement déduit des heures absent' },
]

function weekStartMonday(d = new Date()) {
  const copy = new Date(d)
  const day = copy.getDay()
  const diff = day === 0 ? -6 : 1 - day
  copy.setDate(copy.getDate() + diff)
  return copy.toISOString().slice(0, 10)
}

function addDays(iso: string, n: number) {
  const d = new Date(iso)
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

function weekDates(from: string) {
  return Array.from({ length: 7 }, (_, i) => addDays(from, i))
}

function scoreColor(score: number) {
  if (score >= 85) return 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10'
  if (score >= 60) return 'text-amber-200 border-amber-500/40 bg-amber-500/10'
  return 'text-red-200 border-red-500/40 bg-red-500/10'
}

export function AdminEmployeePlanningView() {
  const [weekFrom, setWeekFrom] = useState(() => weekStartMonday())
  const [data, setData] = useState<ScheduleData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [filling, setFilling] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const { error, setError } = useFeedbackState()
  const [preview, setPreview] = useState<SmartPreview | null>(null)
  const [previewUserId, setPreviewUserId] = useState<string | undefined>()
  const [copying, setCopying] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)

  const dates = useMemo(() => weekDates(weekFrom), [weekFrom])
  const weekTo = addDays(weekFrom, 6)

  const load = useCallback(() => {
    const session = getStaffSession()
    if (!session) return
    setLoading(true)
    staffFetch<ScheduleData>(`/employees/schedule?from=${weekFrom}&to=${weekTo}`, {
      token: session.token,
    })
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Erreur'))
      .finally(() => setLoading(false))
  }, [weekFrom, weekTo])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 5000)
    return () => clearTimeout(t)
  }, [toast])

  function entryFor(userId: string, date: string) {
    return data?.entries.find((e) => e.userId === userId && e.date === date)
  }

  async function saveCell(userId: string, date: string, shiftId: string, roleLabel: string) {
    const session = getStaffSession()
    if (!session) return
    const key = `${userId}-${date}`
    setSaving(key)
    setError(null)
    try {
      await staffFetch('/employees/schedule', {
        method: 'PUT',
        token: session.token,
        body: JSON.stringify({ userId, date, shiftId: shiftId || null, roleLabel: roleLabel || null }),
      })
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setSaving(null)
    }
  }

  async function applySuggestion(action: ScheduleSuggestion['action']) {
    if (!action) return
    await saveCell(action.userId, action.date, action.shiftId, action.roleLabel)
    setToast(`Suggestion appliquée : ${action.roleLabel}`)
  }

  async function openSmartPreview(userId?: string) {
    const session = getStaffSession()
    if (!session) return
    setFilling(userId ?? 'preview')
    setError(null)
    try {
      const plan = await staffFetch<SmartPreview>('/employees/schedule/smart-preview', {
        method: 'POST',
        token: session.token,
        body: JSON.stringify({ from: weekFrom, to: weekTo, userId }),
      })
      setPreview(plan)
      setPreviewUserId(userId)
      setShowPreview(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setFilling(null)
    }
  }

  async function copyWeek(weekCount: number) {
    const session = getStaffSession()
    if (!session) return
    setCopying(weekCount === 4 ? 'month' : 'next')
    setError(null)
    try {
      const targetFrom = addDays(weekFrom, 7)
      const result = await staffFetch<{ created: number; skipped: number; message: string }>(
        '/employees/schedule/copy-week',
        {
          method: 'POST',
          token: session.token,
          body: JSON.stringify({ sourceFrom: weekFrom, targetFrom, weekCount }),
        }
      )
      setToast(result.message)
      if (weekCount === 1) setWeekFrom(targetFrom)
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setCopying(null)
    }
  }

  async function confirmSmartFill(applySuggestions = true) {
    const session = getStaffSession()
    if (!session) return
    setFilling('confirm')
    setError(null)
    try {
      const result = await staffFetch<{
        created: number
        score: number
        summary: string
        restDays: number
      }>('/employees/schedule/smart-fill', {
        method: 'POST',
        token: session.token,
        body: JSON.stringify({
          from: weekFrom,
          to: weekTo,
          userId: previewUserId,
          applySuggestions,
          overwrite: true,
        }),
      })
      setShowPreview(false)
      setPreview(null)
      setToast(
        `${result.created} affectation(s) · score ${result.score}/100 · ${result.restDays} repos planifiés`
      )
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setFilling(null)
    }
  }

  const weekLabel = useMemo(() => {
    const start = new Date(`${weekFrom}T12:00:00`)
    const end = new Date(`${weekTo}T12:00:00`)
    return `${start.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} – ${end.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}`
  }, [weekFrom, weekTo])

  const intelligence = data?.intelligence
  const withDefaultShift = data?.employees.filter((e) => e.shiftId).length ?? 0

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-wrap items-start gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-cream">Planning équipe</h1>
            <p className="mt-1 text-sm text-cream/55">Semaine du {weekLabel}</p>
          </div>
          {intelligence && !loading && (
            <div
              className={cn(
                'flex flex-col items-center rounded-2xl border px-4 py-2',
                scoreColor(intelligence.score)
              )}
            >
              <span className="text-[10px] font-medium uppercase tracking-wide opacity-80">Score</span>
              <span className="font-display text-2xl font-bold">{intelligence.score}</span>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setWeekFrom(addDays(weekFrom, -7))}
            className="rounded-xl border border-white/15 p-2 text-cream hover:bg-white/5"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => setWeekFrom(weekStartMonday())}
            className="rounded-xl border border-white/15 px-3 py-2 text-sm text-cream hover:bg-white/5"
          >
            Cette semaine
          </button>
          <button
            type="button"
            onClick={() => setWeekFrom(addDays(weekFrom, 7))}
            className="rounded-xl border border-white/15 p-2 text-cream hover:bg-white/5"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <button
            type="button"
            disabled={copying !== null || loading}
            onClick={() => void copyWeek(1)}
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-3 py-2 text-sm text-cream hover:bg-white/5 disabled:opacity-40"
          >
            {copying === 'next' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
            Copier → sem. suivante
          </button>
          <button
            type="button"
            disabled={copying !== null || loading}
            onClick={() => void copyWeek(4)}
            className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100 hover:bg-emerald-500/20 disabled:opacity-40"
          >
            {copying === 'month' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
            Dupliquer × 4 semaines
          </button>
          <button
            type="button"
            disabled={filling !== null || !withDefaultShift}
            onClick={() => void openSmartPreview()}
            className="inline-flex items-center gap-2 rounded-xl border border-violet-500/40 bg-violet-500/10 px-4 py-2 text-sm font-medium text-violet-200 hover:bg-violet-500/20 disabled:opacity-40"
          >
            {filling === 'preview' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Planification intelligente
          </button>
          <Link
            href="/admin/planning/affichage"
            className="inline-flex items-center gap-2 rounded-xl bg-tomato/90 px-4 py-2 text-sm font-semibold text-white hover:bg-tomato"
          >
            <Monitor className="h-4 w-4" />
            Affichage mural
          </Link>
        </div>
      </div>

      {toast && (
        <p className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-100">
          <Sparkles className="h-4 w-4 shrink-0" />
          {toast}
        </p>
      )}
      {error && (
        <p className="rounded-xl border border-red-500/30 bg-red-950/40 px-4 py-2 text-sm text-red-200">{error}</p>
      )}

      <AdminAttendancePanel />

      {intelligence && !loading && (
        <IntelligencePanel
          intelligence={intelligence}
          onApplySuggestion={(a) => void applySuggestion(a)}
          saving={!!saving}
        />
      )}

      {!loading && data && withDefaultShift === 0 && (
        <p className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          Assignez des créneaux par défaut dans{' '}
          <Link href="/admin/employees" className="underline">
            Employés
          </Link>{' '}
          pour activer la planification intelligente.
        </p>
      )}

      {loading || !data ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-tomato/60" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#1A1412]/50">
          <table className="w-full min-w-[640px] table-fixed text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.02]">
                <th className="sticky left-0 z-10 w-[120px] bg-[#1A1412] px-2 py-2 text-left text-[10px] font-medium uppercase tracking-wide text-cream/40">
                  Employé
                </th>
                {dates.map((date, i) => (
                  <th key={date} className="w-[72px] px-0.5 py-2 text-center text-[10px] text-cream/45">
                    <span className="font-medium text-cream/70">{DOW[i]}</span>
                    <br />
                    {date.slice(8)}/{date.slice(5, 7)}
                  </th>
                ))}
                <th className="w-10 px-0.5 py-2 text-center text-[10px] text-cream/40">IA</th>
              </tr>
            </thead>
            <tbody>
              {data.employees.map((emp) => {
                const rs = roleStyle(emp.role)
                const polyvalent = isPolyvalentEmployee(emp)
                return (
                  <tr key={emp.id} className="border-b border-white/5">
                    <td className="sticky left-0 z-10 bg-[#1A1412] px-2 py-1.5">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[9px] font-bold',
                            rs.badge
                          )}
                        >
                          {staffInitials(emp.name)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium text-cream">{emp.name.split(' ')[0]}</p>
                          <p className="truncate text-[9px] text-cream/40">
                            {polyvalent ? 'Polyvalent' : roleLabel(emp.role)}
                          </p>
                        </div>
                      </div>
                    </td>
                    {dates.map((date) => {
                      const entry = entryFor(emp.id, date)
                      const cellKey = `${emp.id}-${date}`
                      return (
                        <td key={date} className="px-0.5 py-0.5 align-top">
                          <PlanningCell
                            shifts={data.shifts}
                            employee={emp}
                            entry={entry}
                            saving={saving === cellKey}
                            onSave={(shiftId, rl) => saveCell(emp.id, date, shiftId, rl)}
                          />
                        </td>
                      )
                    })}
                    <td className="px-0.5 py-0.5 align-top">
                      <button
                        type="button"
                        disabled={(!emp.shiftId && !polyvalent) || filling !== null}
                        title="Prévisualiser remplissage intelligent"
                        onClick={() => void openSmartPreview(emp.id)}
                        className="flex h-full min-h-[48px] w-full flex-col items-center justify-center rounded-lg border border-dashed border-violet-500/20 px-0.5 text-[9px] text-violet-300/70 hover:bg-violet-500/10 disabled:opacity-30"
                      >
                        {filling === emp.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Sparkles className="h-4 w-4" />
                        )}
                        IA
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showPreview && preview && (
        <SmartPreviewModal
          preview={preview}
          employees={data?.employees ?? []}
          loading={filling === 'confirm'}
          onClose={() => {
            setShowPreview(false)
            setPreview(null)
          }}
          onConfirm={(withSuggestions) => void confirmSmartFill(withSuggestions)}
        />
      )}
    </div>
  )
}

function IntelligencePanel({
  intelligence,
  onApplySuggestion,
  saving,
}: {
  intelligence: ScheduleIntelligence
  onApplySuggestion: (action: ScheduleSuggestion['action']) => void
  saving: boolean
}) {
  const critical = intelligence.issues.filter((i) => i.severity === 'critical')
  const warnings = intelligence.issues.filter((i) => i.severity === 'warning')

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="rounded-2xl border border-white/10 bg-[#1A1412]/60 p-4 lg:col-span-1">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-cream">
          <ShieldCheck className="h-4 w-4 text-emerald-400" />
          Garde-fous actifs
        </div>
        <ul className="space-y-2">
          {GUARDRAIL_RULES.map((r) => (
            <li key={r.key} className="flex items-start gap-2 text-xs text-cream/55">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500/70" />
              {r.label}
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-3 lg:col-span-2">
        {critical.length === 0 && warnings.length === 0 && intelligence.suggestions.length === 0 ? (
          <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm text-emerald-100">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            Semaine conforme — couverture et repos OK.
          </div>
        ) : (
          <>
            {critical.map((issue) => (
              <IssueRow key={issue.id} issue={issue} />
            ))}
            {warnings.map((issue) => (
              <IssueRow key={issue.id} issue={issue} />
            ))}
          </>
        )}

        {intelligence.suggestions.length > 0 && (
          <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-violet-200/80">
              Suggestions intelligentes
            </p>
            <p className="mb-3 text-[10px] text-cream/40">
              Couverture cuisine · caisse · livraison — remplaçant au repos ou gérant polyvalent. Les heures
              vont au remplaçant, pas à l&apos;absent.
            </p>
            <ul className="space-y-2">
              {intelligence.suggestions.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 text-sm text-cream/80">
                  <span>{s.message}</span>
                  {s.action && (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => onApplySuggestion(s.action)}
                      className="shrink-0 rounded-lg bg-violet-500/20 px-3 py-1 text-xs font-medium text-violet-100 hover:bg-violet-500/30 disabled:opacity-50"
                    >
                      Appliquer
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

function IssueRow({ issue }: { issue: GuardrailIssue }) {
  const Icon = issue.severity === 'critical' ? XCircle : issue.severity === 'warning' ? AlertTriangle : Info
  const colors =
    issue.severity === 'critical'
      ? 'border-red-500/30 bg-red-950/30 text-red-100'
      : issue.severity === 'warning'
        ? 'border-amber-500/30 bg-amber-500/10 text-amber-100'
        : 'border-white/10 bg-white/[0.03] text-cream/70'

  return (
    <div className={cn('flex gap-3 rounded-xl border p-3 text-sm', colors)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <p>{issue.message}</p>
        {issue.suggestion && <p className="mt-1 text-xs opacity-75">{issue.suggestion}</p>}
      </div>
    </div>
  )
}

function SmartPreviewModal({
  preview,
  employees,
  loading,
  onClose,
  onConfirm,
}: {
  preview: SmartPreview
  employees: Employee[]
  loading: boolean
  onClose: () => void
  onConfirm: (applySuggestions: boolean) => void
}) {
  const empName = (id: string) => employees.find((e) => e.id === id)?.name.split(' ')[0] ?? id.slice(0, 6)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-[#1A1412] p-6 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-cream">Planification intelligente</h2>
            <p className="mt-1 text-sm text-cream/50">{preview.summary}</p>
          </div>
          <div
            className={cn(
              'rounded-xl border px-3 py-1 text-center font-display text-xl font-bold',
              scoreColor(preview.score)
            )}
          >
            {preview.score}
          </div>
        </div>

        <div className="mb-4 grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2">
            <p className="text-cream/40">À créer</p>
            <p className="font-semibold text-cream">{preview.proposed.length}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2">
            <p className="text-cream/40">Repos</p>
            <p className="font-semibold text-cream">{preview.restDays.length}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2">
            <p className="text-cream/40">Ignorés</p>
            <p className="font-semibold text-cream">{preview.skippedExisting}</p>
          </div>
        </div>

        {preview.proposed.length > 0 && (
          <div className="mb-4 max-h-40 overflow-y-auto rounded-xl border border-white/10 p-3">
            <p className="mb-2 text-xs font-medium text-cream/45">Affectations proposées</p>
            <ul className="space-y-1 text-xs text-cream/70">
              {preview.proposed.slice(0, 12).map((p) => (
                <li key={`${p.userId}-${p.date}`}>
                  {empName(p.userId)} · {p.date.slice(8)}/{p.date.slice(5, 7)} · {p.roleLabel}
                  {p.reason === 'coverage' && (
                    <span className="ml-1 text-violet-300">(couverture)</span>
                  )}
                </li>
              ))}
              {preview.proposed.length > 12 && (
                <li className="text-cream/40">+ {preview.proposed.length - 12} autres…</li>
              )}
            </ul>
          </div>
        )}

        {preview.issues.length > 0 && (
          <div className="mb-4 space-y-2">
            {preview.issues.slice(0, 3).map((i) => (
              <IssueRow key={i.id} issue={i} />
            ))}
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-2 border-t border-white/10 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/15 px-4 py-2 text-sm text-cream/80"
          >
            Annuler
          </button>
          <button
            type="button"
            disabled={loading || preview.proposed.length === 0}
            onClick={() => onConfirm(false)}
            className="rounded-xl border border-white/15 px-4 py-2 text-sm text-cream hover:bg-white/5 disabled:opacity-40"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Appliquer le plan'}
          </button>
          <button
            type="button"
            disabled={loading || preview.proposed.length === 0}
            onClick={() => onConfirm(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-40"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            Optimiser + suggestions
          </button>
        </div>
      </div>
    </div>
  )
}

function PlanningCell({
  shifts,
  employee,
  entry,
  saving,
  onSave,
}: {
  shifts: Shift[]
  employee: Employee
  entry?: Entry
  saving: boolean
  onSave: (shiftId: string, roleLabel: string) => void
}) {
  const posts = useMemo(() => planningPostsForEmployee(employee, shifts), [employee, shifts])
  const scheduled = Boolean(entry?.shiftId)
  const shift = shifts.find((s) => s.id === entry?.shiftId) || entry?.shift

  function cycle() {
    if (saving) return
    if (posts.length === 0) return

    if (!scheduled) {
      onSave(posts[0]!.shiftId, posts[0]!.roleLabel)
      return
    }

    if (posts.length === 1) {
      onSave('', '')
      return
    }

    const idx = posts.findIndex(
      (p) => p.shiftId === entry?.shiftId && p.roleLabel === (entry?.roleLabel ?? ''),
    )
    const idxByShift = idx >= 0 ? idx : posts.findIndex((p) => p.shiftId === entry?.shiftId)
    if (idxByShift < 0) {
      onSave(posts[0]!.shiftId, posts[0]!.roleLabel)
      return
    }
    const next = idxByShift + 1
    if (next >= posts.length) {
      onSave('', '')
    } else {
      onSave(posts[next]!.shiftId, posts[next]!.roleLabel)
    }
  }

  const polyvalent = posts.length > 1

  return (
    <button
      type="button"
      disabled={saving}
      onClick={cycle}
      title={polyvalent ? 'Clic pour changer de poste' : undefined}
      className={cn(
        'group flex min-h-[48px] w-full flex-col items-center justify-center rounded-lg border px-0.5 py-1 text-center transition',
        scheduled
          ? 'border-tomato/35 bg-tomato/10 hover:bg-tomato/15'
          : 'border-white/8 bg-white/[0.02] hover:bg-white/[0.04]',
      )}
    >
      {saving ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin text-cream/50" />
      ) : scheduled && shift ? (
        <>
          <span className="text-[10px] font-semibold leading-tight text-cream">
            {entry?.roleLabel ?? shift.name}
          </span>
          <span className="text-[8px] leading-tight text-cream/45">
            {entry?.startTime || shift.startTime}–{entry?.endTime || shift.endTime}
          </span>
        </>
      ) : (
        <span className="text-[10px] font-medium text-cream/35 group-hover:text-cream/55">Repos</span>
      )}
    </button>
  )
}
