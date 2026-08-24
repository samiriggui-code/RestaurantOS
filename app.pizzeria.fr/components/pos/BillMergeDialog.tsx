'use client'

import { useEffect, useState } from 'react'
import { Loader2, Merge, X } from 'lucide-react'
import { getStaffSession } from '@/lib/staff-auth'
import { fetchMergeableOrders, mergeOrders, type MergeableOrder } from '@/lib/pos-session-api'
import { formatEUR } from '@/lib/money'
import { useAppFeedback } from '@/components/feedback/AppFeedbackProvider'
import { cn } from '@/lib/cn'

type Props = {
  open: boolean
  onClose: () => void
  onMerged: () => void
}

function orderLabel(o: MergeableOrder): string {
  const who = o.customerName?.trim() || (o.tableId ? `Table` : o.type)
  return `#${o.orderNumber} — ${who} · ${formatEUR(o.total)}`
}

export function BillMergeDialog({ open, onClose, onMerged }: Props) {
  const [orders, setOrders] = useState<MergeableOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [targetId, setTargetId] = useState<string | null>(null)
  const [sourceIds, setSourceIds] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const { notifyError, notifySuccess } = useAppFeedback()

  useEffect(() => {
    if (!open) return
    const session = getStaffSession('device')
    if (!session) return
    setLoading(true)
    setTargetId(null)
    setSourceIds(new Set())
    fetchMergeableOrders(session.token)
      .then(setOrders)
      .catch(() => setOrders([]))
      .finally(() => setLoading(false))
  }, [open])

  if (!open) return null

  function toggleSource(id: string) {
    if (id === targetId) return
    setSourceIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function pickTarget(id: string) {
    setTargetId(id)
    setSourceIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }

  async function submit() {
    const session = getStaffSession('device')
    if (!session || !targetId || sourceIds.size === 0) return
    setBusy(true)
    try {
      await mergeOrders(session.token, targetId, [...sourceIds])
      notifySuccess('Notes fusionnées')
      onMerged()
    } catch (err) {
      notifyError('Fusion impossible', err instanceof Error ? err.message : undefined)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-white/10 bg-[#1A1412] shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-white/10 p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/15">
              <Merge className="h-5 w-5 text-sky-400" />
            </span>
            <div>
              <h3 className="font-semibold text-cream">Fusionner des notes</h3>
              <p className="mt-0.5 text-xs text-cream/50">
                Choisis la note cible, puis les notes à y déplacer
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-cream/40 hover:bg-white/10 hover:text-cream"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-tomato-light" />
            </div>
          ) : orders.length < 2 ? (
            <p className="py-8 text-center text-sm text-cream/40">
              Pas assez de notes ouvertes pour fusionner (il en faut au moins 2).
            </p>
          ) : (
            <ul className="space-y-2">
              {orders.map((o) => {
                const isTarget = o.id === targetId
                const isSource = sourceIds.has(o.id)
                return (
                  <li
                    key={o.id}
                    className={cn(
                      'flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm',
                      isTarget
                        ? 'border-tomato/40 bg-tomato/10'
                        : isSource
                          ? 'border-sky-500/40 bg-sky-500/10'
                          : 'border-white/10 bg-white/[0.02]',
                    )}
                  >
                    <span className="text-cream/85">{orderLabel(o)}</span>
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => pickTarget(o.id)}
                        className={cn(
                          'rounded-lg px-2.5 py-1 text-xs font-medium',
                          isTarget
                            ? 'bg-tomato text-white'
                            : 'border border-white/15 text-cream/60 hover:bg-white/5',
                        )}
                      >
                        Cible
                      </button>
                      <button
                        type="button"
                        disabled={isTarget}
                        onClick={() => toggleSource(o.id)}
                        className={cn(
                          'rounded-lg px-2.5 py-1 text-xs font-medium disabled:opacity-30',
                          isSource
                            ? 'bg-sky-600 text-white'
                            : 'border border-white/15 text-cream/60 hover:bg-white/5',
                        )}
                      >
                        {isSource ? 'Sélectionnée' : 'Fusionner'}
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="border-t border-white/10 p-5">
          <button
            type="button"
            disabled={busy || !targetId || sourceIds.size === 0}
            onClick={() => void submit()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-sky-600 py-2.5 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Fusionner {sourceIds.size > 0 ? `(${sourceIds.size})` : ''}
          </button>
        </div>
      </div>
    </div>
  )
}
