'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { AlertTriangle, CheckCircle2, Info, Loader2, X, XCircle } from 'lucide-react'
import { cn } from '@/lib/cn'
import { playUISound, type UISoundKind } from '@/lib/ui-sounds'

export type ConfirmOptions = {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
}

export type FeedbackToast = {
  id: string
  kind: 'success' | 'error' | 'info' | 'warning'
  title: string
  detail?: string
}

type AppFeedbackContextValue = {
  confirm: (options: ConfirmOptions) => Promise<boolean>
  notify: (kind: FeedbackToast['kind'], title: string, detail?: string) => void
  notifySuccess: (title: string, detail?: string) => void
  notifyError: (title: string, detail?: string) => void
  notifyInfo: (title: string, detail?: string) => void
  notifyWarning: (title: string, detail?: string) => void
}

const TOAST_DURATION_MS = 6000

const AppFeedbackContext = createContext<AppFeedbackContextValue | null>(null)

const TOAST_STYLES: Record<
  FeedbackToast['kind'],
  { border: string; ring: string; icon: typeof CheckCircle2; iconClass: string }
> = {
  success: {
    border: 'border-emerald-500/40',
    ring: 'ring-emerald-500/20',
    icon: CheckCircle2,
    iconClass: 'text-emerald-400',
  },
  error: {
    border: 'border-red-500/40',
    ring: 'ring-red-500/20',
    icon: XCircle,
    iconClass: 'text-red-400',
  },
  warning: {
    border: 'border-amber-500/40',
    ring: 'ring-amber-500/20',
    icon: AlertTriangle,
    iconClass: 'text-amber-400',
  },
  info: {
    border: 'border-sky-500/40',
    ring: 'ring-sky-500/20',
    icon: Info,
    iconClass: 'text-sky-400',
  },
}

function soundForKind(kind: FeedbackToast['kind']): UISoundKind | null {
  if (kind === 'success') return 'success'
  if (kind === 'error') return 'error'
  if (kind === 'warning') return 'warning'
  return null
}

export function AppFeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<FeedbackToast[]>([])
  const [confirmState, setConfirmState] = useState<(ConfirmOptions & { resolving: boolean }) | null>(
    null,
  )
  const confirmResolver = useRef<((value: boolean) => void) | null>(null)

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const notify = useCallback(
    (kind: FeedbackToast['kind'], title: string, detail?: string) => {
      const id = `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      const sound = soundForKind(kind)
      if (sound) playUISound(sound)
      setToasts((prev) => [{ id, kind, title, detail }, ...prev].slice(0, 5))
      window.setTimeout(() => dismissToast(id), TOAST_DURATION_MS)
    },
    [dismissToast],
  )

  const notifySuccess = useCallback(
    (title: string, detail?: string) => notify('success', title, detail),
    [notify],
  )
  const notifyError = useCallback(
    (title: string, detail?: string) => notify('error', title, detail),
    [notify],
  )
  const notifyInfo = useCallback(
    (title: string, detail?: string) => notify('info', title, detail),
    [notify],
  )
  const notifyWarning = useCallback(
    (title: string, detail?: string) => notify('warning', title, detail),
    [notify],
  )

  const resolveConfirm = useCallback((value: boolean) => {
    confirmResolver.current?.(value)
    confirmResolver.current = null
    setConfirmState(null)
  }, [])

  const confirm = useCallback((options: ConfirmOptions) => {
    playUISound('warning')
    return new Promise<boolean>((resolve) => {
      confirmResolver.current = resolve
      setConfirmState({ ...options, resolving: false })
    })
  }, [])

  const handleConfirm = useCallback(() => {
    if (!confirmState || confirmState.resolving) return
    setConfirmState((s) => (s ? { ...s, resolving: true } : s))
    resolveConfirm(true)
  }, [confirmState, resolveConfirm])

  const value = useMemo(
    () => ({
      confirm,
      notify,
      notifySuccess,
      notifyError,
      notifyInfo,
      notifyWarning,
    }),
    [confirm, notify, notifySuccess, notifyError, notifyInfo, notifyWarning],
  )

  return (
    <AppFeedbackContext.Provider value={value}>
      {children}

      {toasts.length > 0 && (
        <div className="pointer-events-none fixed bottom-4 left-4 z-[60] flex w-full max-w-sm flex-col gap-2 px-4 sm:px-0">
          {toasts.map((toast) => {
            const style = TOAST_STYLES[toast.kind]
            const Icon = style.icon
            return (
              <div
                key={toast.id}
                className={cn(
                  'pointer-events-auto animate-fade-up rounded-xl border bg-[#1A1412] p-4 shadow-2xl shadow-black/50 ring-1',
                  style.border,
                  style.ring,
                )}
                role="status"
              >
                <div className="flex items-start gap-3">
                  <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', style.iconClass)} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-cream">{toast.title}</p>
                    {toast.detail && <p className="mt-1 text-xs text-cream/55">{toast.detail}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => dismissToast(toast.id)}
                    className="rounded-lg p-1 text-cream/40 hover:bg-white/10 hover:text-cream"
                    aria-label="Fermer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {confirmState && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4">
          <div
            className="w-full max-w-md rounded-2xl border border-white/10 bg-[#1A1412] p-6 shadow-2xl"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="app-confirm-title"
            aria-describedby="app-confirm-message"
          >
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                  confirmState.destructive ? 'bg-red-500/15' : 'bg-amber-500/15',
                )}
              >
                <AlertTriangle
                  className={cn(
                    'h-5 w-5',
                    confirmState.destructive ? 'text-red-400' : 'text-amber-400',
                  )}
                />
              </div>
              <div className="min-w-0 flex-1">
                <h3 id="app-confirm-title" className="font-semibold text-cream">
                  {confirmState.title}
                </h3>
                <p id="app-confirm-message" className="mt-2 text-sm text-cream/60">
                  {confirmState.message}
                </p>
              </div>
            </div>
            <div className="mt-6 flex gap-2">
              <button
                type="button"
                disabled={confirmState.resolving}
                onClick={() => resolveConfirm(false)}
                className="flex-1 rounded-xl border border-white/15 py-2.5 text-sm font-medium text-cream/80 hover:bg-white/5 disabled:opacity-50"
              >
                {confirmState.cancelLabel ?? 'Annuler'}
              </button>
              <button
                type="button"
                disabled={confirmState.resolving}
                onClick={handleConfirm}
                className={cn(
                  'flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-50',
                  confirmState.destructive
                    ? 'bg-red-600 hover:bg-red-500'
                    : 'bg-tomato hover:bg-tomato/90',
                )}
              >
                {confirmState.resolving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                {confirmState.confirmLabel ?? 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppFeedbackContext.Provider>
  )
}

export function useAppFeedback() {
  const ctx = useContext(AppFeedbackContext)
  if (!ctx) throw new Error('useAppFeedback must be used within AppFeedbackProvider')
  return ctx
}
