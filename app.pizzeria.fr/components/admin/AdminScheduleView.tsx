'use client'

import { useEffect, useState } from 'react'
import { useFeedbackState } from '@/lib/use-feedback-state'
import { Loader2, Plus, Save, Trash2 } from 'lucide-react'
import { getStaffSession } from '@/lib/staff-auth'
import { staffFetch } from '@/lib/staff-api'

type TimeSlotRow = {
  id?: string
  dayOfWeek: number
  startTime: string
  endTime: string
  capacity: number
  isActive: boolean
}

type ScheduleData = {
  hours: { open: number; close: number; daysOpen?: number }
  exceptionalClosures: Array<{ date: string; reason?: string }>
  slotCapacity: number
  timeSlots?: TimeSlotRow[]
}

const DAY_LABELS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']

const fieldClass =
  'mt-1 w-full rounded-xl border border-white/15 bg-white/[0.03] px-3 py-2 text-sm text-cream outline-none focus:border-tomato/40'

export function AdminScheduleView() {
  const [data, setData] = useState<ScheduleData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const { error, setError, message, setMessage } = useFeedbackState()

  useEffect(() => {
    const session = getStaffSession()
    if (!session) return
    staffFetch<ScheduleData>('/settings/schedule', { token: session.token })
      .then((payload) => {
        setData({
          ...payload,
          timeSlots:
            payload.timeSlots?.length
              ? payload.timeSlots.map((s) => ({ ...s, isActive: s.isActive ?? true }))
              : DAY_LABELS.map((_, dayOfWeek) => ({
                  dayOfWeek,
                  startTime: '18:00',
                  endTime: '22:00',
                  capacity: payload.slotCapacity ?? 10,
                  isActive: true,
                })),
        })
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Erreur'))
      .finally(() => setLoading(false))
  }, [])

  function updateClosure(index: number, patch: Partial<{ date: string; reason?: string }>) {
    if (!data) return
    const closures = [...data.exceptionalClosures]
    closures[index] = { ...closures[index], ...patch }
    setData({ ...data, exceptionalClosures: closures })
  }

  function addClosure() {
    if (!data) return
    setData({
      ...data,
      exceptionalClosures: [...data.exceptionalClosures, { date: '', reason: '' }],
    })
  }

  function removeClosure(index: number) {
    if (!data) return
    setData({
      ...data,
      exceptionalClosures: data.exceptionalClosures.filter((_, i) => i !== index),
    })
  }

  function updateSlot(index: number, patch: Partial<TimeSlotRow>) {
    if (!data?.timeSlots) return
    const timeSlots = [...data.timeSlots]
    timeSlots[index] = { ...timeSlots[index], ...patch }
    setData({ ...data, timeSlots })
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const session = getStaffSession()
    if (!session || !data) return
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      const updated = await staffFetch<ScheduleData>('/settings/schedule', {
        method: 'PUT',
        token: session.token,
        body: JSON.stringify({
          hours: data.hours,
          exceptionalClosures: data.exceptionalClosures.filter((c) => c.date.trim()),
          slotCapacity: data.slotCapacity,
          timeSlots: data.timeSlots,
        }),
      })
      setData(updated)
      setMessage('Horaires et créneaux enregistrés.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-tomato-light" />
      </div>
    )
  }

  if (!data) return null

  return (
    <form onSubmit={(e) => void handleSave(e)} className="space-y-6">
      {message && (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-200">
          {message}
        </p>
      )}
      {error && (
        <p className="rounded-xl border border-red-500/30 bg-red-950/40 px-4 py-2 text-sm text-red-200">
          {error}
        </p>
      )}

      <section className="rounded-2xl border border-white/10 bg-[#1A1412] p-5">
        <h2 className="mb-4 font-semibold text-cream">Horaires d&apos;ouverture</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block text-sm text-cream/70">
            Ouverture (h)
            <input
              type="number"
              min={0}
              max={23}
              value={data.hours.open}
              onChange={(e) =>
                setData({ ...data, hours: { ...data.hours, open: parseInt(e.target.value, 10) || 0 } })
              }
              className={fieldClass}
            />
          </label>
          <label className="block text-sm text-cream/70">
            Fermeture (h)
            <input
              type="number"
              min={1}
              max={24}
              value={data.hours.close}
              onChange={(e) =>
                setData({ ...data, hours: { ...data.hours, close: parseInt(e.target.value, 10) || 22 } })
              }
              className={fieldClass}
            />
          </label>
          <label className="block text-sm text-cream/70">
            Capacité / créneau 15 min (défaut)
            <input
              type="number"
              min={1}
              max={99}
              value={data.slotCapacity}
              onChange={(e) =>
                setData({ ...data, slotCapacity: parseInt(e.target.value, 10) || 10 })
              }
              className={fieldClass}
            />
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#1A1412] p-5">
        <h2 className="mb-2 font-semibold text-cream">Créneaux par jour (BDD)</h2>
        <p className="mb-4 text-xs text-cream/45">
          Capacité click & collect par jour — utilisée si un créneau actif existe en base (sinon capacité
          par défaut ci-dessus).
        </p>
        <div className="space-y-2">
          {data.timeSlots?.map((slot, index) => (
            <div
              key={slot.id ?? `day-${slot.dayOfWeek}`}
              className="grid gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-3 sm:grid-cols-[1fr_1fr_1fr_1fr_auto]"
            >
              <span className="self-center text-sm font-medium text-cream/80">
                {DAY_LABELS[slot.dayOfWeek] ?? `Jour ${slot.dayOfWeek}`}
              </span>
              <label className="text-xs text-cream/50">
                Début
                <input
                  type="time"
                  value={slot.startTime}
                  onChange={(e) => updateSlot(index, { startTime: e.target.value })}
                  className={fieldClass}
                />
              </label>
              <label className="text-xs text-cream/50">
                Fin
                <input
                  type="time"
                  value={slot.endTime}
                  onChange={(e) => updateSlot(index, { endTime: e.target.value })}
                  className={fieldClass}
                />
              </label>
              <label className="text-xs text-cream/50">
                Capacité
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={slot.capacity}
                  onChange={(e) => updateSlot(index, { capacity: parseInt(e.target.value, 10) || 1 })}
                  className={fieldClass}
                />
              </label>
              <label className="flex items-center gap-2 self-center text-xs text-cream/60">
                <input
                  type="checkbox"
                  checked={slot.isActive}
                  onChange={(e) => updateSlot(index, { isActive: e.target.checked })}
                  className="h-4 w-4 rounded border-white/20"
                />
                Actif
              </label>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#1A1412] p-5">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="font-semibold text-cream">Fermetures exceptionnelles</h2>
          <button
            type="button"
            onClick={addClosure}
            className="inline-flex items-center gap-1 rounded-lg border border-white/15 px-3 py-1.5 text-xs text-cream/80 hover:bg-white/5"
          >
            <Plus className="h-3.5 w-3.5" />
            Ajouter
          </button>
        </div>
        {data.exceptionalClosures.length === 0 ? (
          <p className="text-sm text-cream/45">Aucune fermeture planifiée.</p>
        ) : (
          <ul className="space-y-3">
            {data.exceptionalClosures.map((closure, index) => (
              <li key={index} className="flex flex-wrap items-end gap-3">
                <label className="block min-w-[140px] flex-1 text-sm text-cream/70">
                  Date
                  <input
                    type="date"
                    value={closure.date}
                    onChange={(e) => updateClosure(index, { date: e.target.value })}
                    className={fieldClass}
                  />
                </label>
                <label className="block min-w-[180px] flex-[2] text-sm text-cream/70">
                  Motif (optionnel)
                  <input
                    value={closure.reason ?? ''}
                    onChange={(e) => updateClosure(index, { reason: e.target.value })}
                    placeholder="Ex. congés annuels"
                    className={fieldClass}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => removeClosure(index)}
                  className="rounded-lg p-2 text-cream/40 hover:bg-red-500/10 hover:text-red-300"
                  aria-label="Supprimer"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <button
        type="submit"
        disabled={saving}
        className="inline-flex items-center gap-2 rounded-xl bg-tomato px-5 py-2.5 text-sm font-bold text-white hover:bg-tomato-light disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Enregistrer les horaires
      </button>
    </form>
  )
}
