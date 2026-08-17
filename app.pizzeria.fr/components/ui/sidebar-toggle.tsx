'use client'

import { ChevronLeft, ChevronRight, PanelLeft } from 'lucide-react'
import { cn } from '@/lib/cn'

export function SidebarToggleButton({
  collapsed,
  onToggle,
  className,
  variant = 'header',
}: {
  collapsed: boolean
  onToggle: () => void
  className?: string
  variant?: 'header' | 'inline' | 'rail'
}) {
  if (variant === 'rail') {
    return (
      <button
        type="button"
        onClick={onToggle}
        aria-label={collapsed ? 'Ouvrir le menu' : 'Réduire le menu'}
        className={cn(
          'absolute -right-3 top-[4.5rem] z-50 flex h-6 w-6 items-center justify-center rounded-full border border-white/15 bg-[#1a1412] text-cream/60 shadow-md transition hover:bg-white/10 hover:text-cream',
          className,
        )}
      >
        {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
      </button>
    )
  }

  if (variant === 'inline') {
    return (
      <button
        type="button"
        onClick={onToggle}
        aria-label={collapsed ? 'Ouvrir le menu' : 'Réduire le menu'}
        className={cn(
          'inline-flex shrink-0 items-center justify-center rounded-lg p-1.5 text-cream/50 transition hover:bg-white/5 hover:text-cream',
          className,
        )}
      >
        {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={collapsed ? 'Ouvrir le menu' : 'Réduire le menu'}
      className={cn(
        'inline-flex items-center justify-center rounded-xl p-2 text-cream/70 transition hover:bg-white/5 hover:text-cream',
        className,
      )}
    >
      <PanelLeft className="h-5 w-5" />
    </button>
  )
}
