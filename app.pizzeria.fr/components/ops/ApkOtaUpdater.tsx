'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Download, Loader2, RefreshCw, X } from 'lucide-react'
import {
  checkApkUpdate,
  startApkOtaInstall,
  type ApkManifestEntry,
  type ApkOtaState,
} from '@/lib/apk-ota'

type Props = {
  /** Lance le téléchargement automatiquement dès qu'une MAJ est détectée. */
  autoInstall?: boolean
}

export function ApkOtaUpdater({ autoInstall = true }: Props) {
  const [state, setState] = useState<ApkOtaState>({ phase: 'idle' })
  const [dismissed, setDismissed] = useState(false)
  const autoStarted = useRef(false)

  const runCheck = useCallback(async () => {
    setState({ phase: 'checking' })
    const result = await checkApkUpdate()

    if (result.status === 'not_native' || result.status === 'unknown_kind') {
      setState({ phase: 'idle' })
      return
    }
    if (result.status === 'no_manifest') {
      setState({ phase: 'idle' })
      return
    }
    if (result.status === 'up_to_date') {
      setState({ phase: 'up_to_date', currentCode: result.currentCode })
      return
    }
    if (result.status === 'needs_native_bridge') {
      setState({
        phase: 'update_available',
        currentCode: 0,
        entry: result.entry,
      })
      return
    }
    setState({
      phase: 'update_available',
      currentCode: result.currentCode,
      entry: result.entry,
    })
  }, [])

  const runInstall = useCallback(async (entry: ApkManifestEntry) => {
    setState({ phase: 'downloading', entry })
    const result = startApkOtaInstall(entry.url)
    if (result.ok) {
      setState({ phase: 'install_prompt', message: result.message })
    } else {
      setState({ phase: 'error', message: result.message })
    }
  }, [])

  useEffect(() => {
    void runCheck()
  }, [runCheck])

  useEffect(() => {
    if (!autoInstall || autoStarted.current) return
    if (state.phase !== 'update_available') return
    if (typeof window.LaZPizzaDevice?.downloadAndInstallApk !== 'function') return
    autoStarted.current = true
    void runInstall(state.entry)
  }, [autoInstall, runInstall, state])

  if (dismissed) return null
  if (state.phase === 'idle' || state.phase === 'checking' || state.phase === 'up_to_date') {
    return null
  }

  if (state.phase === 'downloading') {
    return (
      <div className="fixed inset-x-0 top-0 z-[200] flex items-center gap-2 border-b border-amber-500/30 bg-amber-950/95 px-4 py-2.5 text-sm text-amber-100 shadow-lg">
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
        <span>
          Téléchargement v{state.entry.versionName}… L&apos;écran d&apos;installation va s&apos;ouvrir.
        </span>
      </div>
    )
  }

  if (state.phase === 'install_prompt') {
    return (
      <div className="fixed inset-x-0 top-0 z-[200] flex items-center gap-2 border-b border-emerald-500/30 bg-emerald-950/95 px-4 py-2.5 text-sm text-emerald-100 shadow-lg">
        <Download className="h-4 w-4 shrink-0" />
        <span>{state.message}</span>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="ml-auto rounded p-1 hover:bg-white/10"
          aria-label="Fermer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    )
  }

  if (state.phase === 'error') {
    return (
      <div className="fixed inset-x-0 top-0 z-[200] flex flex-wrap items-center gap-2 border-b border-red-500/30 bg-red-950/95 px-4 py-2.5 text-sm text-red-100 shadow-lg">
        <span className="flex-1">{state.message}</span>
        <button
          type="button"
          onClick={() => void runCheck()}
          className="inline-flex items-center gap-1 rounded-lg border border-white/20 px-2 py-1 text-xs hover:bg-white/10"
        >
          <RefreshCw className="h-3 w-3" /> Réessayer
        </button>
        <button type="button" onClick={() => setDismissed(true)} className="rounded p-1 hover:bg-white/10">
          <X className="h-4 w-4" />
        </button>
      </div>
    )
  }

  // update_available
  return (
    <div className="fixed inset-x-0 top-0 z-[200] flex flex-wrap items-center gap-2 border-b border-amber-500/30 bg-amber-950/95 px-4 py-2.5 text-sm text-amber-100 shadow-lg">
      <Download className="h-4 w-4 shrink-0" />
      <span className="flex-1">
        Mise à jour v{state.entry.versionName} disponible
        {state.currentCode > 0 ? ` (actuelle : build ${state.currentCode})` : ''}.
        {typeof window.LaZPizzaDevice?.downloadAndInstallApk === 'function'
          ? ' Installation automatique…'
          : ' Installez une APK récente une fois en USB pour activer les MAJ sans câble.'}
      </span>
      {typeof window.LaZPizzaDevice?.downloadAndInstallApk === 'function' && (
        <button
          type="button"
          onClick={() => void runInstall(state.entry)}
          className="rounded-lg bg-tomato px-3 py-1.5 text-xs font-medium text-white hover:bg-tomato-light"
        >
          Installer
        </button>
      )}
      <button type="button" onClick={() => setDismissed(true)} className="rounded p-1 hover:bg-white/10">
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
