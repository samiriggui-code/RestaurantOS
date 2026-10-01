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
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  FileDown,
  HardDrive,
  Loader2,
  Receipt,
  Scale,
  ShieldCheck,
  X,
  XCircle,
} from 'lucide-react'
import { getStaffSession } from '@/lib/staff-auth'
import { staffFetchText } from '@/lib/staff-api'
import { AdminPrintPreview } from '@/components/admin/AdminPrintPreview'
import { useAdminFeedback } from '@/components/admin/AdminFeedbackProvider'
import { AdminPageHeader, AdminSectionTabs, AdminPageShell } from '@/components/admin/AdminSectionTabs'
import { ADMIN_STAT_GRID, AdminStatCard } from '@/components/admin/AdminStatCard'
import { formatEUR } from '@/lib/money'
import {
  downloadFiscalArchive,
  exportFiscalYearArchive,
  fetchFiscalArchives,
  fetchFiscalConfig,
  fetchFiscalBackups,
  fetchFiscalClosureStatus,
  fetchFiscalClosures,
  fetchFiscalEvents,
  fetchFiscalSequence,
  fetchFiscalTickets,
  fetchFiscalVerify,
  issueFiscalVoid,
  type FiscalArchiveRow,
  type FiscalClosureRow,
  type FiscalEventRow,
  type FiscalTicketRow,
  type FiscalVerifyResult,
  type FiscalClosureStatus,
  type FiscalConfigSummary,
  type FiscalBackupRow,
} from '@/lib/fiscal-api'
import { FiscalDailyCloseWizard } from '@/components/admin/FiscalDailyCloseWizard'
import { AdminDataGridShell, DataGridColumnHeader, createDefaultPagination } from '@/components/ui/data-grid'

type FiscalTab = 'overview' | 'tickets' | 'journal' | 'closures' | 'archives'

const KIND_LABEL: Record<string, string> = {
  SALE: 'Vente',
  VOID: 'Avoir',
  TRAINING: 'Formation',
}

const EVENT_LABEL: Record<string, string> = {
  TICKET_ISSUED: 'Ticket vente',
  TICKET_SALE: 'Ticket vente',
  TICKET_VOID: 'Avoir',
  REPRINT: 'DUPLICATA',
  CLOSURE_DAILY: 'Clôture Z',
  OFFLINE_INTEGRATED: 'Intégration offline',
  OFFLINE_SALE: 'Vente offline',
  ARCHIVE_YEARLY: 'Archive annuelle',
  SOFTWARE_START: 'Démarrage logiciel',
  OPERATOR_LOGIN: 'Connexion opérateur',
  OPERATOR_LOGOUT: 'Déconnexion opérateur',
  PRICE_CHANGE: 'Changement de prix',
  TRAINING_MODE_ON: 'Mode formation ON',
  TRAINING_MODE_OFF: 'Mode formation OFF',
  FISCAL_ACTIVATION: 'Mise en service ISCA',
}

function grandTotalCentsToNumber(value: string): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function hashPreview(hash: string): string {
  return hash.slice(0, 10).toUpperCase()
}

