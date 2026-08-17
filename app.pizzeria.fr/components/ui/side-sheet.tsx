'use client'

import { X } from 'lucide-react'
import { cn } from '@/lib/cn'

export function SideSheet({
  open,
  onClose,
  title,
  subtitle,
  children,
  width = 'md',
  footer,
}: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: React.ReactNode
  width?: 'sm' | 'md' | 'lg'
  footer?: React.ReactNode
}) {
  if (!open) return null

  const w =
    width === 'sm' ? 'max-w-sm' : width === 'lg' ? 'max-w-2xl' : 'max-w-md'

  return (
    <div className="fixed inset-0 z-[80] flex justify-end bg-black/70 backdrop-blur-[2px]">
      <button type="button" className="flex-1" aria-label="Fermer" onClick={onClose} />
      <div
        className={cn(
          'flex h-full w-full flex-col border-l border-white/10 bg-[#100c0a] shadow-2xl animate-in slide-in-from-right duration-200',
          w,
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="side-sheet-title"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div className="min-w-0">
            {subtitle && (
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cream/40">{subtitle}</p>
            )}
            <h2 id="side-sheet-title" className="font-display text-xl font-bold text-cream">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-cream/50 hover:bg-white/10 hover:text-cream"
            aria-label="Fermer le panneau"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="shrink-0 border-t border-white/10 px-5 py-4">{footer}</div>}
      </div>
    </div>
  )
}
