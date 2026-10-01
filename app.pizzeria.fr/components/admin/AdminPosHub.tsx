'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { CreditCard, FileText, Loader2, RefreshCw, Upload, Wallet, X } from 'lucide-react'
import { AdminPageHeader } from '@/components/admin/AdminSectionTabs'
import { ADMIN_STAT_GRID, AdminStatCard } from '@/components/admin/AdminStatCard'
import { AdminDataGridShell, DataGridColumnHeader } from '@/components/ui/data-grid'
import { getStaffSession } from '@/lib/staff-auth'
import { staffFetch } from '@/lib/staff-api'
import { formatEUR } from '@/lib/money'
import { periodToDateRange, type ArchivePeriod, type CustomRange } from '@/lib/order-period'
import { PeriodPicker, defaultCustomRange } from '@/components/admin/PeriodPicker'

const fieldClass =
  'mt-1 w-full rounded-xl border border-white/15 bg-white/[0.03] px-3 py-2 text-sm text-cream outline-none focus:border-tomato/40'

/** Cap serveur (sumup-transaction-sync.ts) — au-delà, la liste est tronquée silencieusement
 * sans cette valeur pour comparer et prévenir qu'il y a plus de résultats que ce qui est affiché. */
const SERVER_MAX_LIMIT = 500

type SumupTransactionRow = {
  id: string
  amountCents: number
  paymentType: string
  productSummary: string | null
  occurredAt: string
  invoiceId: string | null
}

const PAYMENT_TYPE_LABEL: Record<string, string> = {
  POS: 'Comptoir CB',
  CASH: 'Comptoir espèces',
  ECOM: 'En ligne',
}

const PAGINATION_SIZES = [5, 10, 50] as const

