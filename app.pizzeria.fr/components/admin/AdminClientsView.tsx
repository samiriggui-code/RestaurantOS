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
import { Loader2, Mail, Phone } from 'lucide-react'
import { AdminPageHeader, AdminPageShell } from '@/components/admin/AdminSectionTabs'
import { AdminDataGridShell, DataGridColumnHeader, createDefaultPagination } from '@/components/ui/data-grid'
import { getStaffSession } from '@/lib/staff-auth'
import { staffFetch } from '@/lib/staff-api'
import { formatEUR } from '@/lib/money'
import Link from 'next/link'

type CustomerRow = {
  phone: string
  name: string
  email: string | null
  orderCount: number
  paidTotalCents: number
  lastOrderAt: string
}

export function AdminClientsView() {
  const [customers, setCustomers] = useState<CustomerRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sorting, setSorting] = useState<SortingState>([{ id: 'lastOrderAt', desc: true }])
  const [pagination, setPagination] = useState<PaginationState>(() => createDefaultPagination())

  const load = useCallback(async () => {
    const session = getStaffSession()
    if (!session) return
    setLoading(true)
    try {
      const res = await staffFetch<{ customers: CustomerRow[] }>('/reports/customers-summary', {
        token: session.token,
      })
      setCustomers(res.customers)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const columns = useMemo<ColumnDef<CustomerRow>[]>(
    () => [
      {
        accessorKey: 'name',
        header: ({ column }) => <DataGridColumnHeader title="Client" column={column} />,
        cell: ({ row }) => <span className="font-medium text-cream">{row.original.name}</span>,
      },
      {
        id: 'contact',
        accessorFn: (row) => `${row.phone} ${row.email ?? ''}`,
        header: ({ column }) => <DataGridColumnHeader title="Contact" column={column} />,
        cell: ({ row }) => (
          <div className="text-cream/60">
            <span className="flex items-center gap-1">
              <Phone className="h-3.5 w-3.5" /> {row.original.phone}
            </span>
            {row.original.email && (
              <span className="mt-0.5 flex items-center gap-1 text-xs">
                <Mail className="h-3 w-3" /> {row.original.email}
              </span>
            )}
          </div>
        ),
      },
      {
        accessorKey: 'orderCount',
        header: ({ column }) => <DataGridColumnHeader title="Commandes" column={column} />,
        cell: ({ row }) => <span className="font-mono">{row.original.orderCount}</span>,
      },
      {
        accessorKey: 'paidTotalCents',
        header: ({ column }) => <DataGridColumnHeader title="CA payé" column={column} />,
        cell: ({ row }) => (
          <span className="font-mono text-tomato-light">{formatEUR(row.original.paidTotalCents)}</span>
        ),
      },
      {
        id: 'lastOrderAt',
        accessorFn: (row) => new Date(row.lastOrderAt).getTime(),
        header: ({ column }) => <DataGridColumnHeader title="Dernière cmd" column={column} />,
        cell: ({ row }) => (
          <span className="text-xs text-cream/45">
            {new Date(row.original.lastOrderAt).toLocaleDateString('fr-FR')}
          </span>
        ),
      },
    ],
    [],
  )

  const table = useReactTable({
    data: customers,
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
    getRowId: (row) => row.phone,
  })

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Clients"
        subtitle="Clients identifiés par téléphone — 12 derniers mois, commandes non annulées."
        actions={
          <Link href="/admin/loyalty" className="text-sm font-medium text-tomato-light hover:underline">
            Programme fidélité →
          </Link>
        }
      />

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-tomato-light" />
        </div>
      ) : (
        <AdminDataGridShell
          title="Clients"
          table={table}
          recordCount={table.getFilteredRowModel().rows.length}
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Nom, téléphone, e-mail…"
          emptyMessage={customers.length === 0 ? 'Aucun client trouvé.' : 'Aucun résultat pour ce filtre'}
        />
      )}
    </AdminPageShell>
  )
}
