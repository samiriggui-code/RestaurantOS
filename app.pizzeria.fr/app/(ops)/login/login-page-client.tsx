'use client'

import { useEffect, useState } from 'react'
import { useFeedbackState } from '@/lib/use-feedback-state'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff, Loader2, LogIn } from 'lucide-react'
import { apiUrl } from '@/lib/api'
import { AuthBrandedLayout } from '@/components/auth/AuthBrandedLayout'
import { canAccessAdmin, homeRouteForRole } from '@/lib/roles'
import { roleLabel } from '@/lib/staff-display'
import {
  getRememberedCrmEmail,
  saveCrmSession,
  setRememberedCrmEmail,
} from '@/lib/staff-auth'

const DEV_MANAGER = {
  email: 'atmane.chennit@lazpizzafarguesainthilaire.com',
  password: 'admin123',
  label: 'Gérant (ADMIN)',
}

export default function LoginPageClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const { error, setError } = useFeedbackState()
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const remembered = getRememberedCrmEmail()
    if (remembered) {
      setEmail(remembered)
      setRememberMe(true)
    }
    if (process.env.NODE_ENV !== 'production') {
      setEmail(DEV_MANAGER.email)
      setPassword(DEV_MANAGER.password)
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(apiUrl('/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Échec connexion')

      if (!canAccessAdmin(data.user.role)) {
        throw new Error(
          `Ce compte (${roleLabel(data.user.role)}) utilise le PIN sur la caisse ou la cuisine — pas le CRM.`,
        )
      }

      saveCrmSession({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        business: data.business,
        user: data.user,
      })
      setRememberedCrmEmail(email, rememberMe)

      const next = searchParams.get('next')
      const target =
        next?.startsWith('/admin') && canAccessAdmin(data.user.role)
          ? next
          : homeRouteForRole(data.user.role)
      router.push(target)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur'
      if (msg === 'Failed to fetch' || msg.includes('NetworkError')) {
        setError(
          "L'API Express (port 3001) ne répond pas. Lancez npm run dev et attendez [server] prête.",
        )
      } else {
        setError(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  function prefillDev() {
    setEmail(DEV_MANAGER.email)
    setPassword(DEV_MANAGER.password)
  }

  return (
    <AuthBrandedLayout
      title="Connexion CRM"
      subtitle="Gérants & managers"
    >
      {process.env.NODE_ENV !== 'production' && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-100/90">
          <span className="font-medium">Dev :</span>
          <button
            type="button"
            onClick={prefillDev}
            className="rounded border border-amber-400/30 px-2 py-0.5 hover:bg-amber-500/15"
          >
            {DEV_MANAGER.label}
          </button>
        </div>
      )}

      {error && (
        <p className="mb-3 rounded-lg border border-red-500/30 bg-red-950/50 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <label className="block text-sm">
          <span className="text-cream/70">Email professionnel</span>
          <input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-xl border border-white/15 bg-charcoal px-3 py-2 text-cream outline-none focus:border-tomato/50"
            required
          />
        </label>

        <label className="block text-sm">
          <span className="text-cream/70">Mot de passe</span>
          <div className="relative mt-1">
            <input
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-charcoal px-3 py-2 pr-10 text-cream outline-none focus:border-tomato/50"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-cream/50 hover:bg-white/5"
              aria-label={showPassword ? 'Masquer' : 'Afficher'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </label>

        <label className="flex items-center gap-2 text-sm text-cream/60">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="rounded border-white/20"
          />
          Se souvenir de mon email
        </label>

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-tomato py-2 font-semibold text-white hover:bg-tomato-light disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogIn className="h-5 w-5" />}
          {loading ? 'Connexion…' : 'Se connecter'}
        </button>
      </form>

      <p className="mt-4 text-center text-[11px] text-cream/40">
        Caisse & cuisine boutique :{' '}
        <Link href="/pos" className="text-tomato-light/80 hover:underline">
          /pos
        </Link>
        {' · '}
        <Link href="/kitchen" className="text-tomato-light/80 hover:underline">
          /kitchen
        </Link>
        {' '}
        (PIN employé)
      </p>
    </AuthBrandedLayout>
  )
}
