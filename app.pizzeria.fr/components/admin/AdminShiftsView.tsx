'use client'

import { useCallback, useEffect, useState } from 'react'
import { useFeedbackState } from '@/lib/use-feedback-state'
import Link from 'next/link'
import { Clock, Edit2, Loader2, Plus, Trash2, Users } from 'lucide-react'
import { getStaffSession } from '@/lib/staff-auth'
import { staffFetch } from '@/lib/staff-api'
import { cn } from '@/lib/cn'
import { useAdminFeedback } from '@/components/admin/AdminFeedbackProvider'
import { roleLabel, roleStyle, staffInitials } from '@/lib/staff-display'

type ShiftUser = { id: string; name: string; role: string; email: string }

type Shift = {
  id: string
  name: string
  nameAr?: string | null
  startTime: string
  endTime: string
  days: number
  _count?: { users: number }
  users?: ShiftUser[]
}

type ShiftsPayload = {
  shifts: Shift[]
  unassigned: ShiftUser[]
}

const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

const fieldClass =
  'mt-1 w-full rounded-xl border border-white/15 bg-white/[0.03] px-3 py-2 text-sm text-cream outline-none focus:border-tomato/40'

export function AdminShiftsView() {
  const { confirm, notifySuccess, notifyError } = useAdminFeedback()
  const [shifts, setShifts] = useState<Shift[]>([])
  const [unassigned, setUnassigned] = useState<ShiftUser[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Shift | null>(null)
  const { error, setError } = useFeedbackState()
  const [syncing, setSyncing] = useState(false)

  const load = useCallback(() => {
    const session = getStaffSession()
    if (!session) return
    setLoading(true)
    staffFetch<ShiftsPayload>('/employees/shifts?withStaff=1', { token: session.token })
      .then((data) => {
        setShifts(data.shifts)
        setUnassigned(data.unassigned)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Erreur'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const session = getStaffSession()
    if (!session) return
    const form = new FormData(e.currentTarget)
    const data = {
      name: form.get('name'),
      nameAr: form.get('nameAr') || form.get('name'),
      startTime: form.get('startTime'),
      endTime: form.get('endTime'),
      days: 127,
    }
    setError(null)
    try {
      if (editing) {
        await staffFetch(`/employees/shifts/${editing.id}`, {
          method: 'PUT',
          token: session.token,
          body: JSON.stringify(data),
        })
      } else {
        await staffFetch('/employees/shifts', {
          method: 'POST',
          token: session.token,
          body: JSON.stringify(data),
        })
      }
      setShowModal(false)
      setEditing(null)
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    }
  }

  async function handleDelete(id: string) {
    if (
      !(await confirm({
        title: 'Supprimer le créneau',
        message: 'Supprimer ce créneau ? Les employés assignés seront détachés.',
        confirmLabel: 'Supprimer',
        destructive: true,
      }))
    ) {
      return
    }
    const session = getStaffSession()
    if (!session) return
    try {
      await staffFetch(`/employees/shifts/${id}`, { method: 'DELETE', token: session.token })
      notifySuccess('Créneau supprimé.')
      load()
    } catch (err) {
      notifyError(err instanceof Error ? err.message : 'Suppression impossible')
    }
  }

  async function syncStandardShifts() {
    const session = getStaffSession()
    if (!session) return
    setSyncing(true)
    setError(null)
    try {
      await staffFetch('/employees/shifts/sync', { method: 'POST', token: session.token })
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setSyncing(false)
    }
  }

  function dayLabels(mask: number) {
    return DAYS.filter((_, i) => mask & (1 << i))
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-tomato-light" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-cream">Créneaux équipe</h1>
          <p className="mt-1 text-sm text-cream/50">
            Modèle d&apos;horaires par rôle pour alimenter le planning équipe et les affectations.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={syncing}
            onClick={() => void syncStandardShifts()}
            className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-100 hover:bg-emerald-500/20 disabled:opacity-50"
          >
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Appliquer horaires La Z
          </button>
          <Link
            href="/admin/employees"
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm text-cream hover:bg-white/5"
          >
            <Users className="h-4 w-4" />
            Employés
          </Link>
          <Link
            href="/admin/planning"
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm text-cream hover:bg-white/5"
          >
            Planning
          </Link>
          <button
            type="button"
            onClick={() => {
              setEditing(null)
              setShowModal(true)
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-tomato px-4 py-2 text-sm font-semibold text-white"
          >
            <Plus className="h-4 w-4" />
            Nouveau créneau
          </button>
        </div>
      </div>

      {error && (
        <p className="rounded-xl border border-red-500/30 bg-red-950/40 px-4 py-2 text-sm text-red-200">{error}</p>
      )}

      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-sm text-cream/60">
        <p>
          <strong className="text-cream/80">Planning équipe</strong> = qui travaille cette semaine.
        </p>
        <p className="mt-1">
          <strong className="text-cream/80">Créneaux équipe</strong> = horaires types réutilisables
          (Cuisine, Caisse, Livraison) assignés aux employés.
        </p>
      </div>

      <div className="grid gap-4">
        {shifts.map((shift) => (
          <div
            key={shift.id}
            className="overflow-hidden rounded-2xl border border-white/10 bg-[#1A1412]/80"
          >
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/5 p-4">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15">
                  <Clock className="h-6 w-6 text-emerald-300" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-display text-lg font-semibold text-cream">{shift.name}</p>
                    <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-cream/50">
                      {shift.users?.length ?? shift._count?.users ?? 0} employé(s)
                    </span>
                  </div>
                  <p className="text-sm text-cream/55">
                    {shift.startTime} – {shift.endTime}
                    {shift.name === 'Cuisine' && ' · pizzaïolos'}
                    {shift.name === 'Caisse' && ' · caissiers'}
                    {shift.name === 'Livraison' && ' · livreurs'}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {dayLabels(shift.days).map((d) => (
                      <span
                        key={d}
                        className="rounded-md bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-cream/45"
                      >
                        {d}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setEditing(shift)
                    setShowModal(true)
                  }}
                  className="rounded-lg p-2 hover:bg-white/5"
                >
                  <Edit2 className="h-4 w-4 text-cream/60" />
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete(shift.id)}
                  className="rounded-lg p-2 hover:bg-red-500/10"
                >
                  <Trash2 className="h-4 w-4 text-red-400" />
                </button>
              </div>
            </div>
            <div className="p-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-cream/35">Équipe assignée</p>
              {shift.users?.length ? (
                <div className="flex flex-wrap gap-2">
                  {shift.users.map((u) => {
                    const rs = roleStyle(u.role)
                    return (
                      <Link
                        key={u.id}
                        href="/admin/employees"
                        className={cn(
                          'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs ring-1 ring-inset transition hover:brightness-110',
                          rs.badge
                        )}
                      >
                        <span className="font-semibold">{staffInitials(u.name)}</span>
                        <span>{u.name.split(' ')[0]}</span>
                        <span className="opacity-60">· {roleLabel(u.role)}</span>
                      </Link>
                    )
                  })}
                </div>
              ) : (
                <p className="text-sm text-cream/35">
                  Aucun employé — assignez depuis{' '}
                  <Link href="/admin/employees" className="text-tomato/80 underline">
                    Employés
                  </Link>
                </p>
              )}
            </div>
          </div>
        ))}
        {shifts.length === 0 && (
          <p className="py-12 text-center text-cream/40">
            Aucun créneau actif — cliquez « Appliquer horaires La Z »
          </p>
        )}
      </div>

      {unassigned.length > 0 && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
          <p className="text-sm font-medium text-amber-100">
            {unassigned.length} employé(s) sans créneau par défaut
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {unassigned.map((u) => (
              <Link
                key={u.id}
                href="/admin/employees"
                className="rounded-full bg-amber-500/10 px-3 py-1 text-xs text-amber-100/90 ring-1 ring-amber-500/20"
              >
                {u.name} · {roleLabel(u.role)}
              </Link>
            ))}
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#1A1412] p-6">
            <h2 className="mb-4 font-semibold text-cream">
              {editing ? 'Modifier le créneau' : 'Nouveau créneau'}
            </h2>
            <form onSubmit={(e) => void handleSave(e)} className="space-y-4">
              <label className="block text-sm">
                Nom
                <input name="name" defaultValue={editing?.name} className={fieldClass} required />
              </label>
              <label className="block text-sm">
                Nom secondaire
                <input name="nameAr" defaultValue={editing?.nameAr ?? ''} className={fieldClass} />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm">
                  Début
                  <input
                    name="startTime"
                    type="time"
                    defaultValue={editing?.startTime}
                    className={fieldClass}
                    required
                  />
                </label>
                <label className="block text-sm">
                  Fin
                  <input name="endTime" type="time" defaultValue={editing?.endTime} className={fieldClass} required />
                </label>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-xl border border-white/15 px-4 py-2 text-sm"
                >
                  Annuler
                </button>
                <button type="submit" className="rounded-xl bg-tomato px-4 py-2 text-sm font-semibold text-white">
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
