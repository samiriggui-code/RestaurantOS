'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ColumnDef,
  PaginationState,
  SortingState,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { useFeedbackState } from '@/lib/use-feedback-state'
import Link from 'next/link'
import {
  Edit2,
  FileText,
  Landmark,
  Loader2,
  Mail,
  Plus,
  Printer,
  Receipt,
  Search,
  Send,
  ShoppingBag,
  Trash2,
  X,
  FileCode,
} from 'lucide-react'
import { formatEUR, eurosToCents } from '@/lib/money'
import { computeInvoiceLineTotals } from '@/lib/invoice-vat'
import { getStaffSession } from '@/lib/staff-auth'
import { staffFetch, staffFetchText } from '@/lib/staff-api'
import { downloadTextFile } from '@/lib/open-html-document'
import { cn } from '@/lib/cn'
import { AdminPageHeader } from '@/components/admin/AdminSectionTabs'
import { ADMIN_STAT_GRID, AdminStatCard } from '@/components/admin/AdminStatCard'
import { AdminPrintPreview } from '@/components/admin/AdminPrintPreview'
import { AdminDataGridShell, DataGridColumnHeader, createDefaultPagination } from '@/components/ui/data-grid'

type InvoiceLine = {
  id?: string
  description: string
  quantity: number
  unitPriceCents: number
  taxRate: number
}

type Invoice = {
  id: string
  invoiceNumber: number
  status: string
  type: string
  clientName: string
  clientEmail: string | null
  clientPhone?: string | null
  clientSiret?: string | null
  clientVatNumber?: string | null
  clientAddress?: string | null
  notes?: string | null
  issueDate: string
  totalCents: number
  orderId?: string | null
  order?: { orderNumber: number; channel?: string | null } | null
  lines?: InvoiceLine[]
  missingFields?: string[]
  pennylaneSyncedAt?: string | null
  pennylaneSyncError?: string | null
}

type OrderSource = {
  id: string
  orderNumber: number
  customerName: string | null
  customerEmail: string | null
  customerPhone: string | null
  total: number
  createdAt: string
  isOnlineOrder: boolean
  type: string
  clientAddress: string | null
  invoice: { id: string; invoiceNumber: number; status: string } | null
  lines: InvoiceLine[]
  vat?: { subtotalCents: number; taxCents: number; totalCents: number }
  priceMode?: 'HT' | 'TTC'
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Brouillon',
  ISSUED: 'Émise',
  SENT: 'Envoyée',
  PAID: 'Payée',
  CANCELLED: 'Annulée',
}

const fieldClass =
  'mt-1 w-full rounded-xl border border-white/15 bg-white/[0.03] px-3 py-2 text-sm text-cream outline-none focus:border-tomato/40'

const emptyLine = (): InvoiceLine => ({
  description: '',
  quantity: 1,
  unitPriceCents: 0,
  taxRate: 10,
})

function computeTotal(lines: InvoiceLine[]) {
  return computeInvoiceLineTotals(lines)
}

type FormState = {
  orderId: string
  clientName: string
  clientEmail: string
  clientPhone: string
  clientSiret: string
  clientVatNumber: string
  clientAddress: string
  notes: string
  lines: InvoiceLine[]
}

function emptyForm(): FormState {
  return {
    orderId: '',
    clientName: '',
    clientEmail: '',
    clientPhone: '',
    clientSiret: '',
    clientVatNumber: '',
    clientAddress: '',
    notes: '',
    lines: [emptyLine()],
  }
}

function invoiceToForm(inv: Invoice): FormState {
  return {
    orderId: inv.orderId ?? '',
    clientName: inv.clientName,
    clientEmail: inv.clientEmail ?? '',
    clientPhone: inv.clientPhone ?? '',
    clientSiret: inv.clientSiret ?? '',
    clientVatNumber: inv.clientVatNumber ?? '',
    clientAddress: inv.clientAddress ?? '',
    notes: inv.notes ?? '',
    lines: inv.lines?.length ? inv.lines.map((l) => ({ ...l })) : [emptyLine()],
  }
}

