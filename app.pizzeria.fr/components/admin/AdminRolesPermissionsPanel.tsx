'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
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
import { ExternalLink, Loader2, ShieldCheck } from 'lucide-react'
import { getStaffSession } from '@/lib/staff-auth'
import { staffFetch } from '@/lib/staff-api'
import {
  ROLE,
  ROLE_LABEL,
  canAccessAdmin,
  canAccessDriver,
  canAccessKitchen,
  canAccessPos,
} from '@/lib/roles'
import { AdminDataGridShell, DataGridColumnHeader, createDefaultPagination } from '@/components/ui/data-grid'
import { cn } from '@/lib/cn'

type StaffRow = {
  id: string
  role: string
  createdAt: string
}

const ROLE_MATRIX: {
  role: string
  label: string
  admin: boolean
  pos: boolean
  kitchen: boolean
  driver: boolean
}[] = [
  { role: ROLE.ADMIN, label: ROLE_LABEL.ADMIN, admin: true, pos: true, kitchen: true, driver: true },
  { role: ROLE.MANAGER, label: ROLE_LABEL.MANAGER, admin: true, pos: true, kitchen: true, driver: true },
  { role: ROLE.CASHIER, label: ROLE_LABEL.CASHIER, admin: false, pos: true, kitchen: false, driver: false },
  { role: ROLE.CHEF, label: ROLE_LABEL.CHEF, admin: false, pos: false, kitchen: true, driver: false },
  { role: ROLE.WAITER, label: ROLE_LABEL.WAITER, admin: false, pos: true, kitchen: true, driver: false },
  { role: ROLE.DRIVER, label: ROLE_LABEL.DRIVER, admin: false, pos: false, kitchen: false, driver: true },
]

function AccessCell({ ok }: { ok: boolean }) {
  return (
    <span className={cn('text-xs font-semibold', ok ? 'text-emerald-300' : 'text-cream/25')}>
      {ok ? 'Oui' : '—'}
    </span>
  )
}

function RoleBadge({ role }: { role: string }) {
  const isAdmin = role === ROLE.ADMIN || role === ROLE.MANAGER
  return (
    <span
      className={cn(
        'rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide',
        isAdmin ? 'bg-tomato/20 text-tomato-light' : 'bg-white/10 text-cream/60',
      )}
    >
      {ROLE_LABEL[role] ?? role}
    </span>
  )
}

export function AdminRolesPermissionsPanel() {
  const [rows, setRows] = useState<StaffRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const session = getStaffSession()
    if (!session) {
      setLoading(false)
      return
    }
    staffFetch<StaffRow[]>('/employees', { token: session.token })
      .then((list) =>
        setRows(
          list.map((u) => ({
            id: u.id,
            role: u.role,
            createdAt: u.createdAt,
          })),
        ),
      )
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [])

  const [staffSearch, setStaffSearch] = useState('')
  const [staffSorting, setStaffSorting] = useState<SortingState>([])
  const [staffPagination, setStaffPagination] = useState<PaginationState>(() => createDefaultPagination())

  const staffColumns = useMemo<ColumnDef<StaffRow>[]>(
    () => [
      {
        accessorKey: 'id',
        header: ({ column }) => <DataGridColumnHeader title="User ID" column={column} />,
        cell: ({ row }) => (
          <span className="font-mono text-xs text-cream/55">{row.original.id.slice(0, 8)}…</span>
        ),
      },
      {
        accessorKey: 'role',
        header: ({ column }) => <DataGridColumnHeader title="Rôle" column={column} />,
        cell: ({ row }) => <RoleBadge role={row.original.role} />,
      },
      {
        accessorKey: 'createdAt',
        header: ({ column }) => <DataGridColumnHeader title="Créé le" column={column} />,
        cell: ({ row }) => (
          <span className="text-cream/50">{new Date(row.original.createdAt).toLocaleDateString('fr-FR')}</span>
        ),
      },
    ],
    [],
  )

  const staffTable = useReactTable({
    data: rows,
    columns: staffColumns,
    state: { pagination: staffPagination, sorting: staffSorting, globalFilter: staffSearch },
    onPaginationChange: setStaffPagination,
    onSortingChange: setStaffSorting,
    onGlobalFilterChange: setStaffSearch,
    globalFilterFn: 'includesString',
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getRowId: (row) => row.id,
  })

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-white/10 bg-[#141010] p-4">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-tomato-light" />
          <div>
            <h3 className="font-display text-lg text-cream">Politique rôles & accès</h3>
            <p className="mt-1 text-sm text-cream/45">
              Définit qui accède au back-office, à la caisse, à la cuisine et à l&apos;app livreur. Les comptes
              staff se créent dans{' '}
              <Link href="/admin/users" className="text-tomato-light underline">
                RH → Utilisateurs
              </Link>
              , pas ici.
            </p>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-white/10">
        <div className="border-b border-white/10 bg-white/[0.03] px-4 py-3">
          <p className="text-sm font-medium text-cream">Matrice des permissions par rôle</p>
          <p className="text-xs text-cream/40">Lecture seule — configuration système</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="border-b border-white/10 text-[10px] uppercase tracking-widest text-cream/40">
              <tr>
                <th className="px-4 py-3">Rôle</th>
                <th className="px-4 py-3">Back-office</th>
                <th className="px-4 py-3">POS</th>
                <th className="px-4 py-3">KDS</th>
                <th className="px-4 py-3">Livreur</th>
              </tr>
            </thead>
            <tbody>
              {ROLE_MATRIX.map((r) => (
                <tr key={r.role} className="border-b border-white/5">
                  <td className="px-4 py-3 font-medium text-cream">{r.label}</td>
                  <td className="px-4 py-3">
                    <AccessCell ok={canAccessAdmin(r.role)} />
                  </td>
                  <td className="px-4 py-3">
                    <AccessCell ok={canAccessPos(r.role)} />
                  </td>
                  <td className="px-4 py-3">
                    <AccessCell ok={canAccessKitchen(r.role)} />
                  </td>
                  <td className="px-4 py-3">
                    <AccessCell ok={canAccessDriver(r.role)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-cream/50">Attribution actuelle des rôles (aperçu)</p>
          <Link
            href="/admin/users"
            className="inline-flex items-center gap-1 text-xs font-semibold text-tomato-light hover:underline"
          >
            Gérer les comptes
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-tomato" />
          </div>
        ) : (
          <AdminDataGridShell
            title="Comptes staff"
            table={staffTable}
            recordCount={staffTable.getFilteredRowModel().rows.length}
            search={staffSearch}
            onSearchChange={setStaffSearch}
            searchPlaceholder="ID, rôle…"
            emptyMessage={rows.length === 0 ? 'Aucun compte staff' : 'Aucun résultat pour ce filtre'}
          />
        )}

        <p className="mt-4 flex items-start gap-2 text-xs text-cream/40">
          <span aria-hidden>💡</span>
          Les nouveaux comptes staff reçoivent un rôle opérationnel (caissier, cuisine, livreur…). Seuls admin et
          manager accèdent au back-office. PIN obligatoire sur POS / KDS pour les rôles terrain.
        </p>
      </div>
    </div>
  )
}
