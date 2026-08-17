'use client'

import { useEffect, useState } from 'react'
import { useFeedbackState } from '@/lib/use-feedback-state'
import { Loader2, Truck, User, X } from 'lucide-react'
import { fetchDriversOnDutyStaff, orderAddressLine, type DriverOnDuty, type OpsOrder } from '@/lib/ops-orders'
import { getStaffSession } from '@/lib/staff-auth'
import { cn } from '@/lib/cn'

type Props = {
  order: OpsOrder
  loading: boolean
  onClose: () => void
  onConfirm: (driverId: string) => void | Promise<void>
}

export function KitchenDriverAssignSheet({ order, loading, onClose, onConfirm }: Props) {
  const [drivers, setDrivers] = useState<DriverOnDuty[]>([])
  const [driversLoading, setDriversLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(order.driverId ?? null)
  const { error, setError } = useFeedbackState()

  useEffect(() => {
    const session = getStaffSession('auto')
    if (!session) {
      setError('Session expirée')
      setDriversLoading(false)
      return
    }
    void fetchDriversOnDutyStaff(session.token)
      .then((list) => {
        setDrivers(list)
        if (list.length === 1) {
          setSelectedId(list[0]!.id)
          void onConfirm(list[0]!.id)
          return
        }
        if (!selectedId && order.driverId) setSelectedId(order.driverId)
        else if (!selectedId && list.length > 0) setSelectedId(list[0]!.id)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Chargement impossible'))
      .finally(() => setDriversLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open once per order
  }, [order.id])

  const address = orderAddressLine(order)

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#1A1412] p-5 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-cream">
              <Truck className="h-5 w-5 text-violet-300" />
              Mettre en livraison
            </h2>
            <p className="mt-1 text-xs text-cream/50">
              Commande #{order.orderNumber}
              {address ? ` — ${address}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-cream/50 hover:bg-white/10"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mb-3 text-sm text-cream/70">
          Choisissez le livreur planifié aujourd&apos;hui ou disponible :
        </p>

        {driversLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
          </div>
        ) : error ? (
          <p className="rounded-xl border border-red-500/30 bg-red-950/40 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        ) : drivers.length === 0 ? (
          <p className="rounded-xl border border-amber-500/30 bg-amber-950/30 px-3 py-3 text-sm text-amber-100">
            Aucun livreur planifié aujourd&apos;hui. Ajoutez un livreur au planning ou créez un
            compte DRIVER actif.
          </p>
        ) : (
          <ul className="mb-4 max-h-[min(280px,40vh)] space-y-2 overflow-y-auto">
            {drivers.map((d) => (
              <li key={d.id}>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => setSelectedId(d.id)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition',
                    selectedId === d.id
                      ? 'border-violet-400 bg-violet-500/20 text-violet-100'
                      : 'border-white/10 bg-charcoal text-cream/80 hover:border-white/20',
                  )}
                >
                  <User className="h-4 w-4 shrink-0 opacity-60" />
                  <span className="font-semibold">{d.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-xl border border-white/15 py-3 text-sm font-medium text-cream/70"
          >
            Annuler
          </button>
          <button
            type="button"
            disabled={loading || !selectedId || driversLoading}
            onClick={() => selectedId && void onConfirm(selectedId)}
            className="rounded-xl bg-violet-600 py-3 text-sm font-bold text-white hover:bg-violet-500 disabled:opacity-40"
          >
            {loading ? 'Attribution…' : 'Attribuer la livraison'}
          </button>
        </div>
      </div>
    </div>
  )
}
