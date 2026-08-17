'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useFeedbackState } from '@/lib/use-feedback-state'
import Link from 'next/link'
import {
  CalendarDays,
  Clock,
  Edit2,
  Loader2,
  Plus,
  Search,
  Shield,
  UserCircle,
  Users,
} from 'lucide-react'
import { getStaffSession, getStaffUser, saveCrmSession } from '@/lib/staff-auth'
import { staffFetch } from '@/lib/staff-api'
import { adminFieldClass, adminSelectClass, adminSelectInlineClass } from '@/lib/admin-ui'
import { cn } from '@/lib/cn'
import { OPERATIONAL_ROLES, ROLE, ROLE_LABEL } from '@/lib/roles'
import { STAFF_PIN_LENGTH } from '@/lib/pin'
import {
  defaultRoleLabelForPlanning,
  roleLabel,
  roleStyle,
  staffInitials,
  shiftTimeLabel,
  type ShiftSummary,
  type StaffMember,
} from '@/lib/staff-display'

const PLACEHOLDER_NAMES = new Set(['Administrateur', 'Admin', 'Gérant'])

function splitName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean)
  if (parts.length <= 1) return { firstName: parts[0] ?? '', lastName: '' }
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') }
}

function joinName(firstName: string, lastName: string): string {
  return [firstName.trim(), lastName.trim()].filter(Boolean).join(' ')
}

function isProfileIncomplete(user: StaffMember): boolean {
  return PLACEHOLDER_NAMES.has(user.name.trim()) || !user.phone?.trim()
}

function creatableRoles(): { value: string; label: string }[] {
  const me = getStaffUser('crm')?.role
  const ops = OPERATIONAL_ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] }))
  if (me === ROLE.ADMIN) {
    return [{ value: ROLE.ADMIN, label: ROLE_LABEL.ADMIN }, ...ops]
  }
  return ops
}

const fieldClass = adminFieldClass

type FilterKey = 'all' | 'active' | 'ops' | 'unassigned'