export function AdminFiscalView() {
  const { confirm } = useAdminFeedback()
  const [tab, setTab] = useState<FiscalTab>('overview')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const { error, setError, message, setMessage, setWarning } = useFeedbackState()

  const [sequence, setSequence] = useState<{
    nextTicketNo: number
    grandTotalCents: string
    softwareVersion: string
    commissionedAt: string
  } | null>(null)
  const [verify, setVerify] = useState<FiscalVerifyResult | null>(null)
  const [tickets, setTickets] = useState<FiscalTicketRow[]>([])
  const [events, setEvents] = useState<FiscalEventRow[]>([])
  const [closures, setClosures] = useState<FiscalClosureRow[]>([])
  const [archives, setArchives] = useState<FiscalArchiveRow[]>([])
  const [exportYear, setExportYear] = useState(() => new Date().getFullYear() - 1)
  const [voidTarget, setVoidTarget] = useState<FiscalTicketRow | null>(null)
  const [voidReason, setVoidReason] = useState('')
  const [printPreview, setPrintPreview] = useState<{ html: string; title: string } | null>(null)
  const [journalPrintLoading, setJournalPrintLoading] = useState(false)
  const [closureStatus, setClosureStatus] = useState<FiscalClosureStatus | null>(null)
  const [fiscalConfig, setFiscalConfig] = useState<FiscalConfigSummary | null>(null)
  const [closeWizardOpen, setCloseWizardOpen] = useState(false)
  const [wizardDayKey, setWizardDayKey] = useState<string | undefined>()
  const [backupMonth, setBackupMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [backups, setBackups] = useState<FiscalBackupRow[]>([])
  const [backupsLoading, setBackupsLoading] = useState(false)
  const [backupsError, setBackupsError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    const session = getStaffSession()
    if (!session) return
    setLoading(true)
    setError(null)
    const failures: string[] = []

    const tasks = [
      { key: 'sequence', run: () => fetchFiscalSequence(session.token) },
      { key: 'verify', run: () => fetchFiscalVerify(session.token) },
      { key: 'tickets', run: () => fetchFiscalTickets(session.token, 80) },
      { key: 'events', run: () => fetchFiscalEvents(session.token, 120) },
      { key: 'closures', run: () => fetchFiscalClosures(session.token, 40) },
      { key: 'archives', run: () => fetchFiscalArchives(session.token) },
      { key: 'closure-status', run: () => fetchFiscalClosureStatus(session.token) },
      { key: 'fiscal-config', run: () => fetchFiscalConfig(session.token) },
    ] as const

    const results = await Promise.allSettled(tasks.map((t) => t.run()))

    for (let i = 0; i < results.length; i++) {
      const result = results[i]!
      const key = tasks[i]!.key
      if (result.status === 'rejected') {
        failures.push(`${key}: ${result.reason instanceof Error ? result.reason.message : 'erreur'}`)
        continue
      }
      const value = result.value
      if (key === 'sequence' && value && 'sequence' in value) setSequence(value.sequence)
      if (key === 'verify') setVerify(value as FiscalVerifyResult)
      if (key === 'tickets' && value && 'tickets' in value) setTickets(value.tickets)
      if (key === 'events' && value && 'events' in value) setEvents(value.events)
      if (key === 'closures' && value && 'closures' in value) setClosures(value.closures)
      if (key === 'archives' && value && 'archives' in value) setArchives(value.archives)
      if (key === 'closure-status') setClosureStatus(value as FiscalClosureStatus)
      if (key === 'fiscal-config') setFiscalConfig(value as FiscalConfigSummary)
    }

    if (failures.length === tasks.length) {
      setError(
        failures.some((f) => f.includes('500') || f.includes('Internal'))
          ? 'Module fiscal indisponible — exécutez la migration ISCA sur le serveur (prisma migrate deploy).'
          : failures.join(' · '),
      )
    } else if (failures.length) {
      setWarning(`Certaines sections n'ont pas chargé : ${failures.join(' · ')}`)
    }

    setLoading(false)
  }, [setError, setWarning])

  const loadBackups = useCallback(async () => {
    const session = getStaffSession()
    if (!session) return
    setBackupsLoading(true)
    setBackupsError(null)
    try {
      const result = await fetchFiscalBackups(session.token, backupMonth)
      setBackups(result.backups)
    } catch (e) {
      setBackups([])
      setBackupsError(e instanceof Error ? e.message : 'Impossible de charger les sauvegardes')
    } finally {
      setBackupsLoading(false)
    }
  }, [backupMonth])

  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(() => {
    if (tab === 'archives') {
      void loadBackups()
    }
  }, [tab, loadBackups])

  const duplicataCount = useMemo(
    () => events.filter((e) => e.eventType === 'REPRINT').length,
    [events],
  )

  const voidedSaleIds = useMemo(
    () => new Set(tickets.filter((t) => t.kind === 'VOID' && t.voidOfId).map((t) => t.voidOfId!)),
    [tickets],
  )

  const [ticketsSearch, setTicketsSearch] = useState('')
  const [ticketsSorting, setTicketsSorting] = useState<SortingState>([{ id: 'issuedAt', desc: true }])
  const [ticketsPagination, setTicketsPagination] = useState<PaginationState>(() => createDefaultPagination())

  const ticketColumns = useMemo<ColumnDef<FiscalTicketRow>[]>(
    () => [
      {
        accessorKey: 'serialNumber',
        header: ({ column }) => <DataGridColumnHeader title="N°" column={column} />,
        cell: ({ row }) => <span className="font-mono text-cream">{row.original.serialNumber}</span>,
      },
      {
        accessorKey: 'kind',
        header: ({ column }) => <DataGridColumnHeader title="Type" column={column} />,
        cell: ({ row }) => (
          <span className="text-cream/80">{KIND_LABEL[row.original.kind] ?? row.original.kind}</span>
        ),
      },
      {
        id: 'issuedAt',
        accessorFn: (row) => new Date(row.issuedAt).getTime(),
        header: ({ column }) => <DataGridColumnHeader title="Date" column={column} />,
        cell: ({ row }) => (
          <span className="text-cream/70">{new Date(row.original.issuedAt).toLocaleString('fr-FR')}</span>
        ),
      },
      {
        accessorKey: 'totalCents',
        header: ({ column }) => <DataGridColumnHeader title="Montant" column={column} />,
        cell: ({ row }) => <span className="tabular-nums text-cream">{formatEUR(row.original.totalCents)}</span>,
      },
      {
        accessorKey: 'paymentMethod',
        header: ({ column }) => <DataGridColumnHeader title="Paiement" column={column} />,
        cell: ({ row }) => <span className="text-cream/60">{row.original.paymentMethod ?? '—'}</span>,
      },
      {
        id: 'order',
        header: () => <span className="text-xs font-medium uppercase tracking-wide text-cream/45">Commande</span>,
        enableSorting: false,
        cell: ({ row }) =>
          row.original.orderId ? (
            <Link
              href={`/admin/orders?order=${row.original.orderId}`}
              className="text-xs text-tomato/90 hover:underline"
            >
              Voir cmd.
            </Link>
          ) : row.original.offlineRef ? (
            <span className="font-mono text-xs text-amber-300/90">{row.original.offlineRef}</span>
          ) : (
            '—'
          ),
      },
      {
        id: 'hash',
        header: () => <span className="text-xs font-medium uppercase tracking-wide text-cream/45">Empreinte</span>,
        enableSorting: false,
        cell: ({ row }) => (
          <span className="font-mono text-xs text-cream/50">{hashPreview(row.original.recordHash)}</span>
        ),
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">Actions</span>,
        enableSorting: false,
        cell: ({ row }) => {
          const t = row.original
          const canVoid = t.kind === 'SALE' && !voidedSaleIds.has(t.id) && busy !== `void-${t.id}`
          return (
            <div className="flex justify-end">
              {canVoid ? (
                <button
                  type="button"
                  disabled={busy === `void-${t.id}`}
                  onClick={() => openVoidModal(t)}
                  className="rounded-lg border border-red-500/30 px-2.5 py-1 text-xs text-red-200 hover:bg-red-500/10 disabled:opacity-50"
                >
                  Avoir
                </button>
              ) : t.kind === 'SALE' && voidedSaleIds.has(t.id) ? (
                <span className="text-xs text-cream/35">Annulé</span>
              ) : null}
            </div>
          )
        },
      },
    ],
    [voidedSaleIds, busy],
  )

  const ticketsTable = useReactTable({
    data: tickets,
    columns: ticketColumns,
    state: { pagination: ticketsPagination, sorting: ticketsSorting, globalFilter: ticketsSearch },
    onPaginationChange: setTicketsPagination,
    onSortingChange: setTicketsSorting,
    onGlobalFilterChange: setTicketsSearch,
    globalFilterFn: 'includesString',
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getRowId: (row) => row.id,
  })

  const [backupsSearch, setBackupsSearch] = useState('')
  const [backupsSorting, setBackupsSorting] = useState<SortingState>([{ id: 'createdAt', desc: true }])
  const [backupsPagination, setBackupsPagination] = useState<PaginationState>(() => createDefaultPagination())

  const backupColumns = useMemo<ColumnDef<FiscalBackupRow>[]>(
    () => [
      {
        id: 'createdAt',
        accessorFn: (row) => new Date(row.createdAt).getTime(),
        header: ({ column }) => <DataGridColumnHeader title="Date" column={column} />,
        cell: ({ row }) => (
          <span className="text-cream/80">{new Date(row.original.createdAt).toLocaleString('fr-FR')}</span>
        ),
      },
      {
        accessorKey: 'kindLabel',
        header: ({ column }) => <DataGridColumnHeader title="Type" column={column} />,
        cell: ({ row }) => <span className="text-cream/80">{row.original.kindLabel}</span>,
      },
      {
        accessorKey: 'filename',
        header: ({ column }) => <DataGridColumnHeader title="Fichier" column={column} />,
        cell: ({ row }) => (
          <span className="font-mono text-xs text-cream/70">{row.original.filename}</span>
        ),
      },
      {
        accessorKey: 'sizeBytes',
        header: ({ column }) => <DataGridColumnHeader title="Taille" column={column} />,
        cell: ({ row }) => <span className="tabular-nums text-cream/70">{row.original.sizeLabel}</span>,
      },
      {
        accessorKey: 'source',
        header: ({ column }) => <DataGridColumnHeader title="Emplacement" column={column} />,
        cell: ({ row }) => (
          <span className="text-cream/60">
            {row.original.source === 'minio' ? 'Coffre MinIO' : 'Copie locale VPS'}
          </span>
        ),
      },
      {
        id: 'status',
        header: () => <span className="text-xs font-medium uppercase tracking-wide text-cream/45">Statut</span>,
        enableSorting: false,
        cell: () => (
          <span className="inline-flex items-center gap-1 text-xs text-emerald-300/90">
            <CheckCircle2 className="h-3.5 w-3.5" />
            OK
          </span>
        ),
      },
    ],
    [],
  )

  const backupsTable = useReactTable({
    data: backups,
    columns: backupColumns,
    state: { pagination: backupsPagination, sorting: backupsSorting, globalFilter: backupsSearch },
    onPaginationChange: setBackupsPagination,
    onSortingChange: setBackupsSorting,
    onGlobalFilterChange: setBackupsSearch,
    globalFilterFn: 'includesString',
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getRowId: (row) => row.id,
  })

  function openCloseWizard(dayKey?: string) {
    setError(null)
    setWizardDayKey(dayKey)
    setCloseWizardOpen(true)
  }

  async function handleVoidTicket() {
    if (!voidTarget) return
    const reason = voidReason.trim()
    if (!reason) {
      setWarning('Le motif de l\'avoir est obligatoire.')
      return
    }
    const session = getStaffSession()
    if (!session) return
    setBusy(`void-${voidTarget.id}`)
    setMessage(null)
    setError(null)
    try {
      await issueFiscalVoid(session.token, voidTarget.id, reason)
      setMessage(`Avoir émis pour le ticket n°${voidTarget.serialNumber}.`)
      setVoidTarget(null)
      setVoidReason('')
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Avoir impossible')
    } finally {
      setBusy(null)
    }
  }

  function openVoidModal(ticket: FiscalTicketRow) {
    setVoidTarget(ticket)
    setVoidReason('')
    setError(null)
  }

  async function exportJournalPdf() {
    const session = getStaffSession()
    if (!session) return
    setJournalPrintLoading(true)
    setError(null)
    try {
      const html = await staffFetchText('/fiscal/print/journal', { token: session.token })
      setPrintPreview({ html, title: 'Journal fiscal ISCA' })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export journal impossible')
    } finally {
      setJournalPrintLoading(false)
    }
  }

  async function handleExportYear() {
    const session = getStaffSession()
    if (!session) return
    if (
      !(await confirm({
        title: `Archive exercice ${exportYear}`,
        message: `Exporter l'exercice ${exportYear} ? L'archive sera figée et ne pourra plus être régénérée.`,
        confirmLabel: 'Exporter',
        destructive: true,
      }))
    ) {
      return
    }
    setBusy('export')
    setMessage(null)
    setError(null)
    try {
      await exportFiscalYearArchive(session.token, exportYear)
      setMessage(`Archive ${exportYear} exportée.`)
      await reload()
      setTab('archives')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export impossible')
    } finally {
      setBusy(null)
    }
  }

  async function handleDownloadYear(year: number) {
    const session = getStaffSession()
    if (!session) return
    setBusy(`dl-${year}`)
    try {
      const blob = await downloadFiscalArchive(session.token, year)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `fiscal-archive-${year}.json`
      a.click()
      URL.revokeObjectURL(url)
      setMessage(`Archive ${year} téléchargée.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Téléchargement impossible')
    } finally {
      setBusy(null)
    }
  }

  return (
    <AdminPageShell>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-cream/70 transition hover:border-white/20 hover:bg-white/[0.06] hover:text-cream"
          title="Retour tableau de bord"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline">Tableau de bord</span>
        </Link>
        <span className="inline-flex items-center gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-sm font-semibold text-amber-100">
          <Scale className="h-4 w-4 shrink-0" />
          Fiscal ISCA
        </span>
      </div>

      <AdminPageHeader
        title="Fiscal ISCA"
        description="Consultation des tickets, journal JET, clôture Z et contrôle d'intégrité de la chaîne cryptographique (article 286 CGI)."
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void exportJournalPdf()}
              disabled={journalPrintLoading}
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm text-cream/80 hover:bg-white/5 disabled:opacity-50"
            >
              {journalPrintLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileDown className="h-4 w-4" />
              )}
              Journal PDF
            </button>
            <button
              type="button"
              onClick={() => void reload()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm text-cream/80 hover:bg-white/5 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              Actualiser
            </button>
          </div>
        }
      />

      {error ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {message}
        </p>
      ) : null}

      {closureStatus?.needsReminder ? (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          <p className="font-semibold">Clôture Z à effectuer</p>
          <p className="mt-1 text-xs text-amber-200/80">
            Journée suggérée : {closureStatus.suggestedDayKey} ({closureStatus.timezone}) — lancez la
            pré-clôture (rapprochement tickets / commandes) puis la clôture définitive.
          </p>
          <button
            type="button"
            onClick={() => openCloseWizard(closureStatus.suggestedDayKey)}
            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-500"
          >
            Pré-clôture & clôture Z
          </button>
        </div>
      ) : null}

      <FiscalDailyCloseWizard
        open={closeWizardOpen}
        initialDayKey={wizardDayKey ?? closureStatus?.suggestedDayKey}
        onClose={() => setCloseWizardOpen(false)}
        onClosed={() => {
          setMessage('Clôture Z enregistrée — journée figée (ISCA).')
          setCloseWizardOpen(false)
          void reload()
          setTab('closures')
        }}
      />

      <details className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-cream/70">
        <summary className="cursor-pointer font-medium text-cream">Guide gérant — procédures fiscales</summary>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-xs text-cream/55">
          <li>
            <strong className="text-cream/80">Chaque soir</strong> : pré-clôture (contrôles + rapprochement)
            puis clôture Z définitive — irréversible (ISCA).
          </li>
          <li>
            <strong className="text-cream/80">Annulation vente payée</strong> : avoir automatique ; vérifiez
            l&apos;onglet Tickets.
          </li>
          <li>
            <strong className="text-cream/80">Réimpression</strong> : bandeau DUPLICATA, max 24 h, journalisé
            JET.
          </li>
          <li>
            <strong className="text-cream/80">Fin d&apos;exercice</strong> : export archive annuelle (onglet
            Archives) — figé, non régénérable.
          </li>
          <li>
            Attestation logiciel : voir{' '}
            <code className="rounded bg-black/30 px-1">docs/attestation-logiciel-caisse-bofip.md</code> —
            signature expert-comptable requise avant exploitation.
          </li>
        </ul>
      </details>

      <AdminSectionTabs
        tabs={[
          { id: 'overview', label: 'Vue d\'ensemble', icon: Scale },
          { id: 'tickets', label: 'Tickets', icon: Receipt, badge: tickets.length || undefined },
          { id: 'journal', label: 'Journal JET', icon: FileDown, badge: events.length || undefined },
          { id: 'closures', label: 'Clôtures Z', icon: ShieldCheck },
          { id: 'archives', label: 'Archives', icon: FileDown, badge: archives.length || undefined },
        ]}
        active={tab}
        onChange={setTab}
      />

      {loading && !sequence ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-tomato-light" />
        </div>
      ) : (
        <>
          {tab === 'overview' && (
            <div className="space-y-6">
              <div className={ADMIN_STAT_GRID}>
                <AdminStatCard
                  label="Prochain n° ticket"
                  value={sequence ? String(sequence.nextTicketNo) : '—'}
                  icon={Receipt}
                />
                <AdminStatCard
                  label="Grand total perpétuel"
                  value={sequence ? formatEUR(grandTotalCentsToNumber(sequence.grandTotalCents)) : '—'}
                  icon={Scale}
                />
                <AdminStatCard
                  label="DUPLICATA (JET)"
                  value={String(duplicataCount)}
                  icon={FileDown}
                />
                <AdminStatCard
                  label="Version logiciel"
                  value={sequence?.softwareVersion ?? '—'}
                  icon={ShieldCheck}
                />
              </div>

              {fiscalConfig ? (
                <section className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
                  <h2 className="font-semibold text-cream">Mise en service</h2>
                  <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <dt className="text-cream/40">1ère journée clôture Z</dt>
                      <dd className="font-medium text-cream">
                        {fiscalConfig.activationDayKey ?? 'Non définie — Paramètres → Fiscal'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-cream/40">Commissionnement</dt>
                      <dd className="font-medium text-cream">
                        {fiscalConfig.commissionedAt
                          ? new Date(fiscalConfig.commissionedAt).toLocaleDateString('fr-FR')
                          : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-cream/40">Mode formation</dt>
                      <dd className="font-medium text-cream">
                        {fiscalConfig.trainingMode ? 'Actif (labo)' : 'Production'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-cream/40">Sauvegardes labo</dt>
                      <dd className="font-medium text-cream">
                        {fiscalConfig.labRepairEnabled ? 'Réparation auto JET' : 'Production stricte'}
                      </dd>
                    </div>
                  </dl>
                  {fiscalConfig.backupConsoleUrl ? (
                    <div className="mt-4 rounded-xl border border-sky-500/25 bg-sky-500/5 px-4 py-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="flex items-center gap-2 text-sm font-semibold text-cream">
                            <HardDrive className="h-4 w-4 text-sky-300" />
                            Console MinIO (développeur)
                          </h3>
                          <p className="mt-1 max-w-xl text-xs text-cream/50">
                            Accès technique réservé — le gérant consulte les sauvegardes dans
                            l&apos;onglet Archives.
                          </p>
                        </div>
                        <a
                          href={fiscalConfig.backupConsoleUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-2 text-xs font-semibold text-sky-100 hover:bg-sky-500/20"
                        >
                          Ouvrir MinIO
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </div>
                    </div>
                  ) : fiscalConfig.backupEnabled ? (
                    <p className="mt-4 text-xs text-cream/45">
                      Sauvegardes automatiques actives — consultez le registre mensuel dans
                      l&apos;onglet Archives.
                    </p>
                  ) : null}
                  <p className="mt-3 text-xs text-cream/45">
                    Les clôtures Z antérieures à la date d’activation ne sont pas proposées. En production,
                    définissez cette date le jour de la première ouverture réelle avec la caisse.
                  </p>
                </section>
              ) : null}

              <section className="rounded-2xl border border-white/10 bg-[#1A1412] p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="flex items-center gap-2 font-semibold text-cream">
                      {verify?.ok ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-400" />
                      )}
                      Contrôle chaîne
                    </h2>
                    <p className="mt-1 text-sm text-cream/50">{verify?.message ?? '—'}</p>
                    {verify && !verify.ok && verify.firstBreakAt ? (
                      <p className="mt-2 text-xs text-amber-200">
                        Rupture détectée : {verify.firstBreakAt}
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => openCloseWizard(closureStatus?.suggestedDayKey)}
                    className="inline-flex items-center gap-2 rounded-xl bg-tomato px-4 py-2.5 text-sm font-semibold text-white hover:bg-tomato/90"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    Pré-clôture & Z
                  </button>
                </div>
                {verify ? (
                  <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                    <div>
                      <dt className="text-cream/40">Tickets vérifiés</dt>
                      <dd className="font-medium text-cream">{verify.ticketsChecked}</dd>
                    </div>
                    <div>
                      <dt className="text-cream/40">Événements JET</dt>
                      <dd className="font-medium text-cream">{verify.eventsChecked}</dd>
                    </div>
                    <div>
                      <dt className="text-cream/40">Clôtures</dt>
                      <dd className="font-medium text-cream">{verify.closuresChecked}</dd>
                    </div>
                  </dl>
                ) : null}
              </section>

              <p className="flex items-start gap-2 text-xs text-cream/40">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Les réimpressions ticket client sont journalisées en DUPLICATA (JET) et limitées à 24 h après
                encaissement. En mode hors ligne, un ticket PROVISOIRE HL-* est imprimé avant synchronisation.
              </p>
            </div>
          )}

          {tab === 'tickets' && (
            <section className="rounded-2xl border border-white/10 bg-[#1A1412] p-5">
              <h2 className="mb-4 font-semibold text-cream">Tickets fiscaux</h2>
              <AdminDataGridShell
                title="Tickets"
                table={ticketsTable}
                recordCount={ticketsTable.getFilteredRowModel().rows.length}
                search={ticketsSearch}
                onSearchChange={setTicketsSearch}
                searchPlaceholder="N°, montant, commande…"
                emptyMessage={
                  tickets.length === 0
                    ? 'Aucun ticket émis — les ventes encaissées apparaîtront ici.'
                    : 'Aucun résultat pour ce filtre'
                }
              />
            </section>
          )}

          {tab === 'journal' && (
            <section className="rounded-2xl border border-white/10 bg-[#1A1412] p-5">
              <h2 className="mb-4 font-semibold text-cream">Journal des événements (JET)</h2>
              {events.length === 0 ? (
                <p className="text-sm text-cream/45">Journal vide.</p>
              ) : (
                <ul className="divide-y divide-white/10 text-sm">
                  {events.map((e) => {
                    const payload = e.payload as { reprintNumber?: number; duplicata?: boolean } | null
                    return (
                      <li key={e.id} className="flex flex-wrap items-start justify-between gap-2 py-3">
                        <div>
                          <span className="font-medium text-cream">
                            {EVENT_LABEL[e.eventType] ?? e.eventType}
                            {payload?.reprintNumber ? ` n°${payload.reprintNumber}` : ''}
                          </span>
                          <p className="text-xs text-cream/40">
                            {new Date(e.createdAt).toLocaleString('fr-FR')}
                            {e.entityId ? ` · ${e.entityType ?? 'entité'} ${e.entityId.slice(0, 8)}…` : ''}
                          </p>
                        </div>
                        <span className="font-mono text-xs text-cream/45">{hashPreview(e.recordHash)}</span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          )}

          {tab === 'closures' && (
            <section className="rounded-2xl border border-white/10 bg-[#1A1412] p-5">
              <h2 className="mb-4 font-semibold text-cream">Clôtures journalières (Z)</h2>
              {closures.length === 0 ? (
                <p className="text-sm text-cream/45">Aucune clôture enregistrée.</p>
              ) : (
                <ul className="divide-y divide-white/10 text-sm">
                  {closures.map((c) => (
                    <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                      <div>
                        <span className="font-medium text-cream">
                          {c.periodType} · {c.periodKey}
                        </span>
                        <p className="text-xs text-cream/40">
                          {new Date(c.closedAt).toLocaleString('fr-FR')} · {c.ticketCount} ticket(s)
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="tabular-nums text-cream">{formatEUR(grandTotalCentsToNumber(c.grandTotalCents))}</p>
                        <p className="font-mono text-xs text-cream/45">{hashPreview(c.recordHash)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {tab === 'archives' && (
            <section className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-[#1A1412] p-5">
                <h2 className="mb-3 font-semibold text-cream">Export annuel figé</h2>
                <p className="mb-4 text-sm text-cream/50">
                  Génère un fichier JSON signé (SHA-256) avec tickets, JET et clôtures de l&apos;exercice.
                  Une archive par année — irréversible.
                </p>
                <div className="flex flex-wrap items-end gap-3">
                  <label className="text-sm text-cream/70">
                    Exercice
                    <input
                      type="number"
                      min={2000}
                      max={2100}
                      value={exportYear}
                      onChange={(e) => setExportYear(parseInt(e.target.value, 10) || exportYear)}
                      className="mt-1 block w-28 rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-cream"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => void handleExportYear()}
                    disabled={busy === 'export'}
                    className="inline-flex items-center gap-2 rounded-xl bg-tomato px-4 py-2.5 text-sm font-semibold text-white hover:bg-tomato/90 disabled:opacity-50"
                  >
                    {busy === 'export' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <FileDown className="h-4 w-4" />
                    )}
                    Exporter l&apos;exercice
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-[#1A1412] p-5">
                <h2 className="mb-4 font-semibold text-cream">Archives exportées</h2>
                {archives.length === 0 ? (
                  <p className="text-sm text-cream/45">Aucune archive annuelle.</p>
                ) : (
                  <ul className="divide-y divide-white/10 text-sm">
                    {archives.map((a) => (
                      <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                        <div>
                          <span className="font-medium text-cream">Exercice {a.fiscalYear}</span>
                          <p className="text-xs text-cream/40">
                            Exporté le {new Date(a.exportedAt).toLocaleString('fr-FR')}
                          </p>
                          <p className="font-mono text-xs text-cream/45">SHA-256: {hashPreview(a.contentHash)}…</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleDownloadYear(a.fiscalYear)}
                          disabled={busy === `dl-${a.fiscalYear}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-white/15 px-3 py-1.5 text-xs text-cream/80 hover:bg-white/5 disabled:opacity-50"
                        >
                          {busy === `dl-${a.fiscalYear}` ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <FileDown className="h-3.5 w-3.5" />
                          )}
                          Télécharger JSON
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="rounded-2xl border border-white/10 bg-[#1A1412] p-5">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="flex items-center gap-2 font-semibold text-cream">
                      <HardDrive className="h-5 w-5 text-sky-300" />
                      Sauvegardes du mois
                    </h2>
                    <p className="mt-1 max-w-2xl text-xs text-cream/45">
                      Copie technique quotidienne (PostgreSQL + archives fiscales) —{' '}
                      <strong className="text-cream/60">complément</strong> aux exports ISCA. Ne remplace
                      pas l&apos;archive annuelle ni le journal certifié en base.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="text-xs text-cream/50">
                      Mois
                      <input
                        type="month"
                        value={backupMonth}
                        onChange={(e) => setBackupMonth(e.target.value)}
                        className="ml-2 rounded-lg border border-white/15 bg-charcoal px-2 py-1.5 text-sm text-cream"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => void loadBackups()}
                      disabled={backupsLoading}
                      className="inline-flex items-center gap-1 rounded-lg border border-white/15 px-3 py-1.5 text-xs text-cream/80 hover:bg-white/5 disabled:opacity-50"
                    >
                      {backupsLoading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <ShieldCheck className="h-3.5 w-3.5" />
                      )}
                      Actualiser
                    </button>
                  </div>
                </div>

                {backupsError ? (
                  <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                    {backupsError}
                  </p>
                ) : backupsLoading && backups.length === 0 ? (
                  <p className="flex items-center gap-2 text-sm text-cream/45">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Chargement des sauvegardes…
                  </p>
                ) : backups.length === 0 ? (
                  <p className="text-sm text-cream/45">
                    Aucune sauvegarde enregistrée pour {backupMonth} (cron quotidien à 04h00).
                  </p>
                ) : (
                  <AdminDataGridShell
                    title="Sauvegardes"
                    table={backupsTable}
                    recordCount={backupsTable.getFilteredRowModel().rows.length}
                    search={backupsSearch}
                    onSearchChange={setBackupsSearch}
                    searchPlaceholder="Fichier, type…"
                    emptyMessage="Aucun résultat pour ce filtre"
                  />
                )}
              </div>
            </section>
          )}
        </>
      )}

      {voidTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#1A1412] p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold text-cream">Avoir fiscal — ticket n°{voidTarget.serialNumber}</h3>
              <button type="button" onClick={() => setVoidTarget(null)}>
                <X className="h-5 w-5 text-cream/40" />
              </button>
            </div>
            <p className="mb-3 text-sm text-cream/55">
              Émet un ticket VOID chaîné (article 286 CGI). Montant : {formatEUR(voidTarget.totalCents)}.
            </p>
            <label className="block text-xs text-cream/50">
              Motif obligatoire
              <textarea
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-xl border border-white/15 bg-charcoal px-3 py-2 text-sm text-cream"
                placeholder="Erreur encaissement, annulation client, double ticket…"
                autoFocus
              />
            </label>
            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={() => setVoidTarget(null)}
                className="flex-1 rounded-xl border border-white/15 py-2 text-sm"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={!voidReason.trim() || busy === `void-${voidTarget.id}`}
                onClick={() => void handleVoidTicket()}
                className="flex-1 rounded-xl bg-red-600/90 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {busy === `void-${voidTarget.id}` ? 'Émission…' : 'Confirmer l\'avoir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {printPreview && (
        <AdminPrintPreview
          title={printPreview.title}
          html={printPreview.html}
          onClose={() => setPrintPreview(null)}
        />
      )}
    </AdminPageShell>
  )
}
