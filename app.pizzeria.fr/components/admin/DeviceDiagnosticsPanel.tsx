'use client'

import { useEffect, useState } from 'react'
import {
  CheckCircle2,
  Loader2,
  Printer,
  ShoppingBag,
  Smartphone,
  UtensilsCrossed,
  Volume2,
  Wifi,
  WifiOff,
  CreditCard,
} from 'lucide-react'
import { getApiBase } from '@/lib/api-base'
import { getStaffSession } from '@/lib/staff-auth'
import {
  testKitchenOrdersApi,
  testOnlineOrdersQueue,
  testPosMenuLoad,
  testPrintBagLabel,
  testPrintKitchenTicket,
  testPrintReceipt,
  testStaffApi,
  testSocketConnection,
  testPaymentTerminal,
  testSunmiBridge,
  testSunmiSound,
  getWebViewDiagnostics,
  getWebViewGoNoGoClipboard,
  testOfflineQueueSize,
} from '@/lib/device-diagnostics'
import { MIN_CHROME_VERSION } from '@/lib/webview-capability'

type TriState = boolean | null

type DiagnosticVariant = 'kitchen' | 'pos'

function StatusIcon({ ok, loading }: { ok: TriState; loading: boolean }) {
  if (loading) return <Loader2 className="h-4 w-4 animate-spin" />
  if (ok === true) return <CheckCircle2 className="h-4 w-4 text-emerald-400" />
  if (ok === false) return <WifiOff className="h-4 w-4 text-red-400" />
  return <Wifi className="h-4 w-4" />
}

function diagBtn(disabled: boolean) {
  return `inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm hover:bg-white/5 disabled:opacity-50`
}