/** Suivi caisse = encaissements comptoir SumUp (cache API), indépendant du module POS (désactivé). */
export function AdminPosHub() {
  const [period, setPeriod] = useState<ArchivePeriod>('today')
  const [custom, setCustom] = useState<CustomRange>(() => defaultCustomRange())
  const [transactions, setTransactions] = useState<SumupTransactionRow[]>([])
  const [truncated, setTruncated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [search, setSearch] = useState('')
  const [sorting, setSorting] = useState<SortingState>([{ id: 'occurredAt', desc: true }])
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 })
  const [billTarget, setBillTarget] = useState<SumupTransactionRow | null>(null)
  const [billForm, setBillForm] = useState({ clientName: '', clientEmail: '', clientPhone: '', clientAddress: '' })
  const [billing, setBilling] = useState(false)
  const [billError, setBillError] = useState<string | null>(null)

  const range = useMemo(
    () => periodToDateRange(period, period === 'custom' ? custom : undefined),
    [period, custom],
  )

  const load = useCallback(async () => {
    const session = getStaffSession()
    if (!session) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ billed: 'all', limit: String(SERVER_MAX_LIMIT) })
      if (range.dateFrom) params.set('from', range.dateFrom)
      if (range.dateTo) params.set('to', range.dateTo)
      const res = await staffFetch<{ transactions: SumupTransactionRow[] }>(
        `/payments/sumup/transactions?${params.toString()}`,
        { token: session.token },
      )
      setTransactions(res.transactions)
      // Le serveur plafonne à SERVER_MAX_LIMIT — si on l'atteint pile, des transactions plus
      // anciennes existent sûrement mais ne sont pas dans la liste, sans qu'on le voie sinon.
      setTruncated(res.transactions.length >= SERVER_MAX_LIMIT)
    } finally {
      setLoading(false)
    }
  }, [range])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    setPagination((p) => ({ ...p, pageIndex: 0 }))
  }, [range, search])

  async function sync() {
    const session = getStaffSession()
    if (!session) return
    setSyncing(true)
    setSyncMsg(null)
    try {
      const res = await staffFetch<{ synced: number }>('/payments/sumup/transactions/sync', {
        token: session.token,
        method: 'POST',
      })
      setSyncMsg(`${res.synced} transaction(s) synchronisée(s).`)
      await load()
    } catch (e) {
      setSyncMsg(e instanceof Error ? e.message : 'Synchro impossible')
    } finally {
      setSyncing(false)
    }
  }

  async function importJournal(file: File) {
    const session = getStaffSession()
    if (!session) return
    setImporting(true)
    setImportMsg(null)
    try {
      const csv = await file.text()
      const res = await staffFetch<{ matched: number; unmatched: string[] }>(
        '/payments/sumup/transactions/import-journal',
        { token: session.token, method: 'POST', body: JSON.stringify({ csv }) },
      )
      const parts = [`${res.matched} transaction(s) complétée(s) avec le détail produit.`]
      if (res.unmatched.length > 0) {
        parts.push(
          `${res.unmatched.length} non trouvée(s) dans le cache (pas encore synchronisées ou hors période) — resynchronisez et réessayez.`,
        )
      }
      setImportMsg(parts.join(' '))
      await load()
    } catch (e) {
      setImportMsg(e instanceof Error ? e.message : 'Import impossible')
    } finally {
      setImporting(false)
    }
  }

  function openBillModal(txn: SumupTransactionRow) {
    setBillTarget(txn)
    setBillForm({ clientName: '', clientEmail: '', clientPhone: '', clientAddress: '' })
    setBillError(null)
  }

  async function confirmBill() {
    const session = getStaffSession()
    if (!session || !billTarget) return
    if (!billForm.clientName.trim()) {
      setBillError('Nom client obligatoire')
      return
    }
    setBilling(true)
    setBillError(null)
    try {
      await staffFetch(`/invoices/from-sumup-transaction/${billTarget.id}`, {
        method: 'POST',
        token: session.token,
        body: JSON.stringify({
          clientName: billForm.clientName,
          clientEmail: billForm.clientEmail || undefined,
          clientPhone: billForm.clientPhone || undefined,
          clientAddress: billForm.clientAddress || undefined,
        }),
      })
      setBillTarget(null)
      await load()
    } catch (e) {
      setBillError(e instanceof Error ? e.message : 'Facturation impossible')
    } finally {
      setBilling(false)
    }
  }

  const total = transactions.reduce((s, t) => s + t.amountCents, 0)
  const cb = transactions.filter((t) => t.paymentType === 'POS')
  const cash = transactions.filter((t) => t.paymentType === 'CASH')
  const unbilled = transactions.filter((t) => !t.invoiceId)

  const columns = useMemo<ColumnDef<SumupTransactionRow>[]>(
    () => [
      {
        id: 'occurredAt',
        accessorFn: (row) => new Date(row.occurredAt).getTime(),
        header: ({ column }) => <DataGridColumnHeader title="Date" column={column} />,
        cell: ({ row }) => (
          <span className="text-cream/70">
            {new Date(row.original.occurredAt).toLocaleString('fr-FR')}
          </span>
        ),
      },
      {
        accessorKey: 'paymentType',
        header: ({ column }) => <DataGridColumnHeader title="Type" column={column} />,
        cell: ({ row }) => (
          <span className="text-cream/70">
            {PAYMENT_TYPE_LABEL[row.original.paymentType] ?? row.original.paymentType}
          </span>
        ),
      },
      {
        id: 'productSummary',
        accessorFn: (row) => row.productSummary ?? '',
        header: ({ column }) => <DataGridColumnHeader title="Détail" column={column} />,
        cell: ({ row }) => (
          <span className="text-cream/50">{row.original.productSummary ?? '—'}</span>
        ),
      },
      {
        accessorKey: 'amountCents',
        header: ({ column }) => <DataGridColumnHeader title="Montant" column={column} />,
        cell: ({ row }) => (
          <span className="font-semibold tabular-nums text-cream">
            {formatEUR(row.original.amountCents)}
          </span>
        ),
      },
      {
        id: 'invoiceId',
        accessorFn: (row) => (row.invoiceId ? 1 : 0),
        header: ({ column }) => <DataGridColumnHeader title="Facture" column={column} />,
        cell: ({ row }) =>
          row.original.invoiceId ? (
            <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-200">
              Facturée
            </span>
          ) : (
            <button
              type="button"
              onClick={() => openBillModal(row.original)}
              className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold text-amber-200 hover:bg-amber-500/25"
            >
              Facturer
            </button>
          ),
      },
    ],
    [],
  )

  const table = useReactTable({
    data: transactions,
    columns,
    state: { pagination, sorting, globalFilter: search },
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
    onGlobalFilterChange: setSearch,
    globalFilterFn: 'includesString',
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getRowId: (row) => row.id,
  })

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <AdminPageHeader
        title="Suivi caisse"
        description="Encaissements comptoir SumUp — CB et espèces enregistrés sur le lecteur boutique."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (file) void importJournal(file)
              }}
            />
            <button
              type="button"
              disabled={importing}
              onClick={() => fileInputRef.current?.click()}
              title='Importe le détail produit depuis le rapport "Ventes" exporté manuellement sur SumUp (l’API ne le fournit pas)'
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm text-cream hover:bg-white/5 disabled:opacity-50"
            >
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Importer détail (CSV)
            </button>
            <button
              type="button"
              disabled={syncing}
              onClick={() => void sync()}
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm text-cream hover:bg-white/5 disabled:opacity-50"
            >
              {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Synchroniser
            </button>
            <PeriodPicker period={period} custom={custom} onPeriodChange={setPeriod} onCustomChange={setCustom} />
          </div>
        }
      />

      {syncMsg && (
        <p className={syncMsg.includes('impossible') ? 'text-sm text-red-300' : 'text-sm text-emerald-300'}>
          {syncMsg}
        </p>
      )}
      {importMsg && (
        <p className={importMsg.includes('impossible') ? 'text-sm text-red-300' : 'text-sm text-emerald-300'}>
          {importMsg}
        </p>
      )}
      {truncated && (
        <p className="text-sm text-amber-300">
          Plus de {SERVER_MAX_LIMIT} transactions sur cette période — les plus anciennes ne sont pas affichées.
          Réduisez la période pour tout voir.
        </p>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-tomato-light" />
        </div>
      ) : (
        <>
          <div className={ADMIN_STAT_GRID}>
            <AdminStatCard
              label="Total encaissé"
              value={formatEUR(total)}
              sub={`${transactions.length} vente(s)`}
              icon={Wallet}
              tone="text-emerald-300"
            />
            <AdminStatCard
              label="Carte bancaire"
              value={formatEUR(cb.reduce((s, t) => s + t.amountCents, 0))}
              sub={`${cb.length} vente(s)`}
              icon={CreditCard}
            />
            <AdminStatCard
              label="Espèces"
              value={formatEUR(cash.reduce((s, t) => s + t.amountCents, 0))}
              sub={`${cash.length} vente(s)`}
            />
            <AdminStatCard
              label="Non facturées"
              value={unbilled.length}
              sub="À facturer sur demande"
              icon={FileText}
              tone={unbilled.length > 0 ? 'text-amber-300' : undefined}
            />
          </div>

          <AdminDataGridShell
            title="Encaissements"
            table={table}
            recordCount={table.getFilteredRowModel().rows.length}
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Rechercher un montant, un détail…"
            emptyMessage={
              transactions.length === 0
                ? 'Aucun encaissement sur cette période'
                : 'Aucun résultat pour ce filtre'
            }
            paginationSizes={PAGINATION_SIZES}
          />
        </>
      )}

      {billTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#1A1412] p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold text-cream">Facturer {formatEUR(billTarget.amountCents)}</h3>
              <button type="button" onClick={() => setBillTarget(null)}>
                <X className="h-5 w-5 text-cream/40" />
              </button>
            </div>
            <div className="space-y-3">
              <label className="block text-xs text-cream/50">
                Client / organisme *
                <input
                  required
                  autoFocus
                  className={fieldClass}
                  value={billForm.clientName}
                  onChange={(e) => setBillForm((f) => ({ ...f, clientName: e.target.value }))}
                />
              </label>
              <label className="block text-xs text-cream/50">
                Email
                <input
                  type="email"
                  className={fieldClass}
                  value={billForm.clientEmail}
                  onChange={(e) => setBillForm((f) => ({ ...f, clientEmail: e.target.value }))}
                />
              </label>
              <label className="block text-xs text-cream/50">
                Téléphone
                <input
                  className={fieldClass}
                  value={billForm.clientPhone}
                  onChange={(e) => setBillForm((f) => ({ ...f, clientPhone: e.target.value }))}
                />
              </label>
              <label className="block text-xs text-cream/50">
                Adresse
                <input
                  className={fieldClass}
                  value={billForm.clientAddress}
                  onChange={(e) => setBillForm((f) => ({ ...f, clientAddress: e.target.value }))}
                />
              </label>
            </div>
            {billError ? <p className="mt-3 text-sm text-red-300">{billError}</p> : null}
            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={() => setBillTarget(null)}
                className="flex-1 rounded-xl border border-white/15 py-2 text-sm"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={billing || !billForm.clientName.trim()}
                onClick={() => void confirmBill()}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-tomato py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {billing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                Émettre la facture
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
