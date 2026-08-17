'use client'

import { useEffect, useState } from 'react'
import { useFeedbackState } from '@/lib/use-feedback-state'
import { Loader2, Plus, RefreshCw, Trash2, Truck } from 'lucide-react'
import { eurosToCents, formatEUR } from '@/lib/money'
import { getStaffSession } from '@/lib/staff-auth'
import { staffFetch } from '@/lib/staff-api'
import { cn } from '@/lib/cn'
import { useAdminFeedback } from '@/components/admin/AdminFeedbackProvider'

type DeliveryZone = {
  id: string
  postalCode: string
  city: string | null
  feeCents: number
  minOrderCents: number
  isActive: boolean
  sortOrder: number
}

const fieldClass =
  'mt-1 w-full rounded-xl border border-white/15 bg-white/[0.03] px-3 py-2 text-sm text-cream outline-none focus:border-tomato/40'

export function AdminDeliveryZonesPanel() {
  const { confirm, notifySuccess } = useAdminFeedback()
  const [zones, setZones] = useState<DeliveryZone[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const { error, setError, message, setMessage } = useFeedbackState()
  const [showForm, setShowForm] = useState(false)
  const [testCp, setTestCp] = useState('33370')
  const [testCity, setTestCity] = useState('Fargues-Saint-Hilaire')
  const [testSubtotal, setTestSubtotal] = useState('30')
  const [testResult, setTestResult] = useState<string | null>(null)

  function load() {
    const session = getStaffSession('crm')
    if (!session) return
    setLoading(true)
    staffFetch<DeliveryZone[]>('/delivery/zones', { token: session.token })
      .then(setZones)
      .catch((err) => setError(err instanceof Error ? err.message : 'Erreur'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  async function handleSyncFlyer() {
    const session = getStaffSession('crm')
    if (!session) return
    setSaving(true)
    setError(null)
    try {
      const res = await staffFetch<{ zones: DeliveryZone[] }>('/delivery/zones/sync-flyer', {
        method: 'POST',
        token: session.token,
      })
      setZones(res.zones)
      setMessage('Zones du flyer réimportées.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync impossible')
    } finally {
      setSaving(false)
    }
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const session = getStaffSession('crm')
    if (!session) return
    const form = new FormData(e.currentTarget)
    setSaving(true)
    setError(null)
    try {
      await staffFetch('/delivery/zones', {
        method: 'POST',
        token: session.token,
        body: JSON.stringify({
          postalCode: form.get('postalCode'),
          city: form.get('city'),
          feeCents: eurosToCents(parseFloat(String(form.get('fee'))) || 0),
          minOrderCents: eurosToCents(parseFloat(String(form.get('minOrder'))) || 0),
          sortOrder: Number(form.get('sortOrder')) || 0,
          isActive: true,
        }),
      })
      setShowForm(false)
      setMessage('Zone ajoutée.')
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Création impossible')
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(zone: DeliveryZone) {
    const session = getStaffSession('crm')
    if (!session) return
    try {
      await staffFetch(`/delivery/zones/${zone.id}`, {
        method: 'PUT',
        token: session.token,
        body: JSON.stringify({ isActive: !zone.isActive }),
      })
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Mise à jour impossible')
    }
  }

  async function handleDelete(id: string) {
    if (
      !(await confirm({
        title: 'Supprimer la zone',
        message: 'Supprimer cette zone de livraison ?',
        confirmLabel: 'Supprimer',
        destructive: true,
      }))
    ) {
      return
    }
    const session = getStaffSession('crm')
    if (!session) return
    try {
      await staffFetch(`/delivery/zones/${id}`, { method: 'DELETE', token: session.token })
      notifySuccess('Zone supprimée.')
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Suppression impossible')
    }
  }

  async function runQuoteTest() {
    const session = getStaffSession('crm')
    if (!session) return
    setTestResult(null)
    try {
      const params = new URLSearchParams({
        postalCode: testCp,
        city: testCity,
        subtotal: testSubtotal,
      })
      const res = await staffFetch<{ ok: boolean; fee: number; minOrder: number; zoneLabel: string; error?: string }>(
        `/delivery/quote/test?${params}`,
        { token: session.token },
      )
      if (res.ok) {
        setTestResult(`OK — ${res.zoneLabel} · frais ${res.fee.toFixed(2)} € · min. ${res.minOrder.toFixed(2)} €`)
      } else {
        setTestResult(res.error ?? 'Refusé')
      }
    } catch (err) {
      setTestResult(err instanceof Error ? err.message : 'Erreur test')
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-tomato-light" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => void handleSyncFlyer()}
          className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm hover:bg-white/5"
        >
          <RefreshCw className={cn('h-4 w-4', saving && 'animate-spin')} />
          Importer flyer
        </button>
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-tomato px-4 py-2 text-sm font-semibold text-white"
        >
          <Plus className="h-4 w-4" />
          Ajouter une zone
        </button>
      </div>

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
        <h2 className="mb-3 font-semibold text-cream">Tester un devis</h2>
        <div className="grid gap-3 sm:grid-cols-4">
          <label className="text-xs text-cream/50">
            Code postal
            <input className={fieldClass} value={testCp} onChange={(e) => setTestCp(e.target.value)} />
          </label>
          <label className="text-xs text-cream/50 sm:col-span-2">
            Commune
            <input className={fieldClass} value={testCity} onChange={(e) => setTestCity(e.target.value)} />
          </label>
          <label className="text-xs text-cream/50">
            Montant pizzas (€)
            <input className={fieldClass} value={testSubtotal} onChange={(e) => setTestSubtotal(e.target.value)} />
          </label>
        </div>
        <button
          type="button"
          onClick={() => void runQuoteTest()}
          className="mt-3 rounded-xl border border-white/15 px-4 py-2 text-sm hover:bg-white/5"
        >
          Calculer le devis
        </button>
        {testResult && <p className="mt-2 text-sm text-cream/70">{testResult}</p>}
      </section>

      <div className="overflow-hidden rounded-2xl border border-white/10">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/5 text-cream/45">
            <tr>
              <th className="px-4 py-3">Commune</th>
              <th className="px-4 py-3">CP</th>
              <th className="px-4 py-3">Min. commande</th>
              <th className="px-4 py-3">Frais</th>
              <th className="px-4 py-3">Actif</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {zones.map((z) => (
              <tr key={z.id} className="border-t border-white/5 hover:bg-white/[0.02]">
                <td className="px-4 py-3 font-medium text-cream">{z.city ?? '—'}</td>
                <td className="px-4 py-3 text-cream/70">{z.postalCode}</td>
                <td className="px-4 py-3">{formatEUR(z.minOrderCents)}</td>
                <td className="px-4 py-3 text-tomato-light">{formatEUR(z.feeCents)}</td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => void toggleActive(z)}
                    className={cn(
                      'rounded-full px-2.5 py-0.5 text-xs font-semibold',
                      z.isActive ? 'bg-emerald-500/15 text-emerald-200' : 'bg-white/10 text-cream/40',
                    )}
                  >
                    {z.isActive ? 'Oui' : 'Non'}
                  </button>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => void handleDelete(z.id)}
                    className="text-red-400 hover:text-red-300"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
            {zones.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-cream/40">
                  <Truck className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  Aucune zone — cliquez « Importer flyer »
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <form
            onSubmit={(e) => void handleCreate(e)}
            className="w-full max-w-md rounded-2xl border border-white/10 bg-[#1A1412] p-6"
          >
            <h3 className="mb-4 font-semibold text-cream">Nouvelle zone</h3>
            <div className="space-y-3">
              <label className="block text-xs text-cream/50">
                Commune
                <input name="city" required className={fieldClass} />
              </label>
              <label className="block text-xs text-cream/50">
                Code postal
                <input name="postalCode" required maxLength={5} className={fieldClass} />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs text-cream/50">
                  Min. commande (€)
                  <input name="minOrder" type="number" step="0.01" min="0" defaultValue="25" className={fieldClass} />
                </label>
                <label className="block text-xs text-cream/50">
                  Frais livraison (€)
                  <input name="fee" type="number" step="0.01" min="0" defaultValue="4.5" className={fieldClass} />
                </label>
              </div>
              <label className="block text-xs text-cream/50">
                Ordre d&apos;affichage
                <input name="sortOrder" type="number" defaultValue="0" className={fieldClass} />
              </label>
            </div>
            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="flex-1 rounded-xl border border-white/15 py-2 text-sm"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 rounded-xl bg-tomato py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving ? '…' : 'Enregistrer'}
              </button>
            </div>
          </form>
        </div>
      )}

      <p className="text-xs text-cream/35">
        {zones.filter((z) => z.isActive).length} zone(s) active(s) — appliquées au checkout en ligne.
      </p>
    </div>
  )
}
