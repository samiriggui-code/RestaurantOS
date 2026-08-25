'use client'

import { useState } from 'react'
import { Loader2, Upload } from 'lucide-react'
import { staffFetch } from '@/lib/staff-api'
import { formatEUR } from '@/lib/money'
import { useAdminFeedback } from '@/components/admin/AdminFeedbackProvider'

type ArticlesImportResult = {
  matched: {
    menuItemName: string
    quantitySold: number
    stockAdjustments: { stockItemName: string; deducted: number }[]
  }[]
  unmatched: { articleName: string; quantitySold: number }[]
}

type VentesSummary = {
  totalCents: number
  rowCount: number
  byPaymentMethod: { method: string; totalCents: number }[]
}

/**
 * Import manuel des exports SumUp (Rapports > Exports > Articles / Ventes) — recale le stock
 * sur les ventes comptoir tapées directement sur la Caisse SumUp (invisible autrement côté
 * RestaurantOS, cf. SUMUP-CAPACITES-CONSTATEES.md). Pas d'automatisation : le gérant télécharge
 * le CSV depuis SumUp et le dépose ici, en général en fin de journée/service.
 */
export function AdminSumupImportPanel() {
  const [articlesResult, setArticlesResult] = useState<ArticlesImportResult | null>(null)
  const [ventesSummary, setVentesSummary] = useState<VentesSummary | null>(null)
  const [busy, setBusy] = useState<'articles' | 'ventes' | null>(null)
  const { notifyError, notifySuccess } = useAdminFeedback()

  async function handleArticlesFile(file: File) {
    setBusy('articles')
    try {
      const csvText = await file.text()
      const result = await staffFetch<ArticlesImportResult>('/stock/import/sumup-articles', {
        method: 'POST',
        body: JSON.stringify({ csvText }),
      })
      setArticlesResult(result)
      notifySuccess(
        `${result.matched.length} article(s) recalé(s)` +
          (result.unmatched.length ? `, ${result.unmatched.length} non trouvé(s)` : ''),
      )
    } catch (err) {
      notifyError('Import impossible', err instanceof Error ? err.message : undefined)
    } finally {
      setBusy(null)
    }
  }

  async function handleVentesFile(file: File) {
    setBusy('ventes')
    try {
      const csvText = await file.text()
      const result = await staffFetch<VentesSummary>('/stock/import/sumup-ventes-summary', {
        method: 'POST',
        body: JSON.stringify({ csvText }),
      })
      setVentesSummary(result)
    } catch (err) {
      notifyError('Lecture impossible', err instanceof Error ? err.message : undefined)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-teal-500/20 bg-teal-950/20 p-4 text-sm text-cream/70">
        Import manuel des ventes faites directement sur la <strong>Caisse SumUp</strong> (pas
        d&apos;API disponible côté SumUp Caisse Plus — cf. doc du 2026-08-25). Télécharge le CSV
        depuis SumUp (<em>Rapports → Exports</em>) et dépose-le ici, idéalement en fin de service.
        Rejouer le même fichier ne recompte pas deux fois.
      </div>

      <section className="space-y-3 rounded-xl border border-white/10 bg-charcoal p-4">
        <div>
          <h3 className="font-semibold text-cream">Articles vendus → stock</h3>
          <p className="text-xs text-cream/50">
            Export &quot;Articles&quot; — déduit le stock (recettes) sur les quantités vendues au
            comptoir SumUp.
          </p>
        </div>
        <label className="flex w-fit cursor-pointer items-center gap-2 rounded-xl border border-white/15 bg-white/[0.03] px-4 py-2.5 text-sm font-semibold text-cream hover:bg-white/[0.06]">
          {busy === 'articles' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          Choisir le CSV Articles
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            disabled={busy !== null}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void handleArticlesFile(file)
              e.target.value = ''
            }}
          />
        </label>

        {articlesResult && (
          <div className="space-y-3 pt-2">
            {articlesResult.matched.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-emerald-300/80">
                  Recalés ({articlesResult.matched.length})
                </p>
                <ul className="space-y-1 text-sm text-cream/70">
                  {articlesResult.matched.map((m) => (
                    <li key={m.menuItemName}>
                      {m.menuItemName} — {m.quantitySold} vendu(s)
                      {m.stockAdjustments.length > 0 && (
                        <span className="text-cream/45">
                          {' '}
                          ({m.stockAdjustments.map((s) => `${s.stockItemName} -${s.deducted}`).join(', ')})
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {articlesResult.unmatched.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-300/80">
                  Non trouvés dans RestaurantOS ({articlesResult.unmatched.length}) — à vérifier/ajouter à
                  la carte
                </p>
                <ul className="space-y-1 text-sm text-cream/70">
                  {articlesResult.unmatched.map((u) => (
                    <li key={u.articleName}>
                      {u.articleName} — {u.quantitySold} vendu(s)
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="space-y-3 rounded-xl border border-white/10 bg-charcoal p-4">
        <div>
          <h3 className="font-semibold text-cream">Ventes → total cash (info)</h3>
          <p className="text-xs text-cream/50">
            Export &quot;Ventes&quot; — total par moyen de paiement, à comparer au comptage de fin
            de session.
          </p>
        </div>
        <label className="flex w-fit cursor-pointer items-center gap-2 rounded-xl border border-white/15 bg-white/[0.03] px-4 py-2.5 text-sm font-semibold text-cream hover:bg-white/[0.06]">
          {busy === 'ventes' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          Choisir le CSV Ventes
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            disabled={busy !== null}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void handleVentesFile(file)
              e.target.value = ''
            }}
          />
        </label>

        {ventesSummary && (
          <div className="space-y-1 pt-2 text-sm text-cream/70">
            <p>
              {ventesSummary.rowCount} ligne(s) — total {formatEUR(ventesSummary.totalCents)}
            </p>
            <ul className="space-y-1">
              {ventesSummary.byPaymentMethod.map((m) => (
                <li key={m.method}>
                  {m.method} : <span className="font-medium text-cream">{formatEUR(m.totalCents)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  )
}
