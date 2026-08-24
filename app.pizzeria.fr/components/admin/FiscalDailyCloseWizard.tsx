'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Loader2,
  Lock,
  ShieldAlert,
  X,
  XCircle,
} from 'lucide-react'
import { getStaffSession } from '@/lib/staff-auth'
import { formatEUR } from '@/lib/money'
import {
  acknowledgeDailyPreclose,
  closeFiscalDay,
  fetchDailyPreclose,
  fetchFiscalOpenDays,
  type DailyPreclosePreview,
  type OpenFiscalDayRow,
  type PrecloseCheck,
} from '@/lib/fiscal-api'

const PAYMENT_LABEL: Record<string, string> = {
  CASH: 'Espèces',
  CARD: 'Carte',
  STRIPE: 'Stripe (historique)',
  SUMUP: 'SumUp',
  TERMINAL: 'TPE',
  UNKNOWN: 'Non renseigné',
}

const CHANNEL_LABEL: Record<string, string> = {
  COUNTER: 'Comptoir',
  ONLINE: 'En ligne',
  DELIVERY_ONLINE: 'Livraison site',
  THIRD_PARTY: 'Uber / Deliveroo…',
}

function CheckIcon({ severity }: { severity: PrecloseCheck['severity'] }) {
  if (severity === 'ok') return <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
  if (severity === 'warning') return <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
  return <XCircle className="h-4 w-4 shrink-0 text-red-400" />
}

type Props = {
  open: boolean
  initialDayKey?: string
  onClose: () => void
  onClosed: () => void
}

