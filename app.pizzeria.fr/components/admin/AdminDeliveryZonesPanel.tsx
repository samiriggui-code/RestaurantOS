'use client'

import { useEffect, useMemo, useState } from 'react'
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
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { eurosToCents, formatEUR } from '@/lib/money'
import { getStaffSession } from '@/lib/staff-auth'
import { staffFetch } from '@/lib/staff-api'
import { cn } from '@/lib/cn'
import { useAdminFeedback } from '@/components/admin/AdminFeedbackProvider'
import { AdminDataGridShell, DataGridColumnHeader, createDefaultPagination } from '@/components/ui/data-grid'

type DeliveryZone = {
  id: string
  postalCode: string
  city: string | null
  feeCents: number
  minOrderCents: number
  isActive: boolean
  sortOrder: number
}

const fieldClass =
  'mt-1 w-full rounded-xl border border-white/15 bg-white/[0.03] px-3 py-2 text-sm text-cream outline-none focus:border-tomato/40'

export function AdminDeliveryZonesPanel() {
  const { confirm, notifySuccess } = useAdminFeedback()
  const [zones, setZones] = useState<DeliveryZone[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const { error, setError, message, setMessage } = useFeedbackState()
  const [showForm, setShowForm] = useState(false)
  const [testCp, setTestCp] = useState('33370')
  const [testCity, setTestCity] = useState('Fargues-Saint-Hilaire')
  const [testSubtotal, setTestSubtotal] = useState('30')
  const [testResult, setTestResult] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [sorting, setSorting] = useState<SortingState>([])
  const [pagination, setPagination] = useState<PaginationState>(() => createDefaultPagination())

  function load() {
    const session = getStaffSession('crm')
    if (!session) return
    setLoading(true)
    staffFetch<DeliveryZone[]>('/delivery/zones', { token: session.token })
      .then(setZones)
      .catch((err) => setError(err instanceof Error ? err.message : 'Erreur'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const session = getStaffSession('crm')
    if (!session) return
    const form = new FormData(e.currentTarget)
    setSaving(true)
    setError(null)
    try {
      await staffFetch('/delivery/zones', {
        method: 'POST',
        token: session.token,
        body: JSON.stringify({
          postalCode: form.get('postalCode'),
          city: form.get('city'),
          feeCents: eurosToCents(parseFloat(String(form.get('fee'))) || 0),
          minOrderCents: eurosToCents(parseFloat(String(form.get('minOrder'))) || 0),
          sortOrder: Number(form.get('sortOrder')) || 0,
          isActive: true,
        }),
      })
      setShowForm(false)
      setMessage('Zone ajoutée.')
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Création impossible')
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(zone: DeliveryZone) {
    const session = getStaffSession('crm')
    if (!session) return
    try {
      await staffFetch(`/delivery/zones/${zone.id}`, {
        method: 'PUT',
        token: session.token,
        body: JSON.stringify({ isActive: !zone.isActive }),
      })
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Mise à jour impossible')
    }
  }

  async function handleDelete(id: string) {
    if (
      !(await confirm({
        title: 'Supprimer la zone',
        message: 'Supprimer cette zone de livraison ?',
        confirmLabel: 'Supprimer',
        destructive: true,
      }))
    ) {
      return
    }
    const session = getStaffSession('crm')
    if (!session) return
    try {
      await staffFetch(`/delivery/zones/${id}`, { method: 'DELETE', token: session.token })
      notifySuccess('Zone supprimée.')
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Suppression impossible')
    }
  }

  async function runQuoteTest() {
    const session = getStaffSession('crm')
    if (!session) return
    setTestResult(null)
    try {
      const params = new URLSearchParams({
        postalCode: testCp,
        city: testCity,
        subtotal: testSubtotal,
      })
      const res = await staffFetch<{ ok: boolean; fee: number; minOrder: number; zoneLabel: string; error?: string }>(
        `/delivery/quote/test?${params}`,
        { token: session.token },
      )
      if (res.ok) {
        setTestResult(`OK — ${res.zoneLabel} · frais ${res.fee.toFixed(2)} € · min. ${res.minOrder.toFixed(2)} €`)
      } else {
        setTestResult(res.error ?? 'Refusé')
      }
    } catch (err) {
      setTestResult(err instanceof Error ? err.message : 'Erreur test')
    }
  }

  const columns = useMemo<ColumnDef<DeliveryZone>[]>(
    () => [
      {
        accessorKey: 'city',
        header: ({ column }) => <DataGridColumnHeader title="Commune" column={column} />,
        cell: ({ row }) => <span className="font-medium text-cream">{row.original.city ?? '—'}</span>,
      },
      {
        accessorKey: 'postalCode',
        header: ({ column }) => <DataGridColumnHeader title="CP" column={column} />,
        cell: ({ row }) => <span className="text-cream/70">{row.original.postalCode}</span>,
      },
      {
        accessorKey: 'minOrderCents',
        header: ({ column }) => <DataGridColumnHeader title="Min. commande" column={column} />,
        cell: ({ row }) => formatEUR(row.original.minOrderCents),
      },
      {
        accessorKey: 'feeCents',
        header: ({ column }) => <DataGridColumnHeader title="Frais" column={column} />,
        cell: ({ row }) => <span className="text-tomato-light">{formatEUR(row.original.feeCents)}</span>,
      },
      {
        accessorKey: 'isActive',
        header: ({ column }) => <DataGridColumnHeader title="Actif" column={column} />,
        cell: ({ row }) => (
          <button
            type="button"
            onClick={() => void toggleActive(row.original)}
            className={cn(
              'rounded-full px-2.5 py-0.5 text-xs font-semibold',
              row.original.isActive ? 'bg-emerald-500/15 text-emerald-200' : 'bg-white/10 text-cream/40',
            )}
          >
            {row.original.isActive ? 'Oui' : 'Non'}
          </button>
        ),
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">Actions</span>,
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => void handleDelete(row.original.id)}
              className="rounded-lg p-2 text-red-400 hover:bg-red-500/10 hover:text-red-300"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ),
      },
    ],
    [],
  )

  const zonesTable = useReactTable({
    data: zones,
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

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-tomato-light" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-tomato px-4 py-2 text-sm font-semibold text-white"
        >
          <Plus className="h-4 w-4" />
          Ajouter une zone
        </button>
      </div>

      {message && (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-200">
          {message}
        </p>
      )}
      {error && (
        <p className="rounded-xl border border-red-500/30 bg-red-950/40 px-4 py-2 text-sm text-red-200">
          {error}
        </p>
      )}

      <section className="rounded-2xl border border-white/10 bg-[#1A1412] p-5">
        <h2 className="mb-3 font-semibold text-cream">Tester un devis</h2>
        <div className="grid gap-3 sm:grid-cols-4">
          <label className="text-xs text-cream/50">
            Code postal
            <input className={fieldClass} value={testCp} onChange={(e) => setTestCp(e.target.value)} />
          </label>
          <label className="text-xs text-cream/50 sm:col-span-2">
            Commune
            <input className={fieldClass} value={testCity} onChange={(e) => setTestCity(e.target.value)} />
          </label>
          <label className="text-xs text-cream/50">
            Montant pizzas (€)
            <input className={fieldClass} value={testSubtotal} onChange={(e) => setTestSubtotal(e.target.value)} />
          </label>
        </div>
        <button
          type="button"
          onClick={() => void runQuoteTest()}
          className="mt-3 rounded-xl border border-white/15 px-4 py-2 text-sm hover:bg-white/5"
        >
          Calculer le devis
        </button>
        {testResult && <p className="mt-2 text-sm text-cream/70">{testResult}</p>}
      </section>

      <AdminDataGridShell
        title="Zones de livraison"
        table={zonesTable}
        recordCount={zonesTable.getFilteredRowModel().rows.length}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Commune, code postal…"
        emptyMessage={
          zones.length === 0 ? 'Aucune zone — cliquez « Ajouter une zone »' : 'Aucun résultat pour ce filtre'
        }
      />

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <form
            onSubmit={(e) => void handleCreate(e)}
            className="w-full max-w-md rounded-2xl border border-white/10 bg-[#1A1412] p-6"
          >
            <h3 className="mb-4 font-semibold text-cream">Nouvelle zone</h3>
            <div className="space-y-3">
              <label className="block text-xs text-cream/50">
                Commune
                <input name="city" required className={fieldClass} />
              </label>
              <label className="block text-xs text-cream/50">
                Code postal
                <input name="postalCode" required maxLength={5} className={fieldClass} />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs text-cream/50">
                  Min. commande (€)
                  <input name="minOrder" type="number" step="0.01" min="0" defaultValue="25" className={fieldClass} />
                </label>
                <label className="block text-xs text-cream/50">
                  Frais livraison (€)
                  <input name="fee" type="number" step="0.01" min="0" defaultValue="4.5" className={fieldClass} />
                </label>
              </div>
              <label className="block text-xs text-cream/50">
                Ordre d&apos;affichage
                <input name="sortOrder" type="number" defaultValue="0" className={fieldClass} />
              </label>
            </div>
            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="flex-1 rounded-xl border border-white/15 py-2 text-sm"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 rounded-xl bg-tomato py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving ? '…' : 'Enregistrer'}
              </button>
            </div>
          </form>
        </div>
      )}

      <p className="text-xs text-cream/35">
        {zones.filter((z) => z.isActive).length} zone(s) active(s) — appliquées au checkout en ligne.
      </p>
    </div>
  )
}
