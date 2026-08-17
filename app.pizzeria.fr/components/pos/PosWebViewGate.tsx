'use client'

import type { ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { getWebViewCapability, MIN_CHROME_VERSION } from '@/lib/webview-capability'

type Props = {
  children: ReactNode
}

/**
 * Bloque le POS sur SUNMI si WebView Chrome < 64 (phase 0 CDC §2.2.2).
 */
export function PosWebViewGate({ children }: Props) {
  const cap = getWebViewCapability()

  if (!cap.blockPos) {
    return <>{children}</>
  }

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="rounded-2xl border border-red-500/40 bg-red-950/40 p-6 max-w-lg">
        <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-red-300" />
        <h2 className="text-lg font-bold text-red-100">POS bloqué — WebView incompatible</h2>
        <p className="mt-2 text-sm text-red-100/90">{cap.message}</p>
        <dl className="mt-4 space-y-1 text-left text-xs text-red-100/70">
          <div className="flex justify-between gap-4">
            <dt>Chrome détecté</dt>
            <dd>{cap.chromeVersion ?? '—'}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Minimum requis</dt>
            <dd>{MIN_CHROME_VERSION}</dd>
          </div>
          {cap.androidModel && (
            <div className="flex justify-between gap-4">
              <dt>Modèle</dt>
              <dd>{cap.androidModel}</dd>
            </div>
          )}
          {cap.appVersion && (
            <div className="flex justify-between gap-4">
              <dt>APK</dt>
              <dd>v{cap.appVersion}</dd>
            </div>
          )}
        </dl>
        <p className="mt-4 text-xs text-red-100/60">
          Le site public, le KDS sur tablette récente et l&apos;admin restent utilisables. Voir{' '}
          <code className="text-red-100/80">docs/webview-sunmi-checklist.md</code>.
        </p>
      </div>
    </div>
  )
}