export function FiscalDailyCloseWizard({ open, initialDayKey, onClose, onClosed }: Props) {
  const [step, setStep] = useState<'day' | 'review' | 'confirm' | 'done'>('day')
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [openDays, setOpenDays] = useState<OpenFiscalDayRow[]>([])
  const [suggestedDayKey, setSuggestedDayKey] = useState('')
  const [selectedDayKey, setSelectedDayKey] = useState('')
  const [preview, setPreview] = useState<DailyPreclosePreview | null>(null)
  const [confirmWarnings, setConfirmWarnings] = useState(false)
  const [managerNotes, setManagerNotes] = useState('')
  const [cashCounted, setCashCounted] = useState('')
  const [precloseId, setPrecloseId] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<string | null>(null)

  const reset = useCallback(() => {
    setStep('day')
    setError(null)
    setPreview(null)
    setConfirmWarnings(false)
    setManagerNotes('')
    setCashCounted('')
    setPrecloseId(null)
    setExpiresAt(null)
  }, [])

  const loadDays = useCallback(async () => {
    const session = getStaffSession()
    if (!session) return
    setLoading(true)
    setError(null)
    try {
      const data = await fetchFiscalOpenDays(session.token)
      setOpenDays(data.days)
      setSuggestedDayKey(data.suggestedDayKey)
      const pick =
        initialDayKey ??
        data.days.find((d) => d.suggested && !d.closed)?.dayKey ??
        data.days.find((d) => !d.closed)?.dayKey ??
        data.suggestedDayKey
      setSelectedDayKey(pick)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chargement impossible')
    } finally {
      setLoading(false)
    }
  }, [initialDayKey])

  const loadPreview = useCallback(async (dayKey: string) => {
    const session = getStaffSession()
    if (!session) return
    setLoading(true)
    setError(null)
    try {
      const { preview: p } = await fetchDailyPreclose(session.token, dayKey)
      setPreview(p)
      setStep('review')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Rapport impossible')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) {
      reset()
      void loadDays()
    }
  }, [open, loadDays, reset])

  async function handleAcknowledge() {
    const session = getStaffSession()
    if (!session || !preview) return
    setBusy(true)
    setError(null)
    try {
      const cashCents = cashCounted.trim()
        ? Math.round(parseFloat(cashCounted.replace(',', '.')) * 100)
        : null
      const result = await acknowledgeDailyPreclose(session.token, {
        dayKey: preview.dayKey,
        managerNotes: managerNotes.trim() || undefined,
        cashCountedCents: Number.isFinite(cashCents) ? cashCents : null,
        confirmWarnings: preview.warningCount > 0 ? confirmWarnings : true,
      })
      setPrecloseId(result.precloseId)
      setExpiresAt(result.expiresAt)
      setStep('confirm')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Validation refusée')
    } finally {
      setBusy(false)
    }
  }

  async function handleFinalClose() {
    const session = getStaffSession()
    if (!session || !preview || !precloseId) return
    setBusy(true)
    setError(null)
    try {
      await closeFiscalDay(session.token, preview.dayKey, precloseId)
      setStep('done')
      onClosed()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Clôture impossible')
    } finally {
      setBusy(false)
    }
  }

  if (!open) return null

  const selectedDay = openDays.find((d) => d.dayKey === selectedDayKey)

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
      <div
        role="dialog"
        aria-labelledby="fiscal-close-title"
        className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#1A1412] shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
          <div>
            <h2 id="fiscal-close-title" className="flex items-center gap-2 text-lg font-semibold text-cream">
              <Lock className="h-5 w-5 text-tomato-light" />
              Pré-clôture & clôture Z
            </h2>
            <p className="mt-1 text-xs text-cream/50">
              Art. 286 CGI — opération irréversible. Vérifiez tickets, encaissements et plateformes tierces.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-cream/50 hover:bg-white/5 hover:text-cream"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {error ? (
            <p className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </p>
          ) : null}

          {step === 'day' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                <p className="font-medium">Quelle journée clôturer ?</p>
                <p className="mt-1 text-xs text-amber-200/80">
                  Entre minuit et 6 h (Paris), la veille est proposée par défaut — pratique après un service
                  tardif.
                  {suggestedDayKey ? ` Suggestion : ${suggestedDayKey}.` : ''}
                </p>
              </div>

              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-tomato-light" />
                </div>
              ) : (
                <div className="space-y-2">
                  {openDays.map((d) => (
                    <label
                      key={d.dayKey}
                      className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition ${
                        selectedDayKey === d.dayKey
                          ? 'border-tomato/50 bg-tomato/10'
                          : 'border-white/10 bg-white/[0.02] hover:border-white/20'
                      } ${d.closed ? 'opacity-60' : ''}`}
                    >
                      <input
                        type="radio"
                        name="fiscal-day"
                        value={d.dayKey}
                        checked={selectedDayKey === d.dayKey}
                        disabled={d.closed}
                        onChange={() => setSelectedDayKey(d.dayKey)}
                        className="accent-tomato"
                      />
                      <CalendarDays className="h-4 w-4 text-cream/40" />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-cream">
                          {d.dayLabel}
                          {d.suggested ? (
                            <span className="ml-2 text-xs font-normal text-tomato-light">(suggéré)</span>
                          ) : null}
                        </p>
                        <p className="text-xs text-cream/45">
                          {d.dayKey}
                          {d.hasActivity ? ` · CA tickets ${formatEUR(d.revenueCents)}` : ' · pas d’activité'}
                        </p>
                      </div>
                      {d.closed ? (
                        <span className="text-xs text-emerald-400">Clôturée</span>
                      ) : (
                        <span className="text-xs text-amber-300">À clôturer</span>
                      )}
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 'review' && preview && (
            <div className="space-y-5">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs uppercase tracking-wide text-cream/40">Journée fiscale</p>
                <p className="mt-1 text-xl font-semibold capitalize text-cream">{preview.dayLabel}</p>
                <p className="text-xs text-cream/45">
                  {preview.dayKey} · {preview.timezone} · {preview.periodStart.slice(11, 16)} →{' '}
                  {preview.periodEnd.slice(11, 16)} UTC
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <Stat label="Ventes" value={String(preview.fiscal.saleCount)} />
                <Stat label="Avoirs" value={String(preview.fiscal.voidCount)} />
                <Stat
                  label="CA tickets TTC"
                  value={formatEUR(preview.fiscal.revenueCents)}
                />
              </div>

              <section>
                <h3 className="mb-2 text-sm font-semibold text-cream">Contrôles obligatoires</h3>
                <ul className="space-y-2">
                  {preview.checks.map((c) => (
                    <li
                      key={c.id}
                      className={`flex gap-3 rounded-lg border px-3 py-2 text-sm ${
                        c.severity === 'blocker'
                          ? 'border-red-500/30 bg-red-500/5'
                          : c.severity === 'warning'
                            ? 'border-amber-500/30 bg-amber-500/5'
                            : 'border-emerald-500/20 bg-emerald-500/5'
                      }`}
                    >
                      <CheckIcon severity={c.severity} />
                      <div>
                        <p className="font-medium text-cream">{c.label}</p>
                        <p className="text-xs text-cream/55">{c.detail}</p>
                        {c.actionHint ? (
                          <p className="mt-1 text-xs text-tomato-light/90">{c.actionHint}</p>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>

              <section>
                <h3 className="mb-2 text-sm font-semibold text-cream">Recettes par canal</h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  {Object.entries(preview.orders.byChannel).map(([ch, v]) =>
                    v.count > 0 ? (
                      <div
                        key={ch}
                        className="rounded-lg border border-white/10 px-3 py-2 text-sm"
                      >
                        <span className="text-cream/60">{CHANNEL_LABEL[ch] ?? ch}</span>
                        <span className="float-right font-medium text-cream">
                          {v.count} · {formatEUR(v.totalCents)}
                        </span>
                      </div>
                    ) : null,
                  )}
                </div>
              </section>

              <section>
                <h3 className="mb-2 text-sm font-semibold text-cream">Encaissements (tickets)</h3>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(preview.fiscal.byPaymentMethod).map(([pm, cents]) => (
                    <span
                      key={pm}
                      className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-cream/80"
                    >
                      {PAYMENT_LABEL[pm] ?? pm} : {formatEUR(cents)}
                    </span>
                  ))}
                </div>
              </section>

              {preview.orders.thirdParty.length > 0 ? (
                <section className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-3">
                  <h3 className="text-sm font-semibold text-amber-100">Plateformes tierces</h3>
                  <ul className="mt-2 space-y-1 text-xs text-amber-200/80">
                    {preview.orders.thirdParty.map((o) => (
                      <li key={o.orderNumber}>
                        #{o.orderNumber} — {formatEUR(o.total)}
                        {o.customerName ? ` · ${o.customerName}` : ''}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {preview.warningCount > 0 && preview.canClose ? (
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                  <input
                    type="checkbox"
                    checked={confirmWarnings}
                    onChange={(e) => setConfirmWarnings(e.target.checked)}
                    className="mt-0.5 accent-amber-500"
                  />
                  <span className="text-amber-100">
                    J&apos;ai pris connaissance des {preview.warningCount} avertissement(s) et confirme
                    vouloir poursuivre malgré les écarts signalés.
                  </span>
                </label>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="text-cream/60">Espèces comptées en caisse (€)</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="Optionnel — rapprochement"
                    value={cashCounted}
                    onChange={(e) => setCashCounted(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-cream"
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-cream/60">Notes gérant</span>
                  <input
                    type="text"
                    placeholder="Écarts, remarques…"
                    value={managerNotes}
                    onChange={(e) => setManagerNotes(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-cream"
                  />
                </label>
              </div>

              <p className="text-xs text-cream/40">
                Grand total perpétuel : {formatEUR(Number(preview.grandTotalPerpetualCents))} ·
                Validité pré-clôture : 4 h après validation.
              </p>
            </div>
          )}

          {step === 'confirm' && preview && (
            <div className="space-y-4 py-4 text-center">
              <ShieldAlert className="mx-auto h-12 w-12 text-tomato-light" />
              <h3 className="text-lg font-semibold text-cream">Clôture Z définitive</h3>
              <p className="text-sm text-cream/60">
                Vous allez figer la journée du{' '}
                <strong className="text-cream">{preview.dayLabel}</strong> ({preview.dayKey}).
                <br />
                Aucune modification ni correction ne sera possible ensuite (ISCA).
              </p>
              {expiresAt ? (
                <p className="text-xs text-cream/40">
                  Pré-clôture validée · expire {new Date(expiresAt).toLocaleString('fr-FR')}
                </p>
              ) : null}
            </div>
          )}

          {step === 'done' && preview && (
            <div className="space-y-4 py-8 text-center">
              <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-400" />
              <h3 className="text-lg font-semibold text-cream">Clôture Z enregistrée</h3>
              <p className="text-sm text-cream/60">
                Journée {preview.dayKey} figée dans le journal ISCA.
              </p>
            </div>
          )}
        </div>

        <footer className="flex flex-wrap justify-end gap-2 border-t border-white/10 px-5 py-4">
          {step === 'day' && (
            <>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-white/15 px-4 py-2 text-sm text-cream/70"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={loading || !selectedDayKey || selectedDay?.closed}
                onClick={() => void loadPreview(selectedDayKey)}
                className="rounded-xl bg-tomato px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Vérifier cette journée
              </button>
            </>
          )}

          {step === 'review' && preview && (
            <>
              <button
                type="button"
                onClick={() => setStep('day')}
                className="rounded-xl border border-white/15 px-4 py-2 text-sm text-cream/70"
              >
                Changer de date
              </button>
              <button
                type="button"
                disabled={
                  busy ||
                  !preview.canClose ||
                  (preview.warningCount > 0 && !confirmWarnings)
                }
                onClick={() => void handleAcknowledge()}
                className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {busy ? <Loader2 className="inline h-4 w-4 animate-spin" /> : null}
                Valider la pré-clôture
              </button>
            </>
          )}

          {step === 'confirm' && (
            <>
              <button
                type="button"
                onClick={() => setStep('review')}
                className="rounded-xl border border-white/15 px-4 py-2 text-sm text-cream/70"
              >
                Retour
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleFinalClose()}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {busy ? <Loader2 className="inline h-4 w-4 animate-spin" /> : null}
                Clôturer définitivement
              </button>
            </>
          )}

          {step === 'done' && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-tomato px-4 py-2 text-sm font-semibold text-white"
            >
              Fermer
            </button>
          )}
        </footer>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2">
      <p className="text-xs text-cream/45">{label}</p>
      <p className="text-lg font-semibold text-cream">{value}</p>
    </div>
  )
}
