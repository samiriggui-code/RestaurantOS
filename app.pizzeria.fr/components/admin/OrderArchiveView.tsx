'use client'

import { useCallback, useEffect, useState } from 'react'
import { useFeedbackState } from '@/lib/use-feedback-state'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { FileText, Loader2, Mail, Phone, Printer, Search, Ban, X } from 'lucide-react'
import { getStaffSession } from '@/lib/staff-auth'
import { staffFetch } from '@/lib/staff-api'
import { ORDER_CHANNEL_OPTIONS } from '@/lib/admin-nav'
import {
  CANCEL_REASON_LABEL,
  cancelOrder,
  fetchOrders,
  ORDER_CANCEL_REASONS,
  ORDER_STATUS_LABEL,
  ORDER_TYPE_LABEL,
  orderAddressLine,
  orderChannelLabel,
  orderChannelBadgeClass,
  orderCustomerLine,
  PAYMENT_STATUS_LABEL,
  printTicketText,
  requestOrderPrint,
  updateOrderStatus,
  type OpsOrder,
  type OrderCancelReason,
} from '@/lib/ops-orders'
import { ARCHIVE_PERIODS, periodToDateRange, type ArchivePeriod } from '@/lib/order-period'
import { formatEUR } from '@/lib/money'
import { OrderItemLineTotal, OrderItemLines } from '@/components/ops/OrderItemLines'
import { cn } from '@/lib/cn'
import { useAdminRefresh } from '@/components/admin/AdminLiveProvider'
import { useAdminFeedback } from '@/components/admin/AdminFeedbackProvider'

const STATUS_FILTERS = [
  { value: '', label: 'Tous statuts' },
  { value: 'COMPLETED,DELIVERED', label: 'Terminées' },
  { value: 'CANCELLED', label: 'Annulées' },
  { value: 'CONFIRMED,PREPARING,READY', label: 'Encore actives' },
  { value: 'PENDING_PAYMENT', label: 'Impayées (comptoir)' },
]

type InvoiceFromOrder = {
  id: string
  invoiceNumber: number
  status: string
  clientEmail: string | null
  _existing?: boolean
}

export type OrderArchiveMode = 'all' | 'online' | 'counter'

type Props = {
  title: string
  subtitle: string
  mode: OrderArchiveMode
}