function orderToForm(order: OrderSource): FormState {
  return {
    orderId: order.id,
    clientName: order.customerName?.trim() || `Commande n° ${order.orderNumber}`,
    clientEmail: order.customerEmail ?? '',
    clientPhone: order.customerPhone ?? '',
    clientSiret: '',
    clientVatNumber: '',
    clientAddress: order.clientAddress ?? '',
    notes: '',
    lines: order.lines.length ? order.lines.map((l) => ({ ...l })) : [emptyLine()],
  }
}

export function AdminInvoicesView() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [formMode, setFormMode] = useState<'closed' | 'create' | 'edit'>('closed')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [createTab, setCreateTab] = useState<'manual' | 'order'>('order')
  const [orderSearch, setOrderSearch] = useState('')
  const [orderResults, setOrderResults] = useState<OrderSource[]>([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [sendingId, setSendingId] = useState<string | null>(null)
  const [sendTarget, setSendTarget] = useState<{ inv: Invoice; email: string } | null>(null)
  const [printPreview, setPrintPreview] = useState<{ html: string; invoiceNumber: number } | null>(null)
  const [printLoadingId, setPrintLoadingId] = useState<string | null>(null)
  const [facturXLoadingId, setFacturXLoadingId] = useState<string | null>(null)
  const [pennylaneLoadingId, setPennylaneLoadingId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const { error, setError } = useFeedbackState()

  const load = useCallback(() => {
    const session = getStaffSession()
    if (!session) return
    setLoading(true)
    staffFetch<Invoice[]>('/invoices', { token: session.token })
      .then(setInvoices)
      .catch((e) => setError(e instanceof Error ? e.message : 'Erreur'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (formMode !== 'create' || createTab !== 'order') return
    const session = getStaffSession()
    if (!session) return
    const t = window.setTimeout(() => {
      setOrdersLoading(true)
      const q = orderSearch.trim()
      staffFetch<OrderSource[]>(`/invoices/order-sources${q ? `?q=${encodeURIComponent(q)}` : ''}`, {
        token: session.token,
      })
        .then(setOrderResults)
        .catch(() => setOrderResults([]))
        .finally(() => setOrdersLoading(false))
    }, 300)
    return () => window.clearTimeout(t)
  }, [orderSearch, formMode, createTab])

  function openCreate() {
    setForm(emptyForm())
    setEditingId(null)
    setFormMode('create')
    setCreateTab('order')
    setOrderSearch('')
    setError(null)
  }

  async function openEdit(inv: Invoice) {
    const session = getStaffSession()
    if (!session) return
    setError(null)
    try {
      const full = await staffFetch<Invoice>(`/invoices/${inv.id}`, { token: session.token })
      setForm(invoiceToForm(full))
      setEditingId(full.id)
      setFormMode('edit')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chargement impossible')
    }
  }

  function closeForm() {
    setFormMode('closed')
    setEditingId(null)
    setForm(emptyForm())
  }

  function patchForm(patch: Partial<FormState>) {
    setForm((prev) => ({ ...prev, ...patch }))
  }

  function updateLine(index: number, patch: Partial<InvoiceLine>) {
    setForm((prev) => ({
      ...prev,
      lines: prev.lines.map((l, i) => (i === index ? { ...l, ...patch } : l)),
    }))
  }

  function addLine() {
    setForm((prev) => ({ ...prev, lines: [...prev.lines, emptyLine()] }))
  }

  function removeLine(index: number) {
    setForm((prev) => ({
      ...prev,
      lines: prev.lines.length <= 1 ? prev.lines : prev.lines.filter((_, i) => i !== index),
    }))
  }

  function selectOrder(order: OrderSource) {
    if (order.invoice) {
      void openEdit({ id: order.invoice.id } as Invoice)
      return
    }
    setForm(orderToForm(order))
    setCreateTab('manual')
  }

  async function saveForm(issue: boolean) {
    const session = getStaffSession()
    if (!session) return
    if (!form.clientName.trim()) {
      setError('Nom client obligatoire')
      return
    }
    setSaving(true)
    setError(null)
    const payload = {
      clientName: form.clientName,
      clientEmail: form.clientEmail || undefined,
      clientPhone: form.clientPhone || undefined,
      clientSiret: form.clientSiret || undefined,
      clientVatNumber: form.clientVatNumber || undefined,
      clientAddress: form.clientAddress || undefined,
      notes: form.notes || undefined,
      orderId: form.orderId || undefined,
      status: issue ? 'ISSUED' : 'DRAFT',
      lines: form.lines.map((l) => ({
        description: l.description,
        quantity: l.quantity,
        unitPriceCents: l.unitPriceCents,
        taxRate: l.taxRate,
      })),
    }
    try {
      if (formMode === 'edit' && editingId) {
        await staffFetch(`/invoices/${editingId}`, {
          method: 'PATCH',
          token: session.token,
          body: JSON.stringify(payload),
        })
      } else if (form.orderId) {
        const created = await staffFetch<Invoice>(`/invoices/from-order/${form.orderId}`, {
          method: 'POST',
          token: session.token,
        })
        await staffFetch(`/invoices/${created.id}`, {
          method: 'PATCH',
          token: session.token,
          body: JSON.stringify(payload),
        })
      } else {
        await staffFetch('/invoices', {
          method: 'POST',
          token: session.token,
          body: JSON.stringify({ ...payload, type: 'ON_DEMAND' }),
        })
      }
      closeForm()
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enregistrement impossible')
    } finally {
      setSaving(false)
    }
  }

  async function sendInvoice(inv: Invoice) {
    if (inv.missingFields?.includes('email')) {
      void openEdit(inv)
      setError('Complétez l’email client avant envoi.')
      return
    }
    if (!inv.clientEmail) {
      setSendTarget({ inv, email: '' })
      return
    }
    await confirmSend(inv, inv.clientEmail)
  }

  async function printInvoice(inv: Invoice) {
    const session = getStaffSession()
    if (!session) return
    setPrintLoadingId(inv.id)
    setError(null)
    try {
      const html = await staffFetchText(`/invoices/${inv.id}/print`, { token: session.token })
      setPrintPreview({ html, invoiceNumber: inv.invoiceNumber })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impression impossible')
    } finally {
      setPrintLoadingId(null)
    }
  }

  async function downloadFacturX(inv: Invoice) {
    const session = getStaffSession()
    if (!session) return
    setFacturXLoadingId(inv.id)
    setError(null)
    try {
      const xml = await staffFetchText(`/invoices/${inv.id}/factur-x`, { token: session.token })
      downloadTextFile(`facture-${inv.invoiceNumber}-factur-x.xml`, xml, 'application/xml;charset=utf-8')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export Factur-X impossible')
    } finally {
      setFacturXLoadingId(null)
    }
  }

  async function syncPennylane(inv: Invoice) {
    const session = getStaffSession()
    if (!session) return
    setPennylaneLoadingId(inv.id)
    setError(null)
    try {
      await staffFetch<{ pennylaneInvoiceId: number; created: boolean }>(
        `/invoices/${inv.id}/pennylane-sync`,
        { token: session.token, method: 'POST' },
      )
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Envoi Pennylane impossible')
      load()
    } finally {
      setPennylaneLoadingId(null)
    }
  }

  async function confirmSend(inv: Invoice, email: string) {
    const session = getStaffSession()
    if (!session) return
    const trimmed = email.trim()
    if (!trimmed) return

    setSendingId(inv.id)
    try {
      await staffFetch(`/invoices/${inv.id}/send`, {
        method: 'POST',
        token: session.token,
        body: JSON.stringify({ email: trimmed }),
      })
      setSendTarget(null)
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Envoi impossible')
    } finally {
      setSendingId(null)
    }
  }

  const invoiceStats = useMemo(() => {
    const issued = invoices.filter((i) => i.status === 'ISSUED' || i.status === 'SENT' || i.status === 'PAID')
    const drafts = invoices.filter((i) => i.status === 'DRAFT')
    const totalTtc = issued.reduce((s, i) => s + i.totalCents, 0)
    return { total: invoices.length, issued: issued.length, drafts: drafts.length, totalTtc }
  }, [invoices])

  const visibleInvoices = useMemo(
    () => (statusFilter === 'ALL' ? invoices : invoices.filter((i) => i.status === statusFilter)),
    [invoices, statusFilter],
  )

  const [invoiceSearch, setInvoiceSearch] = useState('')
  const [invoiceSorting, setInvoiceSorting] = useState<SortingState>([{ id: 'issueDate', desc: true }])
  const [invoicePagination, setInvoicePagination] = useState<PaginationState>(() => createDefaultPagination())

  const invoiceColumns = useMemo<ColumnDef<Invoice>[]>(
    () => [
      {
        accessorKey: 'invoiceNumber',
        header: ({ column }) => <DataGridColumnHeader title="N°" column={column} />,
        cell: ({ row }) => <span className="font-mono text-cream">{row.original.invoiceNumber}</span>,
      },
      {
        id: 'client',
        accessorFn: (row) => row.clientName,
        header: ({ column }) => <DataGridColumnHeader title="Client" column={column} />,
        cell: ({ row }) => {
          const inv = row.original
          return (
            <div className="text-cream">
              {inv.clientName}
              {inv.order ? <span className="ml-2 text-xs text-cream/40">cmd. {inv.order.orderNumber}</span> : null}
              {inv.missingFields?.length ? (
                <p className="mt-0.5 text-xs text-amber-300">Manque : {inv.missingFields.join(', ')}</p>
              ) : null}
              {inv.pennylaneSyncedAt ? (
                <p className="mt-0.5 text-xs text-emerald-300/80">Pennylane OK</p>
              ) : inv.pennylaneSyncError ? (
                <p className="mt-0.5 text-xs text-red-300/90" title={inv.pennylaneSyncError}>
                  Pennylane : erreur
                </p>
              ) : null}
            </div>
          )
        },
      },
      {
        id: 'issueDate',
        accessorFn: (row) => new Date(row.issueDate).getTime(),
        header: ({ column }) => <DataGridColumnHeader title="Date" column={column} />,
        cell: ({ row }) => (
          <span className="text-cream/70">{new Date(row.original.issueDate).toLocaleDateString('fr-FR')}</span>
        ),
      },
      {
        accessorKey: 'totalCents',
        header: ({ column }) => <DataGridColumnHeader title="Total" column={column} />,
        cell: ({ row }) => <span className="font-semibold text-cream">{formatEUR(row.original.totalCents)}</span>,
      },
      {
        accessorKey: 'status',
        header: ({ column }) => <DataGridColumnHeader title="Statut" column={column} />,
        cell: ({ row }) => {
          const inv = row.original
          return (
            <span
              className={cn(
                'rounded-full px-2.5 py-0.5 text-xs font-semibold',
                inv.status === 'SENT'
                  ? 'bg-emerald-500/15 text-emerald-200'
                  : inv.status === 'DRAFT'
                    ? 'bg-amber-500/15 text-amber-200'
                    : inv.status === 'ISSUED'
                      ? 'bg-blue-500/15 text-blue-200'
                      : 'bg-white/10 text-cream/60',
              )}
            >
              {STATUS_LABEL[inv.status] ?? inv.status}
            </span>
          )
        },
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">Actions</span>,
        enableSorting: false,
        cell: ({ row }) => {
          const inv = row.original
          return (
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                disabled={printLoadingId === inv.id}
                onClick={() => void printInvoice(inv)}
                className="inline-flex items-center gap-1 rounded-lg border border-white/15 px-2.5 py-1.5 text-xs text-cream hover:bg-white/5 disabled:opacity-50"
              >
                {printLoadingId === inv.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Printer className="h-3.5 w-3.5" />
                )}
                PDF
              </button>
              {(inv.clientSiret || inv.type === 'B2B') && (
                <button
                  type="button"
                  disabled={facturXLoadingId === inv.id}
                  onClick={() => void downloadFacturX(inv)}
                  title="Export XML Factur-X (profil minimum) — PDP sept. 2027"
                  className="inline-flex items-center gap-1 rounded-lg border border-sky-500/30 px-2.5 py-1.5 text-xs text-sky-200 hover:bg-sky-500/10 disabled:opacity-50"
                >
                  {facturXLoadingId === inv.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <FileCode className="h-3.5 w-3.5" />
                  )}
                  Factur-X
                </button>
              )}
              <button
                type="button"
                onClick={() => void openEdit(inv)}
                className="inline-flex items-center gap-1 rounded-lg border border-white/15 px-2.5 py-1.5 text-xs text-cream hover:bg-white/5"
              >
                <Edit2 className="h-3.5 w-3.5" />
                Modifier
              </button>
              <button
                type="button"
                disabled={sendingId === inv.id || inv.status === 'SENT'}
                onClick={() => void sendInvoice(inv)}
                className="inline-flex items-center gap-1 rounded-lg border border-white/15 px-2.5 py-1.5 text-xs text-cream hover:bg-white/5 disabled:opacity-50"
              >
                {sendingId === inv.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                Envoyer
              </button>
              {inv.status !== 'DRAFT' && inv.status !== 'CANCELLED' && (
                inv.order?.channel === 'DELIVEROO' || inv.order?.channel === 'UBER_EATS' ? (
                  <span
                    title="Déjà comptabilisée par le connecteur natif Deliveroo/Uber Eats dans Pennylane — ne pas la pousser en double."
                    className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-cream/35"
                  >
                    <Landmark className="h-3.5 w-3.5" />
                    Déjà dans Pennylane
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={pennylaneLoadingId === inv.id}
                    onClick={() => void syncPennylane(inv)}
                    title={
                      inv.pennylaneSyncedAt
                        ? 'Déjà synchronisée — recliquer pour vérifier côté Pennylane'
                        : 'Envoyer vers Pennylane (brouillon comptable)'
                    }
                    className="inline-flex items-center gap-1 rounded-lg border border-violet-500/30 px-2.5 py-1.5 text-xs text-violet-200 hover:bg-violet-500/10 disabled:opacity-50"
                  >
                    {pennylaneLoadingId === inv.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Landmark className="h-3.5 w-3.5" />
                    )}
                    {inv.pennylaneSyncedAt ? 'Pennylane ✓' : 'Pennylane'}
                  </button>
                )
              )}
            </div>
          )
        },
      },
    ],
    [printLoadingId, facturXLoadingId, sendingId, pennylaneLoadingId],
  )

  const invoicesTable = useReactTable({
    data: visibleInvoices,
    columns: invoiceColumns,
    state: { pagination: invoicePagination, sorting: invoiceSorting, globalFilter: invoiceSearch },
    onPaginationChange: setInvoicePagination,
    onSortingChange: setInvoiceSorting,
    onGlobalFilterChange: setInvoiceSearch,
    globalFilterFn: 'includesString',
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getRowId: (row) => row.id,
  })

  const draftCount = invoices.filter((i) => i.status === 'DRAFT').length

  const vatPreview = computeTotal(form.lines)

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <AdminPageHeader
        title="Facturation"
        description="Factures auto à chaque commande payée. Aperçu intégré pour PDF — export Factur-X XML pour clients B2B (PDP sept. 2027)."
        actions={
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-xl bg-tomato px-4 py-2.5 text-sm font-semibold text-white hover:bg-tomato/90"
          >
            <Plus className="h-4 w-4" />
            Nouvelle facture
          </button>
        }
      />

      <p className="text-sm text-cream/50 -mt-2">
        SIRET établissement dans{' '}
        <Link href="/admin/settings#facturation" className="text-tomato/90 underline">
          Paramètres → Facturation
        </Link>
        .
        {draftCount > 0 ? (
          <span className="ml-2 text-amber-200/90">
            {draftCount} brouillon(s) à compléter — infos client manquantes.
          </span>
        ) : null}
      </p>

      {error ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      <div className={ADMIN_STAT_GRID}>
        <AdminStatCard label="Factures" value={String(invoiceStats.total)} icon={FileText} />
        <AdminStatCard
          label="Émises / envoyées"
          value={String(invoiceStats.issued)}
          sub={`${invoiceStats.drafts} brouillon(s)`}
          icon={Send}
          tone="text-emerald-300"
        />
        <AdminStatCard
          label="Total TTC émis"
          value={formatEUR(invoiceStats.totalTtc)}
          icon={FileText}
          tone="text-tomato-light"
        />
        <AdminStatCard
          label="Brouillons"
          value={String(invoiceStats.drafts)}
          sub="À compléter"
          icon={Edit2}
          tone={invoiceStats.drafts > 0 ? 'text-amber-300' : undefined}
        />
      </div>

      <Link
        href="/admin/pos"
        className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-5 hover:bg-white/[0.04]"
      >
        <div>
          <h2 className="flex items-center gap-2 font-semibold text-cream">
            <Receipt className="h-4 w-4 text-tomato-light" />
            Facturer une vente comptoir SumUp
          </h2>
          <p className="text-xs text-cream/45">
            Paiements CB / espèces au comptoir — géré depuis Suivi caisse.
          </p>
        </div>
        <span className="text-sm text-tomato-light">Suivi caisse →</span>
      </Link>

      {formMode !== 'closed' ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-semibold text-cream">
              {formMode === 'edit' ? 'Modifier la facture' : 'Nouvelle facture'}
            </h2>
            <button type="button" onClick={closeForm} className="text-cream/50 hover:text-cream">
              <X className="h-5 w-5" />
            </button>
          </div>

          {formMode === 'create' ? (
            <div className="flex gap-2 border-b border-white/10 pb-3">
              <button
                type="button"
                onClick={() => setCreateTab('order')}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-sm font-medium',
                  createTab === 'order' ? 'bg-tomato/20 text-tomato-light' : 'text-cream/50 hover:bg-white/5'
                )}
              >
                <ShoppingBag className="mr-1.5 inline h-4 w-4" />
                Depuis une commande
              </button>
              <button
                type="button"
                onClick={() => setCreateTab('manual')}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-sm font-medium',
                  createTab === 'manual' ? 'bg-tomato/20 text-tomato-light' : 'text-cream/50 hover:bg-white/5'
                )}
              >
                Saisie manuelle
              </button>
            </div>
          ) : null}

          {formMode === 'create' && createTab === 'order' ? (
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cream/30" />
                <input
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  placeholder="N° commande, nom, téléphone, email…"
                  className="w-full rounded-xl border border-white/15 bg-white/[0.03] py-2.5 pl-10 pr-4 text-sm text-cream"
                />
              </div>
              {ordersLoading ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-6 w-6 animate-spin text-tomato/60" />
                </div>
              ) : orderResults.length === 0 ? (
                <p className="py-6 text-center text-sm text-cream/40">
                  Aucune commande payée trouvée sur cette période.
                </p>
              ) : (
                <ul className="max-h-64 space-y-2 overflow-y-auto">
                  {orderResults.map((order) => (
                    <li key={order.id}>
                      <button
                        type="button"
                        onClick={() => selectOrder(order)}
                        className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#1A1412] px-4 py-3 text-left hover:border-tomato/30"
                      >
                        <div>
                          <p className="font-semibold text-cream">
                            #{order.orderNumber}{' '}
                            <span className="font-normal text-cream/60">
                              {order.customerName || 'Sans nom'}
                            </span>
                          </p>
                          <p className="text-xs text-cream/40">
                            {new Date(order.createdAt).toLocaleString('fr-FR')} ·{' '}
                            {order.isOnlineOrder ? 'En ligne (TTC)' : 'Caisse (HT+TVA)'} ·{' '}
                            {order.lines.length} ligne(s)
                            {order.vat ? (
                              <> · TVA {formatEUR(order.vat.taxCents)}</>
                            ) : null}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-cream">{formatEUR(order.total)}</p>
                          {order.invoice ? (
                            <span className="text-xs text-amber-300">Facture n° {order.invoice.invoiceNumber}</span>
                          ) : (
                            <span className="text-xs text-emerald-300">Utiliser →</span>
                          )}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}

          {(formMode === 'edit' || createTab === 'manual') && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-xs text-cream/60">
                  Client / organisme *
                  <input
                    required
                    className={fieldClass}
                    value={form.clientName}
                    onChange={(e) => patchForm({ clientName: e.target.value })}
                  />
                </label>
                <label className="block text-xs text-cream/60">
                  Email
                  <input
                    type="email"
                    className={fieldClass}
                    value={form.clientEmail}
                    onChange={(e) => patchForm({ clientEmail: e.target.value })}
                  />
                </label>
                <label className="block text-xs text-cream/60">
                  Téléphone
                  <input
                    className={fieldClass}
                    value={form.clientPhone}
                    onChange={(e) => patchForm({ clientPhone: e.target.value })}
                  />
                </label>
                <label className="block text-xs text-cream/60">
                  SIRET client (B2B)
                  <input
                    className={fieldClass}
                    value={form.clientSiret}
                    onChange={(e) => patchForm({ clientSiret: e.target.value })}
                  />
                </label>
                <label className="block text-xs text-cream/60 sm:col-span-2">
                  Adresse client
                  <input
                    className={fieldClass}
                    value={form.clientAddress}
                    onChange={(e) => patchForm({ clientAddress: e.target.value })}
                  />
                </label>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-cream/45">Lignes commande</p>
                {form.lines.map((line, i) => (
                  <div key={i} className="grid gap-2 sm:grid-cols-12 items-end">
                    <label className="sm:col-span-5 block text-xs text-cream/60">
                      Désignation
                      <input
                        required
                        className={fieldClass}
                        value={line.description}
                        onChange={(e) => updateLine(i, { description: e.target.value })}
                      />
                    </label>
                    <label className="sm:col-span-2 block text-xs text-cream/60">
                      Qté
                      <input
                        type="number"
                        min={0.01}
                        step={0.01}
                        className={fieldClass}
                        value={line.quantity}
                        onChange={(e) => updateLine(i, { quantity: Number(e.target.value) || 1 })}
                      />
                    </label>
                    <label className="sm:col-span-2 block text-xs text-cream/60">
                      P.U. HT (€)
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        className={fieldClass}
                        value={(line.unitPriceCents / 100).toFixed(2)}
                        onChange={(e) =>
                          updateLine(i, { unitPriceCents: eurosToCents(Number(e.target.value)) })
                        }
                      />
                    </label>
                    <label className="sm:col-span-2 block text-xs text-cream/60">
                      TVA %
                      <input
                        type="number"
                        className={fieldClass}
                        value={line.taxRate}
                        onChange={(e) => updateLine(i, { taxRate: Number(e.target.value) || 10 })}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => removeLine(i)}
                      className="sm:col-span-1 mb-2 rounded-lg p-2 text-cream/40 hover:bg-white/5 hover:text-red-300"
                    >
                      <Trash2 className="h-4 w-4 mx-auto" />
                    </button>
                  </div>
                ))}
                <button type="button" onClick={addLine} className="text-sm text-tomato/90 hover:underline">
                  + Ajouter une ligne
                </button>
              </div>

              <label className="block text-xs text-cream/60">
                Notes
                <textarea
                  className={fieldClass}
                  rows={2}
                  value={form.notes}
                  onChange={(e) => patchForm({ notes: e.target.value })}
                />
              </label>

              <div className="flex flex-wrap items-end justify-between gap-4 border-t border-white/10 pt-4">
                <div className="space-y-1 text-sm">
                  <p className="text-cream/50">
                    Prix unitaires saisis <strong className="text-cream/80">HT</strong> — TVA calculée par
                    ligne (taux paramétré dans Paramètres, ex. 10&nbsp;% restauration).
                  </p>
                  <p className="text-cream/70">
                    Sous-total HT : <strong className="text-cream">{formatEUR(vatPreview.subtotalHt)}</strong>
                  </p>
                  <p className="text-cream/70">
                    TVA : <strong className="text-cream">{formatEUR(vatPreview.taxCents)}</strong>
                  </p>
                  <p className="text-lg font-semibold text-cream">
                    Total TTC : {formatEUR(vatPreview.totalTtc)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void saveForm(false)}
                    className="rounded-xl border border-white/15 px-4 py-2.5 text-sm text-cream hover:bg-white/5 disabled:opacity-50"
                  >
                    Enregistrer brouillon
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void saveForm(true)}
                    className="inline-flex items-center gap-2 rounded-xl bg-tomato px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                    Émettre la facture
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-tomato/60" />
        </div>
      ) : invoices.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-white/15 py-16 text-center text-cream/45">
          Les factures apparaîtront ici automatiquement après chaque commande payée, ou créez-en une
          manuellement.
        </p>
      ) : (
        <AdminDataGridShell
          title="Factures"
          table={invoicesTable}
          recordCount={invoicesTable.getFilteredRowModel().rows.length}
          search={invoiceSearch}
          onSearchChange={setInvoiceSearch}
          searchPlaceholder="N°, client…"
          emptyMessage="Aucun résultat pour ce filtre"
          headerExtra={
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-white/15 bg-white/[0.03] px-3 py-2 text-sm text-cream outline-none focus:border-tomato/40"
            >
              <option value="ALL">Tous les statuts</option>
              {Object.entries(STATUS_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          }
        />
      )}

      {printPreview && (
        <AdminPrintPreview
          title={`Facture n°${printPreview.invoiceNumber}`}
          html={printPreview.html}
          onClose={() => setPrintPreview(null)}
        />
      )}

      {sendTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#1A1412] p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold text-cream">Envoyer la facture n°{sendTarget.inv.invoiceNumber}</h3>
              <button type="button" onClick={() => setSendTarget(null)}>
                <X className="h-5 w-5 text-cream/40" />
              </button>
            </div>
            <label className="block text-xs text-cream/50">
              Email destinataire
              <input
                type="email"
                value={sendTarget.email}
                onChange={(e) => setSendTarget({ ...sendTarget, email: e.target.value })}
                className={fieldClass}
                placeholder="client@exemple.fr"
                autoFocus
              />
            </label>
            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={() => setSendTarget(null)}
                className="flex-1 rounded-xl border border-white/15 py-2 text-sm"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={!sendTarget.email.trim() || sendingId === sendTarget.inv.id}
                onClick={() => void confirmSend(sendTarget.inv, sendTarget.email)}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-tomato py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {sendingId === sendTarget.inv.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Mail className="h-4 w-4" />
                )}
                Envoyer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
