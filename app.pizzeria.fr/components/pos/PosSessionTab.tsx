'use client'

import { useCallback, useEffect, useState } from 'react'
import { ArrowRightLeft, Loader2, LogIn, LogOut, Merge, Wallet } from 'lucide-react'
import { getStaffSession } from '@/lib/staff-auth'
import { fetchCurrentPosSession, type PosSession } from '@/lib/pos-session-api'
import { formatEUR } from '@/lib/money'
import { PosOpeningDialog } from '@/components/pos/PosOpeningDialog'
import { PosClosingDialog } from '@/components/pos/PosClosingDialog'
import { BillMergeDialog } from '@/components/pos/BillMergeDialog'
import { OrderTransferDialog } from '@/components/pos/OrderTransferDialog'

export function PosSessionTab() {
  const [session, setSession] = useState<PosSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [dialog, setDialog] = useState<'open' | 'close' | 'merge' | 'transfer' | null>(null)

  const reload = useCallback(async () => {
    const staffSession = getStaffSession('device')
    if (!staffSession) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      setSession(await fetchCurrentPosSession(staffSession.token))
    } catch {
      setSession(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  return (
    <div className="flex h-full flex-col overflow-hidden bg-charcoal text-cream">
      <header className="border-b border-white/10 px-5 py-4">
        <h1 className="font-display text-xl font-bold">Session de caisse</h1>
        <p className="text-xs text-cream/45">Ouverture/fermeture du fond de caisse · fusion de notes</p>
      </header>

      <div className="flex-1 space-y-5 overflow-y-auto p-5">
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-tomato-light" />
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-[#141010] p-5">
            <div className="flex items-center gap-3">
              <span
                className={
                  'flex h-11 w-11 items-center justify-center rounded-xl ' +
                  (session ? 'bg-emerald-500/15' : 'bg-white/5')
                }
              >
                <Wallet className={session ? 'h-5 w-5 text-emerald-400' : 'h-5 w-5 text-cream/40'} />
              </span>
              <div>
                <p className="font-semibold text-cream">
                  {session ? 'Session ouverte' : 'Aucune session ouverte'}
                </p>
                {session && (
                  <p className="text-xs text-cream/45">
                    Fond de caisse : {formatEUR(session.openingCashAmount)} · depuis{' '}
                    {new Date(session.openedAt).toLocaleTimeString('fr-FR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-4">
              {session ? (
                <button
                  type="button"
                  onClick={() => setDialog('close')}
                  className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-500"
                >
                  <LogOut className="h-4 w-4" />
                  Fermer la session
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setDialog('open')}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
                >
                  <LogIn className="h-4 w-4" />
                  Ouvrir une session
                </button>
              )}
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-white/10 bg-[#141010] p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-500/15">
              <Merge className="h-5 w-5 text-sky-400" />
            </span>
            <div>
              <p className="font-semibold text-cream">Fusionner des notes</p>
              <p className="text-xs text-cream/45">Regrouper plusieurs commandes ouvertes en une seule</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setDialog('merge')}
            className="mt-4 inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm font-medium text-cream/80 hover:bg-white/5"
          >
            Ouvrir
          </button>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#141010] p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-500/15">
              <ArrowRightLeft className="h-5 w-5 text-violet-400" />
            </span>
            <div>
              <p className="font-semibold text-cream">Transférer une commande</p>
              <p className="text-xs text-cream/45">Changer une commande ouverte de table</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setDialog('transfer')}
            className="mt-4 inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm font-medium text-cream/80 hover:bg-white/5"
          >
            Ouvrir
          </button>
        </div>
      </div>

      <PosOpeningDialog
        open={dialog === 'open'}
        onClose={() => setDialog(null)}
        onOpened={(s) => {
          setSession(s)
          setDialog(null)
        }}
      />
      {session && (
        <PosClosingDialog
          open={dialog === 'close'}
          session={session}
          onClose={() => setDialog(null)}
          onClosed={() => {
            setSession(null)
            setDialog(null)
          }}
        />
      )}
      <BillMergeDialog
        open={dialog === 'merge'}
        onClose={() => setDialog(null)}
        onMerged={() => setDialog(null)}
      />
      <OrderTransferDialog
        open={dialog === 'transfer'}
        onClose={() => setDialog(null)}
        onTransferred={() => setDialog(null)}
      />
    </div>
  )
}
