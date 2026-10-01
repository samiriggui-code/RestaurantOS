'use client'

import { useEffect, useState } from 'react'
import { useFeedbackState } from '@/lib/use-feedback-state'
import Link from 'next/link'
import { ExternalLink, Loader2, Save } from 'lucide-react'
import { DeviceDiagnosticsPanel } from '@/components/admin/DeviceDiagnosticsPanel'
import { AdminPrintJobsPanel } from '@/components/admin/AdminPrintJobsPanel'
import { DeviceLaunchCards } from '@/components/ops/DeviceLaunchCards'
import { getStaffSession } from '@/lib/staff-auth'
import { staffFetch } from '@/lib/staff-api'
import { getApiBase } from '@/lib/api-base'
import { isModuleEnabled } from '@/lib/modules'

type BusinessSettings = {
  autoPrintOrders?: boolean
  kitchenDisplayEnabled?: boolean
}

function deviceOpsUrl(path: string) {
  if (typeof window === 'undefined') return path
  return `${window.location.origin}${path}`
}

export function AdminPosConfigView({ embedded = false }: { embedded?: boolean }) {
  const [business, setBusiness] = useState<BusinessSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const { error, setError, message, setMessage } = useFeedbackState()
  const [posUrl, setPosUrl] = useState('/pos')
  const [kitchenUrl, setKitchenUrl] = useState('/kitchen')

  useEffect(() => {
    setPosUrl(deviceOpsUrl('/pos'))
    setKitchenUrl(deviceOpsUrl('/kitchen'))
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
          autoPrintOrders: form.get('autoPrintOrders') === 'on',
        }),
      })
      setBusiness(updated)
      setMessage('Paramètres caisse enregistrés.')
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
          <h1 className="font-display text-2xl font-bold text-cream">Paramètres caisse</h1>
          <p className="text-sm text-cream/50">
            {isModuleEnabled('pos')
              ? 'Configuration terminal SUNMI — le suivi live est dans l’onglet « Suivi live ».'
              : 'Impression et écran cuisine — le suivi des ventes comptoir SumUp est dans l’onglet « Suivi live ».'}
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

      <section className="rounded-2xl border border-white/10 bg-[#1A1412] p-5 space-y-4">
        {isModuleEnabled('pos') && (
          <div>
            <h2 className="mb-2 font-semibold text-cream">URL terminal boutique (SUNMI)</h2>
            <p className="mb-3 text-sm text-cream/50">
              L&apos;APK WebView (<code className="text-cream/70">android/</code>) charge cette URL
              en plein écran. Commandes comptoir, réception des commandes internet, impression
              tickets.
            </p>
            <code className="block break-all rounded-xl bg-black/30 px-3 py-2 text-sm text-tomato-light">
              {posUrl}
            </code>
            <Link
              href="/pos"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-2 text-sm text-tomato-light hover:underline"
            >
              <ExternalLink className="h-4 w-4" />
              Tester sur tablette boutique (PIN)
            </Link>
          </div>
        )}

        <div className={isModuleEnabled('pos') ? 'border-t border-white/10 pt-4' : undefined}>
          <h3 className="mb-2 text-sm font-semibold text-cream">Écran cuisine (KDS) — même réseau</h3>
          <code className="block break-all rounded-xl bg-black/30 px-3 py-2 text-sm text-blue-300/90">
            {kitchenUrl}
          </code>
          <p className="mt-2 text-xs text-cream/40">
            KDS {business?.kitchenDisplayEnabled !== false ? 'activé' : 'désactivé'} — les deux
            terminaux partagent l&apos;API {getApiBase()} et les événements Socket.
          </p>
        </div>
      </section>

      <DeviceDiagnosticsPanel variant="pos" />

      <form onSubmit={(e) => void handleSave(e)} className="space-y-6">
        <section className="rounded-2xl border border-white/10 bg-[#1A1412] p-5">
          <h2 className="mb-4 font-semibold text-cream">Impression &amp; file</h2>
          <label className="flex items-center gap-3 text-sm">
            <input
              name="autoPrintOrders"
              type="checkbox"
              defaultChecked={business?.autoPrintOrders ?? true}
              className="h-4 w-4 rounded"
            />
            Impression automatique à la confirmation (commandes internet + comptoir)
          </label>
          <p className="mt-3 text-xs text-cream/40">
            Ticket cuisine, étiquette sac et reçu client via pont SUNMI{' '}
            <code>window.SunmiPrinter</code> ou fenêtre d&apos;impression navigateur (Epson réseau).
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

      <AdminPrintJobsPanel />

      <p className="text-xs text-cream/35">
        Historique des ventes comptoir →{' '}
        <Link href="/admin/pos" className="text-tomato-light hover:underline">
          Suivi caisse
        </Link>
        {' · '}
        Paramètres KDS →{' '}
        <Link href="/admin/kitchen" className="text-tomato-light hover:underline">
          Écran cuisine
        </Link>
      </p>
    </div>
  )
}