export function OrderArchiveView({ title, subtitle, mode }: Props) {
  const { notifySuccess } = useAdminFeedback()
  const searchParams = useSearchParams()
  const highlightOrderId = searchParams.get('order')
  const [orders, setOrders] = useState<OpsOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<ArchivePeriod>('today')
  const [statusFilter, setStatusFilter] = useState('')
  const [channelFilter, setChannelFilter] = useState('')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<OpsOrder | null>(null)
  const { error, setError } = useFeedbackState()
  const [invoicing, setInvoicing] = useState(false)
  const [invoiceResult, setInvoiceResult] = useState<InvoiceFromOrder | null>(null)
  const [sendingInvoice, setSendingInvoice] = useState(false)
  const [sendEmailTarget, setSendEmailTarget] = useState('')
  const [showSendEmailModal, setShowSendEmailModal] = useState(false)
  const [reprinting, setReprinting] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState<OrderCancelReason>('CLIENT_REFUSED')
  const [cancelNote, setCancelNote] = useState('')
  const [cancelling, setCancelling] = useState(false)

  const REPRINT_WINDOW_MS = 24 * 60 * 60 * 1000

  function canReprintReceipt(order: OpsOrder): boolean {
    if (order.paymentStatus !== 'PAID') return false
    const paidAt = new Date(order.createdAt).getTime()
    return Date.now() - paidAt <= REPRINT_WINDOW_MS
  }

  async function reprintReceipt() {
    if (!selected) return
    const session = getStaffSession()
    if (!session) return
    if (!canReprintReceipt(selected)) {
      setError('Réimpression limitée à 24 h après encaissement')
      return
    }
    setReprinting(true)
    setError(null)
    try {
      const { content } = await requestOrderPrint(selected.id, 'RECEIPT', session.token, { reprint: true })
      printTicketText(content, `Reçu #${selected.orderNumber} (DUPLICATA)`, 'RECEIPT')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Réimpression impossible')
    } finally {
      setReprinting(false)
    }
  }

  const load = useCallback(async () => {
    const session = getStaffSession()
    if (!session) return
    setLoading(true)
    try {
      const range = periodToDateRange(period)
      const data = await fetchOrders(session.token, {
        ...range,
        status: statusFilter || undefined,
        channel: channelFilter || undefined,
        isOnlineOrder: mode === 'online' ? true : mode === 'counter' ? false : undefined,
        includeUnpaid: statusFilter === 'PENDING_PAYMENT',
        limit: 250,
      })
      setOrders(data)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur chargement')
    } finally {
      setLoading(false)
    }
  }, [period, statusFilter, channelFilter, mode])

  useEffect(() => {
    void load()
  }, [load])

  useAdminRefresh('orders', load)

  useEffect(() => {
    if (highlightOrderId) setPeriod('month')
  }, [highlightOrderId])

  useEffect(() => {
    if (!highlightOrderId || orders.length === 0) return
    const found = orders.find((o) => o.id === highlightOrderId)
    if (found) setSelected(found)
  }, [highlightOrderId, orders])

  useEffect(() => {
    setInvoiceResult(null)
  }, [selected?.id])

  const filtered = orders.filter((o) => {
    if (!search.trim()) return true
    const q = search.trim().toLowerCase()
    return (
      String(o.orderNumber).includes(q) ||
      o.customerName?.toLowerCase().includes(q) ||
      o.customerPhone?.includes(q)
    )
  })

  const totalAmount = filtered.reduce((s, o) => s + o.total, 0)

  async function changeStatus(id: string, status: string) {
    const session = getStaffSession()
    if (!session) return
    try {
      const updated = await updateOrderStatus(id, status, session.token)
      setOrders((prev) => prev.map((o) => (o.id === id ? updated : o)))
      setSelected((prev) => (prev?.id === id ? updated : prev))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Mise à jour impossible')
    }
  }

  const isActive = (status: string) =>
    ['CONFIRMED', 'PREPARING', 'READY', 'PENDING'].includes(status)

  const canCancelOrder = (order: OpsOrder) =>
    !['COMPLETED', 'DELIVERED', 'CANCELLED'].includes(order.status)

  async function confirmCancelOrder() {
    if (!selected) return
    const session = getStaffSession()
    if (!session) return
    setCancelling(true)
    setError(null)
    try {
      const updated = await cancelOrder(selected.id, session.token, {
        reason: cancelReason,
        note: cancelNote.trim() || undefined,
        source: 'ADMIN',
        refund: true,
      })
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)))
      setSelected(updated)
      setCancelOpen(false)
      setCancelNote('')
      notifySuccess(
        selected.sumupCheckoutId
          ? 'Commande annulée et remboursement SumUp lancé'
          : 'Commande annulée',
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Annulation impossible')
    } finally {
      setCancelling(false)
    }
  }

  const canInvoice =
    selected &&
    selected.status !== 'CANCELLED' &&
    selected.paymentStatus === 'PAID'

  async function createInvoiceFromOrder() {
    if (!selected) return
    const session = getStaffSession()
    if (!session) return
    setInvoicing(true)
    setError(null)
    try {
      const invoice = await staffFetch<InvoiceFromOrder>(`/invoices/from-order/${selected.id}`, {
        method: 'POST',
        token: session.token,
      })
      setInvoiceResult(invoice)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible de créer la facture')
    } finally {
      setInvoicing(false)
    }
  }

  function openSendInvoiceEmail() {
    if (!invoiceResult) return
    const preset =
      invoiceResult.clientEmail?.trim() || selected?.customerEmail?.trim() || ''
    setSendEmailTarget(preset)
    setShowSendEmailModal(true)
  }

  async function confirmSendInvoiceEmail() {
    if (!invoiceResult) return
    const email = sendEmailTarget.trim()
    if (!email) return
    const session = getStaffSession()
    if (!session) return

    setSendingInvoice(true)
    setError(null)
    try {
      const updated = await staffFetch<InvoiceFromOrder>(`/invoices/${invoiceResult.id}/send`, {
        method: 'POST',
        token: session.token,
        body: JSON.stringify({ email }),
      })
      setInvoiceResult(updated)
      setShowSendEmailModal(false)
      notifySuccess('Facture envoyée par email.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Envoi email impossible')
    } finally {
      setSendingInvoice(false)
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-cream">{title}</h1>
        <p className="text-sm text-cream/50">{subtitle}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {ARCHIVE_PERIODS.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => setPeriod(p.value)}
            className={cn(
              'rounded-xl px-4 py-2 text-sm font-medium',
              period === p.value
                ? 'bg-tomato text-white'
                : 'border border-white/10 text-cream/60 hover:bg-white/5'
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {error && (
        <p className="rounded-xl border border-red-500/30 bg-red-950/40 px-4 py-2 text-sm text-red-200">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cream/30" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="N°, nom, téléphone…"
            className="w-full rounded-xl border border-white/10 bg-[#1A1412] py-2.5 pl-10 pr-4 text-cream"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setStatusFilter(f.value)}
              className={cn(
                'rounded-xl px-3 py-2 text-xs font-medium sm:text-sm',
                statusFilter === f.value
                  ? 'bg-white/15 text-cream'
                  : 'border border-white/10 text-cream/50 hover:bg-white/5'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <select
          value={channelFilter}
          onChange={(e) => setChannelFilter(e.target.value)}
          className="rounded-xl border border-white/10 bg-[#1A1412] px-3 py-2 text-sm text-cream"
        >
          {ORDER_CHANNEL_OPTIONS.map((o) => (
            <option key={o.value || 'all'} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-cream/50">
        <span>
          {filtered.length} commande(s) · total affiché {formatEUR(totalAmount)}
        </span>
        <button
          type="button"
          onClick={() => void load()}
          className="text-tomato-light hover:underline"
        >
          Actualiser
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-tomato-light" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-16 text-center text-cream/40">Aucune commande sur cette période</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {filtered.map((order) => (
            <button
              key={order.id}
              type="button"
              onClick={() => setSelected(order)}
              className="rounded-2xl border border-white/10 bg-[#1A1412] p-4 text-left transition hover:border-tomato/40"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-display text-xl font-bold text-tomato-light">
                    #{order.orderNumber}
                  </p>
                  <p className="text-sm text-cream/80">{orderCustomerLine(order)}</p>
                  <p className="text-xs text-cream/40">
                    {orderChannelLabel(order)} · {ORDER_TYPE_LABEL[order.type]} ·{' '}
                    {new Date(order.createdAt).toLocaleString('fr-FR')}
                  </p>
                </div>
                <p className="font-bold text-cream">{formatEUR(order.total)}</p>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-cream/70">
                  {ORDER_STATUS_LABEL[order.status] ?? order.status}
                </span>
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-xs',
                    order.paymentStatus === 'PAID'
                      ? 'bg-emerald-500/15 text-emerald-200'
                      : 'bg-amber-500/15 text-amber-200'
                  )}
                >
                  {PAYMENT_STATUS_LABEL[order.paymentStatus] ?? order.paymentStatus}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-[#1A1412] p-6">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="font-display text-2xl font-bold text-cream">
                  Commande #{selected.orderNumber}
                </h2>
                <p className="text-sm text-cream/50">
                  {orderChannelLabel(selected)} · {ORDER_TYPE_LABEL[selected.type]} —{' '}
                  {ORDER_STATUS_LABEL[selected.status]}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-lg p-1 text-cream/50 hover:bg-white/10"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-cream/45">Client</dt>
                <dd className="text-right text-cream">{orderCustomerLine(selected)}</dd>
              </div>
              {selected.customerPhone && (
                <div className="flex justify-between gap-4">
                  <dt className="text-cream/45">Téléphone</dt>
                  <dd className="flex items-center gap-1 text-cream">
                    <Phone className="h-3.5 w-3.5" />
                    {selected.customerPhone}
                  </dd>
                </div>
              )}
              {orderAddressLine(selected) && (
                <div className="flex justify-between gap-4">
                  <dt className="text-cream/45">Adresse</dt>
                  <dd className="text-right text-cream">{orderAddressLine(selected)}</dd>
                </div>
              )}
            </dl>

            <ul className="mt-4 space-y-3 border-t border-white/10 pt-4">
              {selected.items.map((item) => (
                <li key={item.id} className="flex items-start justify-between gap-3 text-sm">
                  <OrderItemLines item={item} showUnitPrice />
                  <OrderItemLineTotal item={item} />
                </li>
              ))}
            </ul>

            {selected.notes && (
              <p className="mt-4 rounded-xl bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
                {selected.notes}
              </p>
            )}

            {selected.status === 'CANCELLED' && selected.cancelReason && (
              <div className="mt-4 rounded-xl border border-red-500/30 bg-red-950/30 px-3 py-2 text-sm text-red-100">
                <p className="font-semibold">
                  Annulée —{' '}
                  {CANCEL_REASON_LABEL[selected.cancelReason as keyof typeof CANCEL_REASON_LABEL] ??
                    selected.cancelReason}
                </p>
                {selected.cancelNote && (
                  <p className="mt-1 text-xs text-red-200/80">{selected.cancelNote}</p>
                )}
                {selected.cancelledAt && (
                  <p className="mt-1 text-xs text-red-200/60">
                    {new Date(selected.cancelledAt).toLocaleString('fr-FR')}
                  </p>
                )}
              </div>
            )}

            <p className="mt-4 text-right text-lg font-bold text-tomato-light">
              Total {formatEUR(selected.total)}
            </p>

            {invoiceResult ? (
              <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                <p className="font-semibold">
                  Facture n° {invoiceResult.invoiceNumber}{' '}
                  {invoiceResult._existing ? '(déjà existante)' : 'créée'}
                </p>
                <p className="mt-1 text-xs text-emerald-200/80">
                  Statut : {invoiceResult.status === 'SENT' ? 'envoyée par email' : invoiceResult.status}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {invoiceResult.status !== 'SENT' ? (
                    <button
                      type="button"
                      disabled={sendingInvoice}
                      onClick={() => openSendInvoiceEmail()}
                      className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      {sendingInvoice ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Mail className="h-3.5 w-3.5" />
                      )}
                      Envoyer par email
                    </button>
                  ) : null}
                  <Link
                    href="/admin/invoices"
                    className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-3 py-2 text-xs text-cream hover:bg-white/5"
                  >
                    Voir facturation
                  </Link>
                </div>
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-2">
              {canInvoice && !invoiceResult ? (
                <button
                  type="button"
                  disabled={invoicing}
                  onClick={() => void createInvoiceFromOrder()}
                  className="inline-flex items-center gap-2 rounded-xl border border-tomato/40 bg-tomato/15 px-4 py-2 text-sm font-semibold text-tomato-light hover:bg-tomato/25 disabled:opacity-50"
                >
                  {invoicing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileText className="h-4 w-4" />
                  )}
                  Facturer
                </button>
              ) : null}
              {selected.paymentStatus === 'PAID' ? (
                <button
                  type="button"
                  disabled={reprinting || !canReprintReceipt(selected)}
                  title={
                    canReprintReceipt(selected)
                      ? 'Réimpression avec bandeau DUPLICATA (journal JET)'
                      : 'Réimpression limitée à 24 h après encaissement'
                  }
                  onClick={() => void reprintReceipt()}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm text-cream hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {reprinting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Printer className="h-4 w-4" />
                  )}
                  Réimprimer reçu
                </button>
              ) : null}
              {selected && canCancelOrder(selected) ? (
                <button
                  type="button"
                  onClick={() => setCancelOpen(true)}
                  className="inline-flex items-center gap-2 rounded-xl border border-red-500/40 bg-red-950/30 px-4 py-2 text-sm font-semibold text-red-200 hover:bg-red-900/40"
                >
                  <Ban className="h-4 w-4" />
                  {selected.paymentStatus === 'PAID' && selected.sumupCheckoutId
                    ? 'Annuler et rembourser'
                    : 'Annuler la commande'}
                </button>
              ) : null}
              {isActive(selected.status) && (
                <>
                  {selected.status === 'CONFIRMED' && (
                    <button
                      type="button"
                      onClick={() => void changeStatus(selected.id, 'PREPARING')}
                      className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white"
                    >
                      → En préparation
                    </button>
                  )}
                  {selected.status === 'PREPARING' && (
                    <button
                      type="button"
                      onClick={() => void changeStatus(selected.id, 'READY')}
                      className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white"
                    >
                      → Prête
                    </button>
                  )}
                  {selected.status === 'READY' && (
                    <button
                      type="button"
                      onClick={() => void changeStatus(selected.id, 'COMPLETED')}
                      className="flex-1 rounded-xl bg-white/10 py-2.5 text-sm font-semibold text-cream"
                    >
                      → Terminée
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {showSendEmailModal && invoiceResult ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#1A1412] p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold text-cream">
                Envoyer la facture n°{invoiceResult.invoiceNumber}
              </h3>
              <button type="button" onClick={() => setShowSendEmailModal(false)}>
                <X className="h-5 w-5 text-cream/40" />
              </button>
            </div>
            <label className="block text-xs text-cream/50">
              Email destinataire
              <input
                type="email"
                value={sendEmailTarget}
                onChange={(e) => setSendEmailTarget(e.target.value)}
                className="mt-1 w-full rounded-xl border border-white/15 bg-white/[0.03] px-3 py-2 text-sm text-cream outline-none focus:border-tomato/40"
                placeholder="client@exemple.fr"
                autoFocus
              />
            </label>
            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={() => setShowSendEmailModal(false)}
                className="flex-1 rounded-xl border border-white/15 py-2 text-sm"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={!sendEmailTarget.trim() || sendingInvoice}
                onClick={() => void confirmSendInvoiceEmail()}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-tomato py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {sendingInvoice ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                Envoyer
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {cancelOpen && selected ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#1A1412] p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-bold text-cream">
                  Annuler #{selected.orderNumber}
                </h2>
                <p className="text-xs text-cream/50">
                  Stock remis si lié au menu · ticket fiscal annulé si émis.
                </p>
              </div>
              <button type="button" onClick={() => setCancelOpen(false)}>
                <X className="h-5 w-5 text-cream/40" />
              </button>
            </div>

            <label className="mb-1 block text-xs font-medium text-cream/60">Motif</label>
            <select
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value as OrderCancelReason)}
              className="mb-3 w-full rounded-xl border border-white/10 bg-charcoal px-3 py-2.5 text-sm text-cream"
            >
              {ORDER_CANCEL_REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>

            <label className="mb-1 block text-xs font-medium text-cream/60">Précision (optionnel)</label>
            <textarea
              value={cancelNote}
              onChange={(e) => setCancelNote(e.target.value)}
              rows={2}
              className="mb-4 w-full rounded-xl border border-white/10 bg-charcoal px-3 py-2 text-sm text-cream"
            />

            {selected.paymentStatus === 'PAID' && selected.sumupCheckoutId ? (
              <p className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                Paiement CB en ligne — un remboursement SumUp sera effectué automatiquement sur la carte du
                client.
              </p>
            ) : selected.paymentStatus === 'PAID' ? (
              <p className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                Commande déjà payée au comptoir — rembourser le client manuellement (espèces ou TPE).
              </p>
            ) : null}

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setCancelOpen(false)}
                disabled={cancelling}
                className="rounded-xl border border-white/15 py-3 text-sm font-medium text-cream/70"
              >
                Retour
              </button>
              <button
                type="button"
                disabled={cancelling}
                onClick={() => void confirmCancelOrder()}
                className="rounded-xl bg-red-600 py-3 text-sm font-bold text-white hover:bg-red-500 disabled:opacity-50"
              >
                {cancelling ? 'Annulation…' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
