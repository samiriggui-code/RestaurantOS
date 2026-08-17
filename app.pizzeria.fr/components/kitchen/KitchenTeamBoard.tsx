'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowLeftRight,
  CalendarDays,
  CheckCircle2,
  Clock,
  Loader2,
  LogIn,
  LogOut,
  Users,
} from 'lucide-react'
import { getStaffSession } from '@/lib/staff-auth'
import { staffFetch } from '@/lib/staff-api'
import { cn } from '@/lib/cn'
import { roleLabel, roleStyle, staffInitials } from '@/lib/staff-display'
import { StaffPinDialog } from '@/components/ops/StaffPinDialog'

type ShiftInfo = {
  id: string
  name: string
  startTime: string
  endTime: string
  slug?: string | null
}

type AttendanceInfo = {
  status: 'NONE' | 'IN' | 'OUT'
  clockIn: string
  clockOut: string | null
  minutesWorked: number | null
  minutesWorkedLabel: string
}

type PunchInfo = {
  canClockIn: boolean
  canClockOut: boolean
  canSubstitute: boolean
  blockedReason: string | null
  opensAt: string | null
}

type TeamEmployee = {
  id: string
  name: string
  role: string
  scheduled: boolean
  roleLabel: string | null
  shift: ShiftInfo | null
  startTime: string | null
  endTime: string | null
  scheduleNotes: string | null
  attendance: AttendanceInfo | null
  punch: PunchInfo
}

type SubstituteOption = {
  id: string
  name: string
  role: string
}

type WeekEntry = {
  id: string
  date: string
  roleLabel: string | null
  user: { id: string; name: string; role: string }
  shift: ShiftInfo | null
  startTime: string | null
  endTime: string | null
}

export type TodayBoardData = {
  date: string
  weekFrom: string
  weekTo: string
  employees: TeamEmployee[]
  availableSubstitutes: SubstituteOption[]
  weekEntries: WeekEntry[]
  summary: { scheduled: number; present: number; finishedToday: number; totalStaff: number }
}

const DOW = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

const ROLE_SORT: Record<string, number> = { CHEF: 0, CASHIER: 1, WAITER: 1, DRIVER: 2, MANAGER: 3, ADMIN: 3 }

function sortWeekEntries(entries: WeekEntry[]) {
  return [...entries].sort((a, b) => {
    const ra = ROLE_SORT[a.user.role] ?? 9
    const rb = ROLE_SORT[b.user.role] ?? 9
    if (ra !== rb) return ra - rb
    return a.user.name.localeCompare(b.user.name, 'fr')
  })
}

