'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Bell, ChevronDown, Loader2, RefreshCw, Wifi, WifiOff, X } from 'lucide-react'
import { useAdminLive } from '@/components/admin/AdminLiveProvider'
import { cn } from '@/lib/cn'

function formatTime(d: Date | null) {
  if (!d) return '—'
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export function AdminLiveToolbar() {
  const {
    connected,
    refreshing,
    lastSyncAt,
    unreadCount,
    activities,
    toasts,
    refreshAll,
    markActivitiesRead,
    dismissToast,
  } = useAdminLive()
  const [open, setOpen] = useState(false)

  return (
    <>
      {toasts.length > 0 && (
        <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2 px-4 sm:px-0">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className="pointer-events-auto animate-fade-up rounded-xl border border-tomato/40 bg-[#1A1412] p-4 shadow-2xl shadow-black/50 ring-1 ring-tomato/20"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-cream">{toast.title}</p>
                  {toast.detail && <p className="mt-1 text-xs text-cream/55">{toast.detail}</p>}
                  <Link
                    href="/admin/orders"
                    className="mt-2 inline-block text-xs font-semibold text-tomato-light hover:underline"
                  >
                    Voir les commandes →
                  </Link>
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
          ))}
        </div>
      )}

      <div className="sticky top-0 z-20 border-b border-white/10 bg-charcoal/95 backdrop-blur-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
        <div className="flex items-center gap-2 text-xs text-cream/50">
          {connected ? (
            <Wifi className="h-3.5 w-3.5 text-emerald-400" />
          ) : (
            <WifiOff className="h-3.5 w-3.5 text-red-400" />
          )}
          <span>{connected ? 'Temps réel actif' : 'Hors ligne — actualisez manuellement'}</span>
          <span className="hidden text-cream/30 sm:inline">·</span>
          <span className="hidden sm:inline">Dernière sync {formatTime(lastSyncAt)}</span>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setOpen((v) => !v)
                markActivitiesRead()
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 px-3 py-1.5 text-xs font-medium text-cream/70 hover:bg-white/5"
            >
              <Bell className="h-3.5 w-3.5" />
              Activité
              {unreadCount > 0 && (
                <span className="rounded-full bg-tomato px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
              <ChevronDown className={cn('h-3.5 w-3.5 transition', open && 'rotate-180')} />
            </button>

            {open && (
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-10"
                  aria-label="Fermer"
                  onClick={() => setOpen(false)}
                />
                <div className="absolute right-0 z-20 mt-1 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-white/10 bg-[#1A1412] shadow-xl">
                  <div className="border-b border-white/10 px-3 py-2 text-xs font-semibold text-cream/60">
                    Opérations du service
                  </div>
                  <ul className="max-h-64 overflow-y-auto p-2">
                    {activities.length === 0 ? (
                      <li className="px-2 py-6 text-center text-xs text-cream/35">
                        Aucune activité — commandes, stock et dépenses apparaîtront ici
                      </li>
                    ) : (
                      activities.map((a) => (
                        <li
                          key={a.id}
                          className="rounded-lg px-2 py-2 text-xs hover:bg-white/[0.03]"
                        >
                          <p className="font-medium text-cream">{a.title}</p>
                          {a.detail && <p className="text-cream/45">{a.detail}</p>}
                          <p className="mt-0.5 text-[10px] text-cream/30">
                            {new Date(a.at).toLocaleTimeString('fr-FR')}
                          </p>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              </>
            )}
          </div>

          <button
            type="button"
            disabled={refreshing}
            onClick={() => void refreshAll()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-tomato/90 px-3 py-1.5 text-xs font-semibold text-white hover:bg-tomato disabled:opacity-50"
          >
            {refreshing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Actualiser
          </button>
        </div>
      </div>
    </div>
    </>
  )
}