export function AdminUsersView({ title = 'Utilisateurs' }: { title?: string }) {
  const [users, setUsers] = useState<StaffMember[]>([])
  const [shifts, setShifts] = useState<ShiftSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<StaffMember | null>(null)
  const { error, setError } = useFeedbackState()
  const [selectedRole, setSelectedRole] = useState(editing?.role ?? ROLE.CASHIER)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterKey>('ops')
  const [savingShift, setSavingShift] = useState<string | null>(null)

  const currentUser = getStaffUser('crm')
  const myRecord = users.find((u) => u.id === currentUser?.id)
  const showProfileBanner = myRecord && isProfileIncomplete(myRecord)

  const load = useCallback(() => {
    const session = getStaffSession('crm')
    if (!session) return
    setLoading(true)
    const inactiveQ = filter === 'all' ? '?includeInactive=1' : ''
    Promise.all([
      staffFetch<StaffMember[]>(`/employees${inactiveQ}`, { token: session.token }),
      staffFetch<ShiftSummary[]>('/employees/shifts', { token: session.token }),
    ])
      .then(([emps, sh]) => {
        setUsers(emps)
        setShifts(sh)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Erreur'))
      .finally(() => setLoading(false))
  }, [filter])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    setSelectedRole(editing?.role ?? ROLE.CASHIER)
  }, [editing])

  const stats = useMemo(() => {
    const active = users.filter((u) => u.isActive && u.role !== ROLE.ADMIN)
    const ops = active.filter((u) => u.role !== ROLE.MANAGER)
    const unassigned = ops.filter((u) => !u.shiftId)
    return {
      total: users.length,
      active: active.length,
      kitchen: active.filter((u) => u.role === ROLE.CHEF).length,
      delivery: active.filter((u) => u.role === ROLE.DRIVER).length,
      unassigned: unassigned.length,
    }
  }, [users])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return users.filter((u) => {
      if (filter === 'active' && (!u.isActive || u.role === ROLE.ADMIN)) return false
      if (filter === 'ops' && (u.role === ROLE.ADMIN || !u.isActive)) return false
      if (filter === 'unassigned' && (u.shiftId || u.role === ROLE.ADMIN || !u.isActive)) return false
      if (!q) return true
      return (
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.phone?.includes(q) ?? false) ||
        roleLabel(u.role).toLowerCase().includes(q)
      )
    })
  }, [users, search, filter])

  function openEdit(user: StaffMember) {
    setEditing(user)
    setSelectedRole(user.role)
    setShowModal(true)
  }

  function syncLocalProfile(updated: StaffMember) {
    if (updated.id !== currentUser?.id) return
    const session = getStaffSession('crm')
    if (!session) return
    saveCrmSession({
      accessToken: session.token,
      user: { id: updated.id, name: updated.name, email: updated.email, role: updated.role },
    })
  }

  async function assignShift(userId: string, shiftId: string) {
    const session = getStaffSession('crm')
    if (!session) return
    setSavingShift(userId)
    setError(null)
    try {
      await staffFetch(`/employees/${userId}`, {
        method: 'PUT',
        token: session.token,
        body: JSON.stringify({ shiftId: shiftId || null }),
      })
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setSavingShift(null)
    }
  }

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const session = getStaffSession('crm')
    if (!session) return
    const form = new FormData(e.currentTarget)
    const pin = (form.get('pin') as string)?.trim()
    const role = form.get('role') as string
    const name = joinName(form.get('firstName') as string, form.get('lastName') as string)
    const shiftId = (form.get('shiftId') as string) || null

    if (!name.trim()) {
      setError('Prénom ou nom requis')
      return
    }

    const data: Record<string, string | null> = {
      name,
      role,
      phone: (form.get('phone') as string) || '',
      shiftId,
    }
    if (pin) data.pin = pin
    const password = (form.get('password') as string)?.trim()
    if (password) data.password = password

    try {
      setError(null)
      if (editing) {
        const updated = await staffFetch<StaffMember>(`/employees/${editing.id}`, {
          method: 'PUT',
          token: session.token,
          body: JSON.stringify(data),
        })
        syncLocalProfile(updated)
      } else {
        await staffFetch('/employees', {
          method: 'POST',
          token: session.token,
          body: JSON.stringify({ ...data, email: form.get('email') as string }),
        })
      }
      setShowModal(false)
      setEditing(null)
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    }
  }

  async function toggleActive(user: StaffMember) {
    if (user.id === currentUser?.id) {
      setError('Vous ne pouvez pas désactiver votre propre compte')
      return
    }
    const session = getStaffSession('crm')
    if (!session) return
    setError(null)
    await staffFetch(`/employees/${user.id}`, {
      method: 'PUT',
      token: session.token,
      body: JSON.stringify({ isActive: !user.isActive }),
    })
    load()
  }

  const editingNames = editing ? splitName(editing.name) : { firstName: '', lastName: '' }
  const pinRequired = !editing && selectedRole !== ROLE.ADMIN

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-tomato-light" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="admin-page-title">{title}</h1>
          <p className="admin-page-subtitle mt-1">
            Équipe, rôles, créneaux par défaut — alimente le planning hebdomadaire
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/planning"
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm font-medium text-cream hover:bg-white/5"
          >
            <CalendarDays className="h-4 w-4" />
            Planning
          </Link>
          <Link
            href="/admin/shifts"
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm font-medium text-cream hover:bg-white/5"
          >
            <Clock className="h-4 w-4" />
            Créneaux
          </Link>
          <button
            type="button"
            onClick={() => {
              setEditing(null)
              setSelectedRole(ROLE.CASHIER)
              setShowModal(true)
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-tomato px-4 py-2 text-sm font-semibold text-white"
          >
            <Plus className="h-4 w-4" />
            Embaucher
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Équipe active" value={stats.active} icon={Users} accent="text-cream" />
        <StatCard label="Cuisine" value={stats.kitchen} icon={Users} accent="text-orange-300" />
        <StatCard label="Livraison" value={stats.delivery} icon={Users} accent="text-sky-300" />
        <StatCard
          label="Sans créneau"
          value={stats.unassigned}
          icon={Clock}
          accent={stats.unassigned ? 'text-amber-300' : 'text-emerald-300'}
        />
      </div>

      {showProfileBanner && myRecord && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-medium text-amber-100">Complétez votre profil gérant</p>
              <p className="mt-1 text-sm text-amber-200/80">
                Renseignez prénom, nom et téléphone pour les reçus et factures.
              </p>
            </div>
            <button
              type="button"
              onClick={() => openEdit(myRecord)}
              className="inline-flex items-center gap-2 rounded-xl bg-amber-500/20 px-4 py-2 text-sm font-semibold text-amber-100 hover:bg-amber-500/30"
            >
              <UserCircle className="h-4 w-4" />
              Mon profil
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="rounded-xl border border-red-500/30 bg-red-950/40 px-4 py-2 text-sm text-red-200">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cream/35" />
          <input
            type="search"
            placeholder="Rechercher un employé…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-white/15 bg-white/[0.03] py-2 pl-10 pr-3 text-sm text-cream outline-none focus:border-tomato/40"
          />
        </div>
        <div className="flex flex-wrap gap-1 rounded-xl border border-white/10 bg-white/[0.02] p-1">
          {(
            [
              ['all', 'Tous'],
              ['active', 'Actifs'],
              ['ops', 'Opérationnels'],
              ['unassigned', 'Sans créneau'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-medium transition',
                filter === key ? 'bg-tomato/90 text-white' : 'text-cream/55 hover:text-cream'
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#1A1412]/80">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.02] text-left text-xs uppercase tracking-wide text-cream/40">
                <th className="px-4 py-3 font-medium">Employé</th>
                <th className="px-4 py-3 font-medium">Rôle</th>
                <th className="px-4 py-3 font-medium">Créneau par défaut</th>
                <th className="px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => {
                const isMe = u.id === currentUser?.id
                const rs = roleStyle(u.role)
                const isOps = u.role !== ROLE.ADMIN
                return (
                  <tr
                    key={u.id}
                    className={cn(
                      'border-b border-white/5 transition hover:bg-white/[0.02]',
                      isMe && 'bg-tomato/[0.04]'
                    )}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                            rs.badge
                          )}
                        >
                          {staffInitials(u.name)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-cream">
                            {u.name}
                            {isMe && (
                              <span className="ml-2 text-[10px] font-normal text-tomato-light">vous</span>
                            )}
                          </p>
                          <p className="truncate text-xs text-cream/40">{u.email}</p>
                          {u.phone ? <p className="text-xs text-cream/30">{u.phone}</p> : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset',
                          rs.badge
                        )}
                      >
                        <span className={cn('h-1.5 w-1.5 rounded-full', rs.dot)} />
                        {roleLabel(u.role)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {isOps ? (
                        <div className="relative max-w-[200px]">
                          <select
                            value={u.shiftId ?? ''}
                            disabled={savingShift === u.id || !u.isActive}
                            onChange={(e) => void assignShift(u.id, e.target.value)}
                            className={cn(
                              adminSelectInlineClass,
                              'cursor-pointer',
                              !u.shiftId && 'border-amber-500/30 text-amber-200/90',
                            )}
                          >
                            <option value="">— Non assigné —</option>
                            {shifts.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name} ({s.startTime}–{s.endTime})
                              </option>
                            ))}
                          </select>
                          {savingShift === u.id ? (
                            <Loader2 className="absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 animate-spin text-cream/40" />
                          ) : null}
                          {u.shift ? (
                            <p className="mt-1 text-[10px] text-cream/35">
                              Planning : {defaultRoleLabelForPlanning(u.role)}
                            </p>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-xs text-cream/30">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-flex rounded-full px-2.5 py-1 text-xs font-medium',
                          u.isActive
                            ? 'bg-emerald-500/15 text-emerald-200'
                            : 'bg-red-500/15 text-red-200'
                        )}
                      >
                        {u.isActive ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        {isOps && u.isActive && (
                          <Link
                            href="/admin/planning"
                            title="Voir le planning"
                            className="rounded-lg p-2 text-cream/50 hover:bg-white/5 hover:text-cream"
                          >
                            <CalendarDays className="h-4 w-4" />
                          </Link>
                        )}
                        {!isMe && (
                          <button
                            type="button"
                            title="Activer / désactiver"
                            onClick={() => void toggleActive(u)}
                            className="rounded-lg p-2 text-cream/50 hover:bg-white/5 hover:text-cream"
                          >
                            <Shield className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          type="button"
                          title="Modifier"
                          onClick={() => openEdit(u)}
                          className="rounded-lg p-2 text-cream/50 hover:bg-white/5 hover:text-cream"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <p className="py-16 text-center text-sm text-cream/40">Aucun employé ne correspond à votre recherche</p>
        )}
      </div>

      <p className="text-xs text-cream/35">
        Assignez un <strong className="font-medium text-cream/50">créneau par défaut</strong> à chaque employé, puis
        ouvrez le{' '}
        <Link href="/admin/planning" className="text-tomato/80 underline">
          planning
        </Link>{' '}
        pour pré-remplir la semaine automatiquement.
      </p>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/10 bg-[#1A1412] p-6 shadow-2xl">
            <h2 className="mb-1 font-display text-lg font-semibold text-cream">
              {editing?.id === currentUser?.id ? 'Mon profil' : editing ? 'Modifier' : 'Nouvel employé'}
            </h2>
            <p className="mb-4 text-xs text-cream/40">
              {editing ? 'Mettez à jour les informations et le créneau habituel.' : 'Embauchez un membre de l’équipe.'}
            </p>
            <form onSubmit={(e) => void handleSave(e)} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm text-cream/80">
                  Prénom
                  <input name="firstName" defaultValue={editingNames.firstName} className={fieldClass} required />
                </label>
                <label className="block text-sm text-cream/80">
                  Nom
                  <input name="lastName" defaultValue={editingNames.lastName} className={fieldClass} />
                </label>
              </div>
              <label className="block text-sm text-cream/80">
                Email
                <input
                  name="email"
                  type="email"
                  defaultValue={editing?.email}
                  readOnly={!!editing}
                  className={cn(fieldClass, editing && 'cursor-not-allowed opacity-60')}
                  required={!editing}
                />
              </label>
              <label className="block text-sm text-cream/80">
                Téléphone
                <input
                  name="phone"
                  type="tel"
                  defaultValue={editing?.phone ?? ''}
                  placeholder="06 12 34 56 78"
                  className={fieldClass}
                />
              </label>
              {!editing && (
                <label className="block text-sm text-cream/80">
                  Mot de passe
                  <input name="password" type="password" className={fieldClass} required />
                </label>
              )}
              {editing && (
                <label className="block text-sm text-cream/80">
                  Nouveau mot de passe
                  <input
                    name="password"
                    type="password"
                    placeholder="Laisser vide = inchangé"
                    className={fieldClass}
                  />
                </label>
              )}
              <label className="block text-sm text-cream/80">
                PIN appareil ({STAFF_PIN_LENGTH} chiffres)
                <input
                  name="pin"
                  inputMode="numeric"
                  pattern="\d{4}"
                  maxLength={STAFF_PIN_LENGTH}
                  minLength={STAFF_PIN_LENGTH}
                  placeholder={
                    selectedRole === ROLE.ADMIN
                      ? 'Optionnel pour admin'
                      : editing
                        ? 'Laisser vide = inchangé'
                        : 'Obligatoire caisse/cuisine'
                  }
                  className={fieldClass}
                  required={pinRequired}
                />
              </label>
              <label className="block text-sm text-cream/80">
                Rôle
                <select
                  name="role"
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className={adminSelectClass}
                >
                  {creatableRoles().map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </label>
              {selectedRole !== ROLE.ADMIN && (
                <label className="block text-sm text-cream/80">
                  Créneau par défaut
                  <select name="shiftId" defaultValue={editing?.shiftId ?? ''} className={adminSelectClass}>
                    <option value="">— Aucun —</option>
                    {shifts.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} · {shiftTimeLabel(s)}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <p className="text-xs text-cream/35">
                Caisse → POS · Cuisine → KDS · Livreur → app /livreur · Le créneau alimente le planning.
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-xl border border-white/15 px-4 py-2 text-sm text-cream/80"
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

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string
  value: number
  icon: typeof Users
  accent: string
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#1A1412]/60 p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-cream/40">{label}</p>
        <Icon className={cn('h-4 w-4', accent)} />
      </div>
      <p className={cn('mt-2 font-display text-2xl font-bold', accent)}>{value}</p>
    </div>
  )
}
