'use client'

import { Suspense, useEffect, useState } from 'react'
import { useFeedbackState } from '@/lib/use-feedback-state'
import { useSearchParams } from 'next/navigation'
import { Loader2, Wifi } from 'lucide-react'
import { apiUrl } from '@/lib/api'

function WifiConnectContent() {
  const params = useSearchParams()
  const code = params.get('code') ?? ''
  const [loading, setLoading] = useState(true)
  const { error, setError } = useFeedbackState()
  const [session, setSession] = useState<{ endTime: string; durationMinutes: number } | null>(null)
  const [phone, setPhone] = useState('')

  useEffect(() => {
    if (!code) {
      setError('Code WiFi manquant — scannez le QR depuis le restaurant.')
      setLoading(false)
      return
    }
    setLoading(false)
  }, [code])

  async function connect(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(apiUrl('/wifi/connect'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, phoneNumber: phone || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Connexion impossible')
      setSession(data.session)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setLoading(false)
    }
  }

  if (session) {
    return (
      <div className="mx-auto max-w-md space-y-4 px-4 py-16 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/20">
          <Wifi className="h-8 w-8 text-emerald-400" />
        </div>
        <h1 className="font-display text-2xl font-bold text-cream">WiFi activé</h1>
        <p className="text-sm text-cream/60">
          Accès {session.durationMinutes} min — jusqu&apos;à{' '}
          {new Date(session.endTime).toLocaleTimeString('fr-FR')}.
        </p>
        <p className="text-xs text-cream/40">
          Connectez-vous au réseau invité du restaurant. L&apos;accès box sera branché en production.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md space-y-6 px-4 py-16">
      <div className="text-center">
        <h1 className="font-display text-2xl font-bold text-cream">WiFi invité</h1>
        <p className="mt-2 text-sm text-cream/60">La Z Pizza — accès internet temporaire</p>
      </div>

      {error && (
        <p className="rounded-xl border border-red-500/30 bg-red-950/40 px-4 py-3 text-sm text-red-200">{error}</p>
      )}

      {code && (
        <form onSubmit={(e) => void connect(e)} className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <p className="text-xs text-cream/40">Code : {code}</p>
          <label className="block text-sm">
            <span className="text-cream/60">Téléphone (optionnel)</span>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/15 bg-charcoal px-3 py-2"
              placeholder="06…"
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-tomato py-2.5 font-semibold text-white disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Wifi className="h-5 w-5" />}
            Activer l&apos;accès
          </button>
        </form>
      )}
    </div>
  )
}

export default function WifiPublicPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-tomato-light" />
        </div>
      }
    >
      <WifiConnectContent />
    </Suspense>
  )
}