export function DeviceDiagnosticsPanel({ variant }: { variant: DiagnosticVariant }) {
  const isPos = variant === 'pos'

  const [apiOk, setApiOk] = useState<TriState>(null)
  const [socketOk, setSocketOk] = useState<TriState>(null)
  const [menuOk, setMenuOk] = useState<TriState>(null)
  const [onlineOk, setOnlineOk] = useState<TriState>(null)
  const [kdsOk, setKdsOk] = useState<TriState>(null)
  const [sunmiOk, setSunmiOk] = useState<TriState>(null)
  const [sunmiStatus, setSunmiStatus] = useState<string | null>(null)
  const [tpeOk, setTpeOk] = useState<TriState>(null)
  const [tpeMode, setTpeMode] = useState<string | null>(null)
  const [soundOk, setSoundOk] = useState<TriState>(null)

  const [testingApi, setTestingApi] = useState(false)
  const [testingSocket, setTestingSocket] = useState(false)
  const [testingMenu, setTestingMenu] = useState(false)
  const [testingOnline, setTestingOnline] = useState(false)
  const [testingKds, setTestingKds] = useState(false)
  const [testingSunmi, setTestingSunmi] = useState(false)
  const [testingPrintKitchen, setTestingPrintKitchen] = useState(false)
  const [testingPrintBag, setTestingPrintBag] = useState(false)
  const [testingPrintReceipt, setTestingPrintReceipt] = useState(false)
  const [testingSound, setTestingSound] = useState(false)
  const [webviewInfo, setWebviewInfo] = useState<ReturnType<typeof getWebViewDiagnostics> | null>(
    null,
  )
  const [offlinePending, setOfflinePending] = useState<number | null>(null)
  const [copiedReport, setCopiedReport] = useState(false)

  useEffect(() => {
    if (!isPos) return
    setWebviewInfo(getWebViewDiagnostics())
    void testOfflineQueueSize().then(setOfflinePending)
  }, [isPos])

  async function runApiTest() {
    const session = getStaffSession()
    if (!session) return
    setTestingApi(true)
    setApiOk(null)
    setApiOk(await testStaffApi(session.token))
    setTestingApi(false)
  }

  async function runSocketTest() {
    const session = getStaffSession()
    if (!session) return
    setTestingSocket(true)
    setSocketOk(null)
    setSocketOk(await testSocketConnection(session.token, session.businessId))
    setTestingSocket(false)
  }

  async function runMenuTest() {
    const session = getStaffSession()
    if (!session) return
    setTestingMenu(true)
    setMenuOk(null)
    setMenuOk(await testPosMenuLoad(session.token, session.businessId))
    setTestingMenu(false)
  }

  async function runOnlineTest() {
    const session = getStaffSession()
    if (!session) return
    setTestingOnline(true)
    setOnlineOk(null)
    setOnlineOk(await testOnlineOrdersQueue(session.token))
    setTestingOnline(false)
  }

  async function runKdsTest() {
    const session = getStaffSession()
    if (!session) return
    setTestingKds(true)
    setKdsOk(null)
    setKdsOk(await testKitchenOrdersApi(session.token))
    setTestingKds(false)
  }

  function runTpeTest() {
    setTestingSunmi(true)
    const { available, mode } = testPaymentTerminal()
    setTpeOk(available || mode === 'manual')
    setTpeMode(mode)
    setTestingSunmi(false)
  }

  function runSunmiTest() {
    setTestingSunmi(true)
    const { available, status } = testSunmiBridge()
    setSunmiOk(available)
    setSunmiStatus(status)
    setTestingSunmi(false)
  }

  async function runPrintKitchen() {
    setTestingPrintKitchen(true)
    const result = await testPrintKitchenTicket()
    setTestingPrintKitchen(false)
    if (!result.ok) {
      setSunmiOk(false)
      setSunmiStatus(result.error ?? 'cascade échouée')
    }
  }

  function runPrintBag() {
    setTestingPrintBag(true)
    testPrintBagLabel()
    setTestingPrintBag(false)
  }

  async function runPrintReceipt() {
    setTestingPrintReceipt(true)
    await testPrintReceipt()
    setTestingPrintReceipt(false)
  }

  function runSoundTest() {
    setTestingSound(true)
    setSoundOk(testSunmiSound())
    setTestingSound(false)
  }

  async function copyGoNoGoReport() {
    const text = getWebViewGoNoGoClipboard()
    try {
      await navigator.clipboard.writeText(text)
      setCopiedReport(true)
      setTimeout(() => setCopiedReport(false), 2000)
    } catch {
      /* ignore */
    }
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-[#1A1412] p-5 space-y-3">
      <h2 className="font-semibold text-cream">Diagnostics réseau &amp; impression</h2>
      <p className="text-sm text-cream/50">
        {isPos
          ? 'Vérifiez la connexion API, le temps réel, le catalogue, la file en ligne et les imprimantes avant d\'ouvrir la caisse SUNMI.'
          : 'Vérifiez la connexion internet/LAN et l\'imprimante cuisine avant d\'ouvrir le KDS en service.'}
      </p>

      {isPos && webviewInfo && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            webviewInfo.decision === 'GO'
              ? 'border-emerald-500/30 bg-emerald-950/20'
              : webviewInfo.decision === 'NO_GO'
                ? 'border-red-500/30 bg-red-950/20'
                : 'border-white/10 bg-black/20'
          }`}
        >
          <p className="font-medium text-cream">WebView — info diagnostic (CRM)</p>
          <p className="text-xs text-cream/45">
            Affiché ici pour référence. Ne bloque pas la caisse SUNMI si décision GO.
          </p>
          <p className="mt-1 text-xs text-cream/60">{webviewInfo.message}</p>
          <dl className="mt-2 grid gap-1 text-xs text-cream/50 sm:grid-cols-2">
            <div>
              Chrome : <strong className="text-cream/80">{webviewInfo.chromeVersion ?? '—'}</strong>{' '}
              (min {MIN_CHROME_VERSION})
            </div>
            <div>
              Décision :{' '}
              <strong
                className={
                  webviewInfo.decision === 'GO'
                    ? 'text-emerald-400'
                    : webviewInfo.decision === 'NO_GO'
                      ? 'text-red-400'
                      : 'text-cream/80'
                }
              >
                {webviewInfo.decision}
              </strong>
            </div>
            {webviewInfo.appVersion && (
              <div>
                APK : <strong className="text-cream/80">v{webviewInfo.appVersion}</strong>
              </div>
            )}
            {webviewInfo.androidModel && (
              <div>
                Modèle : <strong className="text-cream/80">{webviewInfo.androidModel}</strong>
              </div>
            )}
            {offlinePending != null && offlinePending >= 0 && (
              <div>
                File hors-ligne :{' '}
                <strong className="text-cream/80">{offlinePending} commande(s)</strong>
              </div>
            )}
          </dl>
          <button
            type="button"
            onClick={() => void copyGoNoGoReport()}
            className="mt-2 text-xs font-semibold text-tomato-light underline"
          >
            {copiedReport ? 'Rapport copié' : 'Copier rapport go/no-go (JSON)'}
          </button>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-cream/40">Connexion</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={testingApi}
            onClick={() => void runApiTest()}
            className={diagBtn(testingApi)}
          >
            <StatusIcon ok={apiOk} loading={testingApi} />
            Test API ({getApiBase()})
          </button>
          <button
            type="button"
            disabled={testingSocket}
            onClick={() => void runSocketTest()}
            className={diagBtn(testingSocket)}
          >
            <StatusIcon ok={socketOk} loading={testingSocket} />
            Test temps réel (Socket)
          </button>
          {isPos && (
            <>
              <button
                type="button"
                disabled={testingMenu}
                onClick={() => void runMenuTest()}
                className={diagBtn(testingMenu)}
              >
                <StatusIcon ok={menuOk} loading={testingMenu} />
                Catalogue menu
              </button>
              <button
                type="button"
                disabled={testingOnline}
                onClick={() => void runOnlineTest()}
                className={diagBtn(testingOnline)}
              >
                <StatusIcon ok={onlineOk} loading={testingOnline} />
                File commandes en ligne
              </button>
              <button
                type="button"
                disabled={testingKds}
                onClick={() => void runKdsTest()}
                className={diagBtn(testingKds)}
              >
                <StatusIcon ok={kdsOk} loading={testingKds} />
                API écran cuisine (KDS)
              </button>
            </>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-cream/40">Impression</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={testingPrintKitchen}
            onClick={runPrintKitchen}
            className={diagBtn(testingPrintKitchen)}
          >
            {testingPrintKitchen ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Printer className="h-4 w-4" />
            )}
            Test ticket cuisine
          </button>
          {(isPos || variant === 'kitchen') && (
            <button
              type="button"
              disabled={testingPrintBag}
              onClick={runPrintBag}
              className={diagBtn(testingPrintBag)}
            >
              {testingPrintBag ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ShoppingBag className="h-4 w-4" />
              )}
              Test étiquette sac
            </button>
          )}
          {isPos && (
            <button
              type="button"
              disabled={testingPrintReceipt}
              onClick={runPrintReceipt}
              className={diagBtn(testingPrintReceipt)}
            >
              {testingPrintReceipt ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UtensilsCrossed className="h-4 w-4" />
              )}
              Test reçu client
            </button>
          )}
        </div>
      </div>

      {isPos && (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-cream/40">Terminal SUNMI</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={testingSunmi}
              onClick={runSunmiTest}
              className={diagBtn(testingSunmi)}
            >
              {testingSunmi ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : sunmiOk === true ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              ) : sunmiOk === false ? (
                <WifiOff className="h-4 w-4 text-red-400" />
              ) : (
                <Smartphone className="h-4 w-4" />
              )}
              Pont SUNMI (window.SunmiPrinter)
            </button>
            <button
              type="button"
              onClick={runTpeTest}
              className={diagBtn(false)}
            >
              {tpeOk === true ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              ) : tpeOk === false ? (
                <WifiOff className="h-4 w-4 text-red-400" />
              ) : (
                <CreditCard className="h-4 w-4" />
              )}
              Pont TPE (window.PaymentTerminal)
            </button>
            <button
              type="button"
              disabled={testingSound}
              onClick={runSoundTest}
              className={diagBtn(testingSound)}
            >
              {testingSound ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : soundOk === true ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              ) : soundOk === false ? (
                <WifiOff className="h-4 w-4 text-red-400" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
              Son nouvelle commande
            </button>
          </div>
          {tpeMode && (
            <p className="text-xs text-cream/45">
              TPE : mode {tpeMode === 'native' ? 'natif (APK)' : 'manuel navigateur — validez après le terminal'}
            </p>
          )}
          {sunmiOk !== null && (
            <p className="text-xs text-cream/45">
              Pont natif : {sunmiOk ? 'détecté (APK android/)' : 'absent — navigateur ou CRM admin'}
              {sunmiStatus ? ` · Statut imprimante : ${sunmiStatus}` : ''}
            </p>
          )}
          {soundOk === false && (
            <p className="text-xs text-amber-200/80">
              Son disponible uniquement dans l&apos;APK SUNMI (<code>playNewOrderSound</code>).
            </p>
          )}
        </div>
      )}

      <p className="text-xs text-cream/35">
        {isPos ? (
          <>
            Epson cuisine : partage réseau ou pilote navigateur. SUNMI V2 : impression via pont natif ;
            réimpression depuis l&apos;admin commandes — la file PrintJob conserve la traçabilité. Le KDS
            reçoit les mêmes événements Socket que la caisse.
          </>
        ) : (
          <>
            Imprimante Epson : partage réseau ou pilote navigateur. SUNMI V2 : si oubli en cuisine,
            réimpression possible depuis l&apos;admin commandes — la file PrintJob conserve la traçabilité.
          </>
        )}
      </p>
    </section>
  )
}
