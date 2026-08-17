import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import toast from 'react-hot-toast'
import { Pizza, Eye, EyeOff, LogIn, Lock, Mail, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export default function LoginPage() {
  const [email, setEmail] = useState('admin@cafe.com')
  const [password, setPassword] = useState('admin123')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const { t } = useTranslation()
  const { login } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()

  const from = (location.state as { from?: { pathname?: string } })?.from?.pathname || '/admin'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      toast.error(`${t('login.email')} / ${t('login.password')}`)
      return
    }
    setLoading(true)
    try {
      await login(email.trim(), password)
      toast.success(t('login.success'))
      navigate(from, { replace: true })
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('login.button'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="relative min-h-screen bg-charcoal bg-hero-glow bg-grain flex items-center justify-center p-5"
      dir="auto"
    >
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-tomato/15 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-tomato-dark/20 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mb-5 inline-flex h-20 w-20 animate-bounce-in items-center justify-center rounded-3xl bg-gradient-to-br from-tomato to-tomato-dark shadow-2xl shadow-primary-500/30">
            <Pizza size={36} className="text-white" />
          </div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-cream">{t('app.name')}</h1>
          <div className="mt-2 flex items-center justify-center gap-1.5">
            <Sparkles size={14} className="text-tomato-light" />
            <p className="text-sm text-cream/55">{t('app.tagline')}</p>
            <Sparkles size={14} className="text-tomato-light" />
          </div>
        </div>

        <div className="rounded-4xl border border-white/10 bg-charcoal-soft/90 p-8 shadow-2xl backdrop-blur-xl">
          <div className="mb-7">
            <h2 className="font-display text-lg font-bold text-cream">{t('login.title')}</h2>
            <p className="text-xs text-cream/45">{t('login.subtitle')}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-cream/70">{t('login.email')}</label>
              <div className="relative group">
                <Mail
                  size={16}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-cream/35 group-focus-within:text-tomato-light transition-colors"
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-2xl border-2 border-white/10 bg-white/5 py-3.5 pr-12 pl-4 text-cream placeholder:text-cream/30 focus:border-tomato focus:bg-white/10 focus:outline-none transition-all"
                  placeholder="admin@cafe.com"
                  dir="ltr"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-cream/70">{t('login.password')}</label>
              <div className="relative group">
                <Lock
                  size={16}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-cream/35 group-focus-within:text-tomato-light transition-colors"
                />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-2xl border-2 border-white/10 bg-white/5 py-3.5 pr-12 pl-12 text-cream placeholder:text-cream/30 focus:border-tomato focus:bg-white/10 focus:outline-none transition-all"
                  placeholder="••••••••"
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 p-1 text-cream/45 hover:text-cream transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2.5 py-3.5 text-base">
              {loading ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                <>
                  <LogIn size={18} />
                  {t('login.button')}
                </>
              )}
            </button>
          </form>

          <div className="mt-6 rounded-2xl border border-white/5 bg-white/5 p-4">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-cream/45">
              <Sparkles size={12} className="text-tomato-light" />
              {t('login.test_credentials')}
            </p>
            <p className="text-xs text-cream/55" dir="ltr">
              admin@cafe.com / admin123
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
