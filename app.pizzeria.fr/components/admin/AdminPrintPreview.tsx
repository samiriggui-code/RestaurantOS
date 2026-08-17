'use client'

import { Printer, X } from 'lucide-react'

type Props = {
  title: string
  html: string
  onClose: () => void
}

export function AdminPrintPreview({ title, html, onClose }: Props) {
  function triggerPrint() {
    const iframe = document.getElementById('admin-print-iframe') as HTMLIFrameElement | null
    iframe?.contentWindow?.focus()
    iframe?.contentWindow?.print()
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0d0a09]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#1A1412] px-4 py-3">
        <p className="font-semibold text-cream">{title}</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={triggerPrint}
            className="inline-flex items-center gap-2 rounded-xl bg-tomato px-4 py-2 text-sm font-semibold text-white"
          >
            <Printer className="h-4 w-4" />
            Imprimer / PDF
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm text-cream"
          >
            <X className="h-4 w-4" />
            Fermer
          </button>
        </div>
      </div>
      <iframe
        id="admin-print-iframe"
        title={title}
        srcDoc={html}
        className="min-h-0 flex-1 w-full border-0 bg-white"
      />
    </div>
  )
}