function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T12:00:00`)
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

type Props = {
  variant?: 'kitchen' | 'mural'
  className?: string
}

export function KitchenTeamBoard({ variant = 'kitchen', className }: Props) {
  const [data, setData] = useState<TodayBoardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState(new Date())
  const [punching, setPunching] = useState<string | null>(null)
  const [substituting, setSubstituting] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [pinTarget, setPinTarget] = useState<{
    userId: string
    name: string
    action: 'in' | 'out'
  } | null>(null)
  const [substituteTarget, setSubstituteTarget] = useState<{
    absentUserId: string
    absentName: string
    substituteUserId: string
    substituteName: string
  } | null>(null)
  const [pinError, setPinError] = useState<string | null>(null)
  const [pickSubstituteFor, setPickSubstituteFor] = useState<TeamEmployee | null>(null)

  const load = useCallback(() => {
    const session = getStaffSession()
    if (!session) return
    staffFetch<TodayBoardData>('/employees/planning/today-board', { token: session.token })
      .then(setData)
      .catch(() => {
        /* polling silencieux si API en redémarrage */
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
    const t1 = setInterval(load, 30_000)
    const t2 = setInterval(() => setNow(new Date()), 1000)
    return () => {
      clearInterval(t1)
      clearInterval(t2)
    }
  }, [load])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 5000)
    return () => clearTimeout(t)
  }, [toast])

  function openPunchDialog(emp: TeamEmployee) {
    const status = emp.attendance?.status ?? 'NONE'
    if (status === 'OUT') return
    if (status !== 'IN' && !emp.punch.canClockIn) return
    setPinError(null)
    setPinTarget({
      userId: emp.id,
      name: emp.name,
      action: status === 'IN' ? 'out' : 'in',
    })
  }

  async function confirmPunch(pin: string) {
    if (!pinTarget) return
    const session = getStaffSession()
    if (!session) return
    setPunching(pinTarget.userId)
    setPinError(null)
    try {
      const result = await staffFetch<AttendanceInfo>('/employees/attendance/punch', {
        method: 'POST',
        token: session.token,
        body: JSON.stringify({ userId: pinTarget.userId, pin }),
      })
      const shortName = pinTarget.name.split(' ')[0] ?? pinTarget.name
      const label =
        result.status === 'IN'
          ? `${shortName} — entrée ${formatTime(result.clockIn)}`
          : `${shortName} — sortie · ${result.minutesWorkedLabel}`
      setToast(label)
      setPinTarget(null)
      load()
    } catch (err) {
      setPinError(err instanceof Error ? err.message : 'Pointage impossible')
    } finally {
      setPunching(null)
    }
  }

  function startSubstitute(emp: TeamEmployee, sub: SubstituteOption) {
    setPinError(null)
    setPickSubstituteFor(null)
    setSubstituteTarget({
      absentUserId: emp.id,
      absentName: emp.name,
      substituteUserId: sub.id,
      substituteName: sub.name,
    })
  }

  async function confirmSubstitute(pin: string) {
    if (!substituteTarget || !data) return
    const session = getStaffSession()
    if (!session) return
    setSubstituting(true)
    setPinError(null)
    try {
      const result = await staffFetch<{ message: string }>('/employees/planning/substitute', {
        method: 'POST',
        token: session.token,
        body: JSON.stringify({
          absentUserId: substituteTarget.absentUserId,
          substituteUserId: substituteTarget.substituteUserId,
          pin,
          date: data.date,
        }),
      })
      setToast(result.message)
      setSubstituteTarget(null)
      load()
    } catch (err) {
      setPinError(err instanceof Error ? err.message : 'Remplacement impossible')
    } finally {
      setSubstituting(false)
    }
  }

  const weekByDay = useMemo(() => {
    if (!data) return new Map<string, WeekEntry[]>()
    const map = new Map<string, WeekEntry[]>()
    for (let i = 0; i < 7; i++) map.set(addDays(data.weekFrom, i), [])
    for (const e of data.weekEntries) {
      const list = map.get(e.date) ?? []
      list.push(e)
      map.set(e.date, list)
    }
    return map
  }, [data])

  if (loading && !data) {
    return (
      <div className={cn('flex flex-1 items-center justify-center', className)}>
        <Loader2 className="h-10 w-10 animate-spin text-tomato-light" />
      </div>
    )
  }

  if (!data) return null

  const today = data.date

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col overflow-hidden', className)}>
      <div className="border-b border-white/10 bg-charcoal/80 px-4 py-4 md:px-6">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-tomato/80">La Z Pizza — Équipe</p>
            <h2 className="font-display text-2xl font-bold text-cream md:text-3xl">
              {variant === 'kitchen' ? 'Planning & pointage' : 'Planning mural'}
            </h2>
            <p className="mt-1 text-sm capitalize text-cream/55">
              {now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
            {variant === 'kitchen' && (
              <p className="mt-1 text-xs text-cream/40">
                Entrée ouverte 10 min avant le créneau · PIN personnel obligatoire
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-center">
              <p className="text-[10px] uppercase text-emerald-200/70">En poste</p>
              <p className="font-display text-2xl font-bold text-emerald-100">{data.summary.present}</p>
            </div>
            <div className="rounded-xl border border-white/15 bg-white/[0.04] px-4 py-2 text-center">
              <p className="text-[10px] uppercase text-cream/45">Planifiés</p>
              <p className="font-display text-2xl font-bold text-cream">{data.summary.scheduled}</p>
            </div>
            {data.summary.finishedToday > 0 && (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-center">
                <p className="text-[10px] uppercase text-cream/40">Terminés</p>
                <p className="font-display text-2xl font-bold text-cream/70">
                  {data.summary.finishedToday}
                </p>
              </div>
            )}
            <p className="font-mono text-3xl font-bold tabular-nums text-cream">
              {now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </p>
          </div>
        </div>
        {toast && (
          <p className="mx-auto mt-3 max-w-[1600px] rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-100">
            {toast}
          </p>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
        <div className="mx-auto max-w-[1600px] space-y-8">
          <section>
            <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-cream">
              <Users className="h-5 w-5 text-tomato" />
              Aujourd&apos;hui — équipe de service
            </h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {data.employees.map((emp) => (
                <EmployeeCard
                  key={emp.id}
                  emp={emp}
                  showPunch={variant === 'kitchen'}
                  punching={punching === emp.id}
                  onPunch={() => openPunchDialog(emp)}
                  onSubstitute={
                    variant === 'kitchen' && emp.punch.canSubstitute && data.availableSubstitutes.length > 0
                      ? () => setPickSubstituteFor(emp)
                      : undefined
                  }
                />
              ))}
            </div>
          </section>

          <section>
            <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-cream">
              <CalendarDays className="h-5 w-5 text-tomato" />
              Semaine en cours
            </h3>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
              {Array.from(weekByDay.entries()).map(([date, entries], i) => {
                const isToday = date === today
                return (
                  <div
                    key={date}
                    className={cn(
                      'rounded-2xl border p-4',
                      isToday ? 'border-tomato/50 bg-tomato/10' : 'border-white/10 bg-white/[0.03]',
                    )}
                  >
                    <p className={cn('font-bold', isToday ? 'text-tomato' : 'text-cream')}>
                      {DOW[i]}
                      {isToday ? ' · Auj.' : ''}
                    </p>
                    <p className="mb-3 text-xs text-cream/45">
                      {new Date(`${date}T12:00:00`).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </p>
                    {entries.length === 0 ? (
                      <p className="text-xs italic text-cream/35">—</p>
                    ) : (
                      <ul className="space-y-2">
                        {sortWeekEntries(entries).map((e) => (
                          <li key={e.id} className="rounded-lg bg-black/25 px-2 py-1.5 text-xs">
                            <p className="font-medium text-cream">{e.user.name.split(' ')[0]}</p>
                            <p className="text-cream/50">
                              {e.roleLabel ?? roleLabel(e.user.role)} · {e.shift?.name}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        </div>
      </div>

      {pickSubstituteFor && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
          <div className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-2xl border border-violet-500/30 bg-charcoal p-5 shadow-xl">
            <h3 className="font-display text-lg font-bold text-cream">Remplacer {pickSubstituteFor.name.split(' ')[0]}</h3>
            <p className="mt-1 text-sm text-cream/50">
              Créneau {pickSubstituteFor.startTime}–{pickSubstituteFor.endTime} · choisissez un disponible
            </p>
            <ul className="mt-4 space-y-2">
              {data.availableSubstitutes.map((sub) => (
                <li key={sub.id}>
                  <button
                    type="button"
                    onClick={() => startSubstitute(pickSubstituteFor, sub)}
                    className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-left hover:border-violet-400/40 hover:bg-violet-500/10"
                  >
                    <span className="font-medium text-cream">{sub.name}</span>
                    <span className="text-xs text-cream/50">{roleLabel(sub.role)}</span>
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => setPickSubstituteFor(null)}
              className="mt-4 w-full rounded-xl border border-white/15 py-2.5 text-sm text-cream/70"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      <StaffPinDialog
        open={pinTarget !== null}
        employeeName={pinTarget?.name ?? ''}
        actionLabel={
          pinTarget?.action === 'out' ? 'Confirmer la fin de service' : 'Confirmer le début de service'
        }
        submitting={punching !== null}
        error={pinError}
        onClose={() => {
          setPinTarget(null)
          setPinError(null)
        }}
        onSubmit={(pin) => void confirmPunch(pin)}
      />

      <StaffPinDialog
        open={substituteTarget !== null}
        employeeName={substituteTarget?.substituteName ?? ''}
        actionLabel={`Confirmer le remplacement de ${substituteTarget?.absentName.split(' ')[0] ?? ''}`}
        submitting={substituting}
        error={pinError}
        onClose={() => {
          setSubstituteTarget(null)
          setPinError(null)
        }}
        onSubmit={(pin) => void confirmSubstitute(pin)}
      />
    </div>
  )
}

function EmployeeCard({
  emp,
  showPunch,
  punching,
  onPunch,
  onSubstitute,
}: {
  emp: TeamEmployee
  showPunch: boolean
  punching: boolean
  onPunch: () => void
  onSubstitute?: () => void
}) {
  const rs = roleStyle(emp.role)
  const status = emp.attendance?.status ?? 'NONE'
  const isIn = status === 'IN'
  const isOut = status === 'OUT'
  const canPunchIn = emp.punch.canClockIn
  const canPunchOut = emp.punch.canClockOut

  return (
    <article
      className={cn(
        'flex flex-col rounded-2xl border p-4 transition',
        isIn
          ? 'border-emerald-500/40 bg-emerald-500/10'
          : emp.scheduled
            ? 'border-tomato/30 bg-tomato/[0.06]'
            : 'border-white/10 bg-white/[0.03]',
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold',
            rs.badge,
          )}
        >
          {staffInitials(emp.name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-cream">{emp.name}</p>
          <p className="text-xs text-cream/50">{roleLabel(emp.role)}</p>
          {emp.shift && (
            <p className="mt-1 text-xs text-tomato-light/90">
              {emp.roleLabel ?? emp.shift.name} · {emp.startTime ?? emp.shift.startTime}–
              {emp.endTime ?? emp.shift.endTime}
            </p>
          )}
          {emp.scheduleNotes?.includes('Remplace') && (
            <p className="mt-1 text-[10px] text-violet-300">{emp.scheduleNotes}</p>
          )}
          {!emp.scheduled && (
            <p className="mt-1 text-[10px] text-cream/40">Non planifié aujourd&apos;hui</p>
          )}
        </div>
        {isIn && <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-400" aria-label="Présent" />}
      </div>

      <div className="mt-3 space-y-1 text-xs text-cream/60">
        {emp.attendance?.clockIn && (
          <p className="flex items-center gap-1">
            <LogIn className="h-3.5 w-3.5" />
            Entrée {formatTime(emp.attendance.clockIn)}
          </p>
        )}
        {emp.attendance?.clockOut && (
          <p className="flex items-center gap-1">
            <LogOut className="h-3.5 w-3.5" />
            Sortie {formatTime(emp.attendance.clockOut)} · {emp.attendance.minutesWorkedLabel}
          </p>
        )}
        {isIn && (
          <p className="flex items-center gap-1 font-medium text-emerald-300">
            <Clock className="h-3.5 w-3.5" />
            En service
          </p>
        )}
        {!isIn && !isOut && emp.punch.blockedReason && (
          <p className="text-amber-200/90">{emp.punch.blockedReason}</p>
        )}
      </div>

      {showPunch && onSubstitute && (
        <button
          type="button"
          onClick={onSubstitute}
          className="mt-3 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-violet-500/30 bg-violet-500/10 text-sm font-semibold text-violet-200 hover:bg-violet-500/20"
        >
          <ArrowLeftRight className="h-4 w-4" />
          Remplacer
        </button>
      )}

      {showPunch && (
        <button
          type="button"
          disabled={punching || isOut || (!canPunchIn && !canPunchOut)}
          onClick={onPunch}
          className={cn(
            'mt-3 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl text-sm font-bold transition disabled:opacity-40',
            isIn
              ? 'border-2 border-amber-400/50 bg-amber-500 text-charcoal hover:bg-amber-400'
              : isOut
                ? 'border border-white/10 bg-white/5 text-cream/40'
                : canPunchIn
                  ? 'border-2 border-emerald-400/50 bg-emerald-600 text-white hover:bg-emerald-500'
                  : 'border border-white/10 bg-white/5 text-cream/40',
          )}
        >
          {punching ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : isOut ? (
            <>Journée terminée</>
          ) : isIn ? (
            <>
              <LogOut className="h-5 w-5" />
              Pointer sortie
            </>
          ) : canPunchIn ? (
            <>
              <LogIn className="h-5 w-5" />
              Pointer entrée
            </>
          ) : (
            <>Pointage fermé</>
          )}
        </button>
      )}
    </article>
  )
}
