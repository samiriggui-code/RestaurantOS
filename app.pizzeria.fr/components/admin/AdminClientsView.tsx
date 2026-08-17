'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Mail, Phone, Search, Users } from 'lucide-react'
import { AdminPageHeader, AdminPageShell } from '@/components/admin/AdminSectionTabs'
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
  const [q, setQ] = useState('')

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

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return customers
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(needle) ||
        c.phone.includes(needle) ||
        (c.email?.toLowerCase().includes(needle) ?? false),
    )
  }, [customers, q])

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Clients"
        subtitle="Clients identifiés par téléphone — 12 derniers mois, commandes non annulées."
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-cream/40" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Nom, téléphone, e-mail…"
            className="w-full rounded-xl border border-white/10 bg-[#1A1412] py-2 pl-9 pr-3 text-sm text-cream outline-none focus:border-tomato/40"
          />
        </div>
        <Link
          href="/admin/loyalty"
          className="text-sm font-medium text-tomato-light hover:underline"
        >
          Programme fidélité →
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-tomato-light" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 p-12 text-center text-cream/50">
          <Users className="mx-auto mb-3 h-10 w-10 opacity-40" />
          Aucun client trouvé.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-white/10">
          <table className="w-full text-sm">
            <thead className="border-b border-white/10 bg-[#1A1412] text-left text-xs uppercase tracking-wide text-cream/45">
              <tr>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3 text-right">Commandes</th>
                <th className="px-4 py-3 text-right">CA payé</th>
                <th className="px-4 py-3">Dernière cmd</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.phone} className="border-b border-white/5 hover:bg-white/[0.02]">
                  <td className="px-4 py-3 font-medium text-cream">{c.name}</td>
                  <td className="px-4 py-3 text-cream/60">
                    <span className="flex items-center gap-1">
                      <Phone className="h-3.5 w-3.5" /> {c.phone}
                    </span>
                    {c.email && (
                      <span className="mt-0.5 flex items-center gap-1 text-xs">
                        <Mail className="h-3 w-3" /> {c.email}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{c.orderCount}</td>
                  <td className="px-4 py-3 text-right font-mono text-tomato-light">
                    {formatEUR(c.paidTotalCents)}
                  </td>
                  <td className="px-4 py-3 text-xs text-cream/45">
                    {new Date(c.lastOrderAt).toLocaleDateString('fr-FR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminPageShell>
  )
}
