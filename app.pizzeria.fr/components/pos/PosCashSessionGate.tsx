'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Loader2, Wallet } from 'lucide-react'
import { getStaffSession, type AuthScope } from '@/lib/staff-auth'
import { fetchCurrentPosSession, type PosSession } from '@/lib/pos-session-api'
import { PosOpeningDialog } from '@/components/pos/PosOpeningDialog'
import { formatEUR } from '@/lib/money'

type Props = {
  children: ReactNode
  /** Scope de session staff à vérifier — 'device' (tablette comptoir) par défaut, 'crm' pour le moniteur admin. */
  authScope?: AuthScope
}

/**
 * Gate caisse : bloque la prise de commande tant qu'aucune session OPEN
 * n'existe pour le caissier connecté (spec Phase E / URY).
 */
export function PosCashSessionGate({ children, authScope = 'device' }: Props) {
  const [session, setSession] = useState<PosSession | null | undefined>(undefined)
  const [dialogOpen, setDialogOpen] = useState(false)

  const reload = useCallback(async () => {
    const staff = getStaffSession(authScope)
    if (!staff) {
      setSession(null)
      return
    }
    try {
      setSession(await fetchCurrentPosSession(staff.token))
    } catch {
      setSession(null)
    }
  }, [authScope])

  useEffect(() => {
    void reload()
  }, [reload])

  if (session === undefined) {
    return (
      <div className="flex h-full items-center justify-center bg-charcoal">
        <Loader2 className="h-8 w-8 animate-spin text-tomato-light" />
      </div>
    )
  }

  if (!session) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-5 bg-charcoal px-6 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-500/15">
          <Wallet className="h-7 w-7 text-teal-300" />
        </span>
        <div className="max-w-sm space-y-2">
          <h2 className="font-display text-xl font-bold text-cream">Session de caisse requise</h2>
          <p className="text-sm text-cream/55">
            Ouvrez une session (fond de caisse) avant de prendre des commandes — traçabilité du
            service.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-500"
        >
          Ouvrir la session
        </button>
        <PosOpeningDialog
          open={dialogOpen}
          authScope={authScope}
          onClose={() => setDialogOpen(false)}
          onOpened={(s) => {
            setSession(s)
            setDialogOpen(false)
          }}
        />
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-teal-500/20 bg-teal-950/30 px-3 py-1.5 text-[11px] text-teal-100/80">
        <span>
          Session ouverte · fond {formatEUR(session.openingCashAmount)} · depuis{' '}
          {new Date(session.openedAt).toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  )
}
