'use client'

import { useEffect, useState } from 'react'
import { ArrowRightLeft, Loader2, X } from 'lucide-react'
import { getStaffSession } from '@/lib/staff-auth'
import {
  fetchMergeableOrders,
  fetchTransferableTables,
  transferOrder,
  type MergeableOrder,
  type TransferableTable,
} from '@/lib/pos-session-api'
import { formatEUR } from '@/lib/money'
import { useAppFeedback } from '@/components/feedback/AppFeedbackProvider'
import { cn } from '@/lib/cn'

type Props = {
  open: boolean
  onClose: () => void
  onTransferred: () => void
}

function orderLabel(o: MergeableOrder): string {
  const who = o.customerName?.trim() || (o.tableId ? `Table` : o.type)
  return `#${o.orderNumber} — ${who} · ${formatEUR(o.total)}`
}

/** Réassigne une commande ouverte à une autre table, sans passer par annulation (Phase F). */
export function OrderTransferDialog({ open, onClose, onTransferred }: Props) {
  const [orders, setOrders] = useState<MergeableOrder[]>([])
  const [tables, setTables] = useState<TransferableTable[]>([])
  const [loading, setLoading] = useState(true)
  const [orderId, setOrderId] = useState<string | null>(null)
  const [tableId, setTableId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const { notifyError, notifySuccess } = useAppFeedback()

  useEffect(() => {
    if (!open) return
    const session = getStaffSession('device')
    if (!session) return
    setLoading(true)
    setOrderId(null)
    setTableId(null)
    Promise.all([fetchMergeableOrders(session.token), fetchTransferableTables(session.token)])
      .then(([o, t]) => {
        setOrders(o)
        setTables(t)
      })
      .catch(() => {
        setOrders([])
        setTables([])
      })
      .finally(() => setLoading(false))
  }, [open])

  if (!open) return null

  const selectedOrder = orders.find((o) => o.id === orderId)
  const availableTables = tables.filter((t) => t.id !== selectedOrder?.tableId)

  async function submit() {
    const session = getStaffSession('device')
    if (!session || !orderId || !tableId) return
    setBusy(true)
    try {
      await transferOrder(session.token, orderId, tableId)
      notifySuccess('Commande transférée')
      onTransferred()
    } catch (err) {
      notifyError('Transfert impossible', err instanceof Error ? err.message : undefined)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-white/10 bg-[#1A1412] shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-white/10 p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/15">
              <ArrowRightLeft className="h-5 w-5 text-violet-400" />
            </span>
            <div>
              <h3 className="font-semibold text-cream">Transférer une commande</h3>
              <p className="mt-0.5 text-xs text-cream/50">
                Choisis la commande, puis la table de destination
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
          ) : orders.length === 0 ? (
            <p className="py-8 text-center text-sm text-cream/40">Aucune commande ouverte à transférer.</p>
          ) : (
            <>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-cream/40">Commande</p>
              <ul className="mb-5 space-y-2">
                {orders.map((o) => (
                  <li key={o.id}>
                    <button
                      type="button"
                      onClick={() => setOrderId(o.id)}
                      className={cn(
                        'w-full rounded-xl border px-4 py-3 text-left text-sm',
                        o.id === orderId
                          ? 'border-violet-500/40 bg-violet-500/10 text-cream'
                          : 'border-white/10 bg-white/[0.02] text-cream/80 hover:bg-white/[0.05]',
                      )}
                    >
                      {orderLabel(o)}
                    </button>
                  </li>
                ))}
              </ul>

              {orderId && (
                <>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-cream/40">
                    Table de destination
                  </p>
                  {availableTables.length === 0 ? (
                    <p className="py-4 text-center text-sm text-cream/40">Aucune autre table disponible.</p>
                  ) : (
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                      {availableTables.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setTableId(t.id)}
                          className={cn(
                            'rounded-xl border px-3 py-2.5 text-sm font-medium',
                            t.id === tableId
                              ? 'border-violet-500/40 bg-violet-500/10 text-cream'
                              : 'border-white/10 bg-white/[0.02] text-cream/70 hover:bg-white/[0.05]',
                          )}
                        >
                          Table {t.number}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>

        <div className="border-t border-white/10 p-5">
          <button
            type="button"
            disabled={busy || !orderId || !tableId}
            onClick={() => void submit()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Transférer
          </button>
        </div>
      </div>
    </div>
  )
}
