'use client'

import Link from 'next/link'
import { ArrowLeft, ExternalLink } from 'lucide-react'

export function MonitorChrome({
  kind,
  adminHref,
}: {
  kind: 'kitchen' | 'pos'
  adminHref: string
}) {
  const label = kind === 'kitchen' ? 'Moniteur cuisine' : 'Moniteur caisse'

  return (
    <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-[#120e0c]/95 px-4 py-2 text-xs backdrop-blur">
      <div className="flex items-center gap-3">
        <Link
          href={adminHref}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-cream/70 hover:bg-white/5 hover:text-cream"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Retour CRM
        </Link>
        <span className="hidden text-cream/40 sm:inline">·</span>
        <span className="font-medium text-cream/80">{label}</span>
        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
          Temps réel
        </span>
      </div>
      <a
        href={adminHref}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-cream/45 hover:text-cream/70"
      >
        CRM
        <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  )
}
