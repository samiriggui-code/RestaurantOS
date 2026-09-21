'use client'

import { useEffect, useState } from 'react'
import { useFeedbackState } from '@/lib/use-feedback-state'
import Link from 'next/link'
import { ExternalLink, Loader2, Save } from 'lucide-react'
import { DeviceDiagnosticsPanel } from '@/components/admin/DeviceDiagnosticsPanel'
import { DeviceLaunchCards } from '@/components/ops/DeviceLaunchCards'
import { getStaffSession, setKitchenDisplayEnabledCache } from '@/lib/staff-auth'
import { staffFetch } from '@/lib/staff-api'
import { getApiBase } from '@/lib/api-base'

type BusinessSettings = {
  kitchenDisplayEnabled?: boolean
  autoPrintOrders?: boolean
}

function deviceKitchenUrl() {
  if (typeof window === 'undefined') return '/kitchen'
  return `${window.location.origin}/kitchen`
}

export function AdminKitchenConfigView({ embedded = false }: { embedded?: boolean }) {
  const [business, setBusiness] = useState<BusinessSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const { error, setError, message, setMessage } = useFeedbackState()
  const [deviceUrl, setDeviceUrl] = useState('/kitchen')

  useEffect(() => {
    setDeviceUrl(deviceKitchenUrl())
    const session = getStaffSession('crm')
    if (!session) return
    staffFetch<BusinessSettings>('/settings', { token: session.token })
      .then(setBusiness)
      .catch((err) => setError(err instanceof Error ? err.message : 'Erreur'))
      .finally(() => setLoading(false))
  }, [])

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const session = getStaffSession('crm')
    if (!session) return
    setSaving(true)
    setError(null)
    setMessage(null)
    const form = new FormData(e.currentTarget)
    try {
      const updated = await staffFetch<BusinessSettings>('/settings', {
        method: 'PUT',
        token: session.token,
        body: JSON.stringify({
          kitchenDisplayEnabled: form.get('kitchenDisplayEnabled') === 'on',
        }),
      })
      setBusiness(updated)
      if (typeof updated.kitchenDisplayEnabled === 'boolean') {
        setKitchenDisplayEnabledCache(updated.kitchenDisplayEnabled)
      }
      setMessage('Paramètres écran cuisine enregistrés.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setSaving(false)
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
    <div className={embedded ? 'w-full space-y-6' : 'mx-auto max-w-2xl space-y-6 p-4 md:p-6'}>
      {!embedded && (
        <div>
          <h1 className="font-display text-2xl font-bold text-cream">Paramètres KDS</h1>
          <p className="text-sm text-cream/50">
            Configuration tablette boutique — le suivi live est dans l&apos;onglet « Vue d&apos;ensemble ».
          </p>
        </div>
      )}

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

      <DeviceLaunchCards compact />

      <section className="rounded-2xl border border-white/10 bg-[#1A1412] p-5">
        <h2 className="mb-2 font-semibold text-cream">URL tablette (réseau local)</h2>
        <p className="mb-3 text-sm text-cream/50">
          À saisir sur la tablette cuisine. Puis bouton « Plein écran » ou mode kiosque navigateur.
        </p>
        <code className="block break-all rounded-xl bg-black/30 px-3 py-2 text-sm text-tomato-light">
          {deviceUrl}
        </code>
        <p className="mt-2 text-xs text-cream/35">API détectée : {getApiBase()}</p>
      </section>

      <DeviceDiagnosticsPanel variant="kitchen" />

      <form onSubmit={(e) => void handleSave(e)} className="space-y-6">
        <section className="rounded-2xl border border-white/10 bg-[#1A1412] p-5">
          <h2 className="mb-4 font-semibold text-cream">Options</h2>
          <label className="flex items-center gap-3 text-sm">
            <input
              name="kitchenDisplayEnabled"
              type="checkbox"
              defaultChecked={business?.kitchenDisplayEnabled ?? true}
              className="h-4 w-4 rounded"
            />
            Écran cuisine activé (KDS)
          </label>
          <p className="mt-3 text-xs text-cream/40">
            Kanban 3 colonnes, archive 30 jours, tickets cuisine et étiquettes sac disponibles sur /kitchen.
          </p>
        </section>

        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl bg-tomato px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </form>

      <p className="text-xs text-cream/35">
        Historique des commandes passées →{' '}
        <Link href="/admin/orders" className="text-tomato-light hover:underline">
          Commandes
        </Link>
        {' · '}
        Suivi client par numéro → commandes en ligne avec token de suivi.
      </p>
    </div>
  )
}
